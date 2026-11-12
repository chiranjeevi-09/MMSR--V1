"""Integration tests for the 3 protected download endpoints (X-Accel-Redirect / FileResponse)."""
import os
from decimal import Decimal
from django.test import TestCase, override_settings
from django.core.files.base import ContentFile
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from publications.models import Journal, JournalIssue, JournalArticle, UserJournalAccess
from orders.models import Order
from core.storages import protected_storage

User = get_user_model()


class ProtectedDownloadEndpointTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='subscriber@example.com',
            password='TestPassword123!',
        )
        self.other_user = User.objects.create_user(
            email='other@example.com',
            password='TestPassword123!',
        )

        # Journal
        self.journal = Journal.objects.create(
            title='Test Journal',
            slug='test-journal',
            issn='1234-5679',
            description='Test description',
            subscription_price_annual=Decimal('1000.00'),
        )

        # Issue with digital PDF in protected storage
        self.issue = JournalIssue.objects.create(
            journal=self.journal,
            volume_number=1,
            issue_number=1,
            title='Issue 1',
            publication_date='2026-01-01',
            price=Decimal('50.00'),
        )
        self.issue.file_digital.save('issue_test.pdf', ContentFile(b'%PDF-1.4 test issue digital pdf'))
        self.issue.save()

        # Article with PDF in protected storage
        self.article = JournalArticle.objects.create(
            journal=self.journal,
            issue=self.issue,
            title='Test Article',
            slug='test-article',
            access_mode='subscription',
        )
        self.article.file_pdf.save('article_test.pdf', ContentFile(b'%PDF-1.4 test article pdf'))
        self.article.save()

        # Order with invoice in protected storage
        self.order = Order.objects.create(
            user=self.user,
            total_amount=Decimal('100.00'),
            status='paid',
        )
        self.order.invoice_pdf.save('invoice_test.pdf', ContentFile(b'%PDF-1.4 test invoice pdf'))
        self.order.save()

    def tearDown(self):
        # Cleanup files created in protected storage
        for obj in [self.issue.file_digital, self.article.file_pdf, self.order.invoice_pdf]:
            if obj and obj.name:
                try:
                    obj.storage.delete(obj.name)
                except Exception:
                    pass

    # ── Journal Issue Tests ──────────────────────────────────────────
    def test_journal_issue_download_unauthorized(self):
        """Anonymous request to paid issue PDF returns 401."""
        url = f'/api/publications/issues/{self.issue.id}/pdf/'
        res = self.client.get(url)
        self.assertEqual(res.status_code, 401)

    def test_journal_issue_download_authorized_subscriber(self):
        """Active subscriber receives file."""
        UserJournalAccess.objects.create(
            user=self.user,
            journal=self.journal,
            access_type='subscription',
            is_active=True,
        )
        self.client.force_authenticate(user=self.user)
        url = f'/api/publications/issues/{self.issue.id}/pdf/'
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200)
        self.assertIn('application/pdf', res['Content-Type'])
        self.assertIn('inline', res['Content-Disposition'])

    @override_settings(USE_X_ACCEL_REDIRECT=True, X_ACCEL_PREFIX='/protected_media_internal/')
    def test_journal_issue_download_x_accel_redirect(self):
        """With USE_X_ACCEL_REDIRECT=True, response contains X-Accel-Redirect header."""
        UserJournalAccess.objects.create(
            user=self.user,
            journal=self.journal,
            access_type='subscription',
            is_active=True,
        )
        self.client.force_authenticate(user=self.user)
        url = f'/api/publications/issues/{self.issue.id}/pdf/'
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200)
        self.assertTrue('X-Accel-Redirect' in res)
        self.assertTrue(res['X-Accel-Redirect'].startswith('/protected_media_internal/'))

    # ── Journal Article Tests ─────────────────────────────────────────
    def test_journal_article_download_unauthorized(self):
        """User without access cannot download subscription article."""
        self.client.force_authenticate(user=self.other_user)
        url = f'/api/publications/articles/{self.article.id}/pdf/'
        res = self.client.get(url)
        self.assertEqual(res.status_code, 403)

    def test_journal_article_download_authorized(self):
        """User with granted article access receives PDF."""
        UserJournalAccess.objects.create(
            user=self.user,
            journal=self.journal,
            article=self.article,
            access_type='article',
            is_active=True,
        )
        self.client.force_authenticate(user=self.user)
        url = f'/api/publications/articles/{self.article.id}/pdf/'
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200)
        self.assertIn('application/pdf', res['Content-Type'])

    # ── Order Invoice Tests ───────────────────────────────────────────
    def test_order_invoice_download_wrong_user(self):
        """User cannot download another user's invoice."""
        self.client.force_authenticate(user=self.other_user)
        url = f'/api/commerce/{self.order.id}/invoice/'
        res = self.client.get(url)
        self.assertEqual(res.status_code, 403)

    def test_order_invoice_download_owner(self):
        """Owner can download their invoice."""
        self.client.force_authenticate(user=self.user)
        url = f'/api/commerce/{self.order.id}/invoice/'
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200)
        self.assertIn('application/pdf', res['Content-Type'])
        self.assertIn('attachment', res['Content-Disposition'])

    @override_settings(USE_X_ACCEL_REDIRECT=True, X_ACCEL_PREFIX='/protected_media_internal/')
    def test_order_invoice_x_accel_redirect(self):
        """Owner receives X-Accel-Redirect when enabled."""
        self.client.force_authenticate(user=self.user)
        url = f'/api/commerce/{self.order.id}/invoice/'
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200)
        self.assertTrue('X-Accel-Redirect' in res)
        self.assertTrue(res['X-Accel-Redirect'].startswith('/protected_media_internal/'))
