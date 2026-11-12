"""
Robust Redis / LocMem caching utility for public catalog read endpoints.
Ensures cache safety:
- Bypasses cache completely for ANY authenticated request (user.is_authenticated).
- Never caches requests with Authorization headers or auth session cookies.
- Never caches responses that set cookies (Set-Cookie).
- Fault tolerant: Gracefully catches Redis connection/timeout errors so endpoints
  always fall back to database queries (returning 200, never 500).
- Sets X-Cache: HIT / MISS / BYPASS for observability.
"""
import hashlib
import logging
from functools import wraps
from django.core.cache import cache
from rest_framework.response import Response

logger = logging.getLogger(__name__)


def cache_public_api(timeout=60, prefix="pub_api"):
    """
    Decorator for public read endpoints to cache serialized response payloads.
    - TTL: default 60 seconds.
    - Bypasses cache for any authenticated request or request carrying credentials.
    - Never caches responses that emit Set-Cookie.
    - Gracefully degrades to database query if cache backend is unavailable.
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(*args, **kwargs):
            # Extract view_instance and request accurately regardless of invocation style
            if len(args) > 1 and hasattr(args[1], 'META'):
                view_instance = args[0]
                request = args[1]
                call_args = args
            elif len(args) > 0 and hasattr(args[0], 'META'):
                view_instance = None
                request = args[0]
                call_args = args
            else:
                view_instance = args[0] if args else None
                request = kwargs.get('request')
                call_args = args

            # 1. Check if request is authenticated or carries authentication headers/cookies
            user = getattr(request, 'user', None)
            is_user_auth = bool(user and getattr(user, 'is_authenticated', False))
            has_auth_header = bool(
                request.META.get('HTTP_AUTHORIZATION') or
                (hasattr(request, 'headers') and request.headers.get('Authorization'))
            )
            has_auth_cookie = bool(
                request.COOKIES.get('sessionid') or
                request.COOKIES.get('jwt') or
                request.COOKIES.get('access_token') or
                request.COOKIES.get('refresh_token')
            )

            # Bypass cache for ANY authenticated user or credential-bearing request
            if is_user_auth or has_auth_header or has_auth_cookie:
                response = view_func(*call_args, **kwargs)
                if hasattr(response, '__setitem__'):
                    response['X-Cache'] = 'BYPASS'
                return response

            # 2. Build deterministic cache key from path and sorted query params
            query_items = sorted(request.query_params.lists()) if hasattr(request, 'query_params') else []
            key_raw = f"{prefix}:{request.path}:{query_items}"
            key_hash = hashlib.sha256(key_raw.encode('utf-8')).hexdigest()[:32]
            cache_key = f"{prefix}:{key_hash}"

            # 3. Attempt cache lookup with error resilience
            cached_data = None
            try:
                cached_data = cache.get(cache_key)
            except Exception as exc:
                logger.warning("Cache backend unavailable during get for key %s: %s", cache_key, exc)
                cached_data = None

            if cached_data is not None:
                response = Response(cached_data)
                response['X-Cache'] = 'HIT'
                return response

            # 4. Execute view function from database
            response = view_func(*call_args, **kwargs)

            # 5. Determine whether response can be safely cached
            # Never cache responses that set cookies, non-200 responses, or streaming responses
            has_set_cookie = (
                bool(getattr(response, 'cookies', None)) or
                ('Set-Cookie' in response.headers if hasattr(response, 'headers') else False)
            )

            if response.status_code == 200 and hasattr(response, 'data') and not has_set_cookie:
                try:
                    cache.set(cache_key, response.data, timeout=timeout)
                except Exception as exc:
                    logger.warning("Cache backend unavailable during set for key %s: %s", cache_key, exc)
                if hasattr(response, '__setitem__'):
                    response['X-Cache'] = 'MISS'
            else:
                if hasattr(response, '__setitem__'):
                    response['X-Cache'] = 'BYPASS'

            return response
        return wrapper
    return decorator


def invalidate_public_api_cache(prefix=None):
    """
    Invalidate public API caches immediately on model mutation (save/delete).
    Ensures that admin deletions, creations, and edits are instantly visible on the user side.
    """
    prefixes = [prefix] if prefix else [
        "book_list", "cat_list", "journal_list", "conf_list", "slider_list", "policy_list", "pub_api"
    ]
    try:
        # 1. If Redis client supports delete_pattern
        if hasattr(cache, 'delete_pattern'):
            for p in prefixes:
                try:
                    cache.delete_pattern(f"*{p}*")
                except Exception:
                    pass
            return

        # 2. If LocMemCache, clear matching keys from internal dict
        if hasattr(cache, '_cache'):
            try:
                keys_to_del = [
                    k for k in list(cache._cache.keys())
                    if any(p in str(k) for p in prefixes)
                ]
                for k in keys_to_del:
                    cache._cache.pop(k, None)
                return
            except Exception:
                pass

        # 3. Fallback to cache.clear()
        cache.clear()
    except Exception as exc:
        logger.warning("Error during public API cache invalidation: %s", exc)

