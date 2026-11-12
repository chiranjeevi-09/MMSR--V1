"""Unit tests for Phase 11C: Protected Document Download Optimization & Security."""
import os
import tempfile
from pathlib import Path
from unittest.mock import MagicMock

from django.test import TestCase, override_settings
from django.http import Http404, FileResponse, HttpResponse

from core.downloads import protected_file_response


class ProtectedFileResponseSecurityTests(TestCase):
    """Test X-Accel-Redirect, FileResponse fallback, and path traversal security."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.protected_root = Path(self.temp_dir.name)
        
        # Create a sample protected PDF
        self.sample_subfolder = self.protected_root / 'invoices'
        self.sample_subfolder.mkdir(parents=True, exist_ok=True)
        self.sample_pdf = self.sample_subfolder / 'invoice_001.pdf'
        self.sample_pdf.write_bytes(b'%PDF-1.4 sample pdf content')

    def tearDown(self):
        self.temp_dir.cleanup()

    def _mock_file_field(self, rel_path):
        field = MagicMock()
        field.name = rel_path
        # file_field.open returns a file object
        target_file = self.protected_root / rel_path
        field.open = lambda mode='rb': target_file.open(mode)
        return field

    def test_file_response_fallback_when_x_accel_disabled(self):
        """When USE_X_ACCEL_REDIRECT is False, returns streaming FileResponse."""
        with override_settings(PROTECTED_MEDIA_ROOT=str(self.protected_root), USE_X_ACCEL_REDIRECT=False):
            field = self._mock_file_field('invoices/invoice_001.pdf')
            response = protected_file_response(field, download_name='my_invoice')

            self.assertIsInstance(response, FileResponse)
            self.assertEqual(response['Content-Type'], 'application/pdf')
            self.assertIn('filename="my_invoice.pdf"', response['Content-Disposition'])
            self.assertEqual(response['Cache-Control'], 'private, no-store')
            self.assertEqual(response['Vary'], 'Authorization, Cookie')
            self.assertNotIn('X-Accel-Redirect', response)
            response.close()

    def test_x_accel_redirect_header_when_enabled(self):
        """When USE_X_ACCEL_REDIRECT is True, returns empty HttpResponse with X-Accel-Redirect."""
        with override_settings(
            PROTECTED_MEDIA_ROOT=str(self.protected_root),
            USE_X_ACCEL_REDIRECT=True,
            X_ACCEL_PREFIX='/protected_media_internal/'
        ):
            field = self._mock_file_field('invoices/invoice_001.pdf')
            response = protected_file_response(field, download_name='my_invoice')

            self.assertIsInstance(response, HttpResponse)
            self.assertNotIsInstance(response, FileResponse)
            self.assertEqual(response.content, b'')  # Empty body: Nginx streams it
            self.assertEqual(response['X-Accel-Redirect'], '/protected_media_internal/invoices/invoice_001.pdf')
            self.assertEqual(response['Content-Type'], 'application/pdf')
            self.assertIn('filename="my_invoice.pdf"', response['Content-Disposition'])
            self.assertEqual(response['Cache-Control'], 'private, no-store')

    def test_missing_file_on_disk_raises_404(self):
        """If database points to nonexistent file, raises Http404."""
        with override_settings(PROTECTED_MEDIA_ROOT=str(self.protected_root)):
            field = self._mock_file_field('invoices/does_not_exist.pdf')
            with self.assertRaises(Http404):
                protected_file_response(field, download_name='test')

    def test_empty_or_none_file_field_raises_404(self):
        """None or empty field raises Http404."""
        with self.assertRaises(Http404):
            protected_file_response(None, download_name='test')

        empty_field = MagicMock()
        empty_field.name = ''
        with self.assertRaises(Http404):
            protected_file_response(empty_field, download_name='test')

    def test_path_traversal_double_dot_rejected(self):
        """Keys attempting parent directory traversal are rejected with 404."""
        with override_settings(PROTECTED_MEDIA_ROOT=str(self.protected_root)):
            field = MagicMock()
            field.name = '../../etc/passwd'
            with self.assertRaises(Http404):
                protected_file_response(field, download_name='exploit')

            field.name = 'invoices/../../secret.txt'
            with self.assertRaises(Http404):
                protected_file_response(field, download_name='exploit')

    def test_absolute_path_prefix_rejected(self):
        """Keys attempting root escape are rejected with 404."""
        with override_settings(PROTECTED_MEDIA_ROOT=str(self.protected_root)):
            field = MagicMock()
            field.name = '/etc/shadow'
            with self.assertRaises(Http404):
                protected_file_response(field, download_name='exploit')

