"""Unit tests for Phase 12: Admin Notifications live feed and permission controls."""
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

User = get_user_model()


class AdminNotificationsEndpointTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            email='test_admin_notif@mmsr.com',
            password='testpassword123',
            first_name='Admin',
            last_name='User',
        )
        self.regular_user = User.objects.create_user(
            email='test_regular_notif@mmsr.com',
            password='testpassword123',
            first_name='Regular',
            last_name='User',
        )

    def test_anonymous_user_rejected(self):
        """Unauthenticated requests must receive 401."""
        res = self.client.get('/api/users/admin-notifications/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_non_staff_user_forbidden(self):
        """Non-staff authenticated users must receive 403."""
        self.client.force_authenticate(user=self.regular_user)
        res = self.client.get('/api/users/admin-notifications/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_receives_notifications_feed(self):
        """Admin users receive 200 with list of live operational notifications."""
        self.client.force_authenticate(user=self.admin)
        res = self.client.get('/api/users/admin-notifications/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIsInstance(res.data, list)
        if len(res.data) > 0:
            first = res.data[0]
            for key in ('id', 'title', 'message', 'timestamp', 'category', 'section', 'linkUrl'):
                self.assertIn(key, first)
            self.assertIn(first['category'], ('submission', 'order', 'conference', 'user'))
            self.assertIn(first['section'], ('submissions', 'orders', 'conferences', 'users'))

