"""Scoped DRF throttles for the public invitation-activation endpoints."""
import hashlib
import time
import threading

from rest_framework.throttling import ScopedRateThrottle, BaseThrottle
from django.conf import settings
from django.core.cache import cache

# In-process fallback store for login failures when the primary cache (e.g. Redis)
# is unavailable. Maps window_key -> (failure_count, expire_timestamp).
# Guarantees that a Redis outage falls back to per-worker in-memory throttling
# rather than completely disabling brute-force protection (fail-open vulnerability).
_PROCESS_FALLBACK_FAILURES = {}
_PROCESS_FALLBACK_LOCK = threading.Lock()


def _get_fallback_failures(key):
    now = time.time()
    with _PROCESS_FALLBACK_LOCK:
        entry = _PROCESS_FALLBACK_FAILURES.get(key)
        if entry:
            count, expire = entry
            if now < expire:
                return count
            _PROCESS_FALLBACK_FAILURES.pop(key, None)
        return 0


def _increment_fallback_failures(key, duration):
    now = time.time()
    with _PROCESS_FALLBACK_LOCK:
        if len(_PROCESS_FALLBACK_FAILURES) > 5000:
            expired = [k for k, (_, exp) in _PROCESS_FALLBACK_FAILURES.items() if now >= exp]
            for k in expired:
                _PROCESS_FALLBACK_FAILURES.pop(k, None)
        count, _ = _PROCESS_FALLBACK_FAILURES.get(key, (0, 0))
        _PROCESS_FALLBACK_FAILURES[key] = (count + 1, now + (duration * 2))


def _delete_fallback_failures(key):
    with _PROCESS_FALLBACK_LOCK:
        _PROCESS_FALLBACK_FAILURES.pop(key, None)


class InvitationValidateThrottle(ScopedRateThrottle):
    scope = 'invitation-validate'


class InvitationAcceptThrottle(ScopedRateThrottle):
    scope = 'invitation-accept'


class PasswordResetRequestThrottle(ScopedRateThrottle):
    scope = 'password-reset'


class FailedLoginThrottle(BaseThrottle):
    """Brute-force protection for credential logins (audit H-1).

    Counts ONLY FAILED authentication attempts per (client IP, email) inside
    a fixed window and blocks further attempts with HTTP 429 once the scope's
    rate is exhausted. Successful logins never count, so legitimate users
    signing in repeatedly (or automated tests) are never punished.

    Views drive it explicitly (DRF's automatic allow_request pass happens
    before the serializer runs, so it cannot see the email):
        throttle = XThrottle()
        if not throttle.allow_request(request, view): -> 429
        on auth failure: throttle.register_failure()

    Design notes:
    - The email is only ever used as a one-way SHA-256 fragment of the cache
      key — never stored or logged in clear text.
    - The blocked response is deliberately generic and identical regardless
      of whether the account exists, so throttling adds no enumeration
      signal (DRF's default 429 body carries no account detail either).
    - LocMem cache (dev) is per-process; production must configure REDIS_URL
      so limits hold across workers.
    """
    scope = 'login'

    def __init__(self):
        rate = self.get_rate()
        self.num_requests, self.duration = self.parse_rate(rate)

    def get_rate(self):
        from rest_framework.settings import api_settings
        # Merge so tests can override via the plain THROTTLE_RATES setting
        # (the convention already used across users/tests.py) without
        # redefining the whole REST_FRAMEWORK dict.
        rates = dict(api_settings.DEFAULT_THROTTLE_RATES or {})
        rates.update(getattr(settings, 'THROTTLE_RATES', None) or {})
        try:
            return rates[self.scope]
        except KeyError:
            raise Exception(
                'You have omitted the "%s" rate in your REST_FRAMEWORK setting.' % self.scope
            )

    def parse_rate(self, rate):
        # Accepts DRF's word form ('10/minute', '2/second' — matched on the
        # first letter, exactly like SimpleRateThrottle) plus an extended
        # multiplier form ('10/5m' = ten per 5 minutes, '30/90s') so login
        # windows longer than one unit are expressible.
        if rate is None:
            return None, None
        num, period = rate.split('/')
        num_requests = int(num)
        units = {'s': 1, 'm': 60, 'h': 3600, 'd': 86400}
        if period and period[-1] in units and period[:-1].isdigit():
            duration = int(period[:-1]) * units[period[-1]]
        elif period and period[0] in units:
            duration = units[period[0]]
        else:
            raise ValueError('Invalid throttle duration %r in rate %r' % (period, rate))
        return num_requests, duration

    def _base_key(self, request):
        try:
            email = str(request.data.get('email') or '').strip().lower()
        except Exception:
            # Unparseable/unsupported payload — let the serializer produce
            # the normal 400 instead of throttling blindly.
            return None
        if not email:
            return None
        ident = self.get_ident(request)
        digest = hashlib.sha256(('%s|%s' % (ident, email)).encode('utf-8')).hexdigest()[:32]
        return 'loginfail:%s:%s' % (self.scope, digest)

    def allow_request(self, request, view):
        self.key = self._base_key(request)
        if self.key is None:
            return True
        window = int(time.time() // self.duration)
        self._window_key = '%s:%d' % (self.key, window)
        try:
            failures = cache.get(self._window_key, 0)
        except Exception:
            # Audit safety fix: If primary cache (e.g. Redis) is unavailable,
            # fall back to the in-process fallback counter so the worker
            # STILL enforces brute-force limits rather than failing 100% open.
            failures = _get_fallback_failures(self._window_key)
        self._failures = failures
        return failures < self.num_requests

    def register_failure(self):
        """Record one failed attempt for the checked window."""
        key = getattr(self, '_window_key', None)
        if not key:
            return
        # Always record in fallback store in case primary cache fails mid-window
        _increment_fallback_failures(key, self.duration)
        try:
            cache.set(key, getattr(self, '_failures', 0) + 1, self.duration * 2)
        except Exception:
            pass

    def reset(self):
        """Clear the failure counter after a successful login."""
        key = getattr(self, '_window_key', None)
        if key:
            _delete_fallback_failures(key)
            try:
                cache.delete(key)
            except Exception:
                pass

    def wait(self):
        """Seconds until the current window rolls over (used for Retry-After)."""
        if getattr(self, '_window_key', None) is None:
            return self.duration
        return self.duration - (int(time.time()) % self.duration)


class UserLoginThrottle(FailedLoginThrottle):
    scope = 'login'


class AdminLoginThrottle(FailedLoginThrottle):
    """Stricter scope for the staff portal (audit H-1).

    Keyed separately from customer login so hammering one portal cannot
    consume the other portal's budget (scope separation is part of the
    acceptance criteria)."""
    scope = 'login-admin'
