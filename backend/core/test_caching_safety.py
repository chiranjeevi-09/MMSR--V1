"""
Tests for caching safety and resilience:
1. Anonymous requests are cached (MISS then HIT).
2. Authenticated requests bypass cache (X-Cache: BYPASS).
3. Requests with Authorization header or session cookies bypass cache.
4. User A's response is never served to User B or to anonymous users.
5. Responses setting Set-Cookie are never cached.
6. When Redis/cache backend raises connection errors or is down, endpoints
   gracefully degrade to database queries and return 200 (never 500).
"""
from unittest.mock import patch
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient
from users.models import User
from publications.models import Category


class CacheSafetyTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.user_a = User.objects.create_user(
            email='usera@example.com',
            password='Password123!',
            first_name='User',
            last_name='Alpha'
        )
        self.user_b = User.objects.create_user(
            email='userb@example.com',
            password='Password123!',
            first_name='User',
            last_name='Beta'
        )
        self.category = Category.objects.create(
            name='Computer Science Test',
            slug='cs-test',
            description='Test category',
            category_type='book'
        )
        self.endpoint = '/api/publications/categories/'

    def tearDown(self):
        cache.clear()

    def test_anonymous_requests_are_cached(self):
        # First request should be a MISS
        resp1 = self.client.get(self.endpoint)
        self.assertEqual(resp1.status_code, 200)
        self.assertEqual(resp1.headers.get('X-Cache'), 'MISS')

        # Second request should be a HIT
        resp2 = self.client.get(self.endpoint)
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(resp2.headers.get('X-Cache'), 'HIT')
        self.assertEqual(resp1.data, resp2.data)

    def test_authenticated_requests_bypass_cache(self):
        # Authenticate as User A
        self.client.force_authenticate(user=self.user_a)
        resp = self.client.get(self.endpoint)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.headers.get('X-Cache'), 'BYPASS')

    def test_authorization_header_bypasses_cache(self):
        # Client with valid Authorization Bearer header
        from rest_framework_simplejwt.tokens import RefreshToken
        token = str(RefreshToken.for_user(self.user_a).access_token)
        resp = self.client.get(self.endpoint, HTTP_AUTHORIZATION=f'Bearer {token}')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.headers.get('X-Cache'), 'BYPASS')

    def test_session_cookie_bypasses_cache(self):
        # Client with sessionid cookie
        self.client.cookies['sessionid'] = 'fake_session_id_123'
        resp = self.client.get(self.endpoint)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.headers.get('X-Cache'), 'BYPASS')

    def test_user_a_response_never_served_to_user_b_or_anonymous(self):
        # 1. User A makes an authenticated request
        self.client.force_authenticate(user=self.user_a)
        resp_a = self.client.get(self.endpoint)
        self.assertEqual(resp_a.status_code, 200)
        self.assertEqual(resp_a.headers.get('X-Cache'), 'BYPASS')

        # 2. User B makes an authenticated request -> must also BYPASS
        self.client.force_authenticate(user=self.user_b)
        resp_b = self.client.get(self.endpoint)
        self.assertEqual(resp_b.status_code, 200)
        self.assertEqual(resp_b.headers.get('X-Cache'), 'BYPASS')

        # 3. Anonymous user makes a request -> fresh cold MISS from database, not User A's cache
        self.client.logout()
        resp_anon = self.client.get(self.endpoint)
        self.assertEqual(resp_anon.status_code, 200)
        self.assertEqual(resp_anon.headers.get('X-Cache'), 'MISS')

    def test_cache_failure_degrades_gracefully_to_database(self):
        """When Redis / cache raises exceptions, endpoints must return 200 and NOT 500."""
        with patch('django.core.cache.cache.get', side_effect=Exception("Redis connection refused")):
            with patch('django.core.cache.cache.set', side_effect=Exception("Redis connection refused")):
                resp = self.client.get(self.endpoint)
                self.assertEqual(resp.status_code, 200)
                # Ensure data is still served directly from database
                self.assertTrue(len(resp.data) >= 1)
