"""
Unit tests for submission document downloads and publication notice certificate issuance.
Verifies fix for admin publication certificate download issue and access control.
"""
import io
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status

from submissions.models import Submission
from submissions.serializers import PROTECTED_DOCUMENTS, DOCUMENT_KIND_TO_FIELD

User = get_user_model()


class SubmissionDocumentDownloadTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            email='test_admin@mmsr.com',
            password='testpassword123',
            first_name='Admin',
            last_name='User',
        )
        self.author = User.objects.create_user(
            email='test_author@mmsr.com',
            password='testpassword123',
            first_name='Author',
            last_name='One',
        )
        self.other_user = User.objects.create_user(
            email='test_other@mmsr.com',
            password='testpassword123',
            first_name='Other',
            last_name='User',
        )

        dummy_pdf = b'%PDF-1.4 test manuscript content'
        self.submission = Submission.objects.create(
            author=self.author,
            title='Advances in Neural Networks and Optimization',
            abstract='A study on neural architectures.',
            submission_type='journal_article',
            manuscript_file=SimpleUploadedFile('test_paper.pdf', dummy_pdf, content_type='application/pdf'),
            certificate_issued=False,
        )

    def test_document_kind_mapping(self):
        """Verify DOCUMENT_KIND_TO_FIELD maps URL slugs to model fields correctly."""
        self.assertEqual(DOCUMENT_KIND_TO_FIELD.get('notice'), 'certificate_file')
        self.assertEqual(DOCUMENT_KIND_TO_FIELD.get('certificate'), 'certificate_file')
        self.assertEqual(DOCUMENT_KIND_TO_FIELD.get('manuscript'), 'manuscript_file')
        self.assertEqual(DOCUMENT_KIND_TO_FIELD.get('cover-letter'), 'cover_letter')
        self.assertEqual(DOCUMENT_KIND_TO_FIELD.get('cover_letter'), 'cover_letter')

    def test_generate_notice_endpoint_creates_pdf_and_issues_certificate(self):
        """Admin can trigger generate_notice which creates the PDF and marks certificate_issued=True."""
        self.client.force_authenticate(user=self.admin)
        url = f'/api/submissions/{self.submission.public_id}/generate_notice/'
        payload = {
            'author': 'Author One',
            'title': 'Advances in Neural Networks and Optimization',
            'heading': 'Official Publication Certificate',
        }
        res = self.client.post(url, data=payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.submission.refresh_from_db()
        self.assertTrue(self.submission.certificate_issued)
        self.assertTrue(bool(self.submission.certificate_file))

        # Check serialized representation includes documents/notice/
        cert_url = res.data.get('certificate_file')
        self.assertIsNotNone(cert_url)
        self.assertIn('/documents/notice/', cert_url)

    def test_admin_download_notice_and_certificate(self):
        """Admin can download the generated notice via both 'notice' and 'certificate' slugs."""
        # Generate notice first
        self.client.force_authenticate(user=self.admin)
        gen_url = f'/api/submissions/{self.submission.public_id}/generate_notice/'
        self.client.post(gen_url, data={}, format='json')
        self.submission.refresh_from_db()

        # Download via /documents/notice/
        url_notice = f'/api/submissions/{self.submission.public_id}/documents/notice/'
        res_notice = self.client.get(url_notice)
        self.assertEqual(res_notice.status_code, status.HTTP_200_OK)
        self.assertEqual(res_notice['Content-Type'], 'application/pdf')
        self.assertIn('attachment;', res_notice['Content-Disposition'])

        # Download via /documents/certificate/ alias
        url_cert = f'/api/submissions/{self.submission.public_id}/documents/certificate/'
        res_cert = self.client.get(url_cert)
        self.assertEqual(res_cert.status_code, status.HTTP_200_OK)
        self.assertEqual(res_cert['Content-Type'], 'application/pdf')

    def test_author_access_controlled_by_certificate_issued(self):
        """Author cannot download notice before it is issued; can download once issued."""
        # Attach a dummy file directly without issuing
        dummy_cert = SimpleUploadedFile('cert.pdf', b'%PDF-1.4 cert', content_type='application/pdf')
        self.submission.certificate_file = dummy_cert
        self.submission.certificate_issued = False
        self.submission.save(update_fields=['certificate_file', 'certificate_issued'])

        self.client.force_authenticate(user=self.author)
        url = f'/api/submissions/{self.submission.public_id}/documents/notice/'
        
        # Before issued: 404
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

        # After issued: 200
        self.submission.certificate_issued = True
        self.submission.save(update_fields=['certificate_issued'])
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_manuscript_download_for_author_and_admin(self):
        """Both author and admin can download manuscript file."""
        url = f'/api/submissions/{self.submission.public_id}/documents/manuscript/'

        # Author can download
        self.client.force_authenticate(user=self.author)
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Admin can download
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Other author cannot download (404 because not in queryset)
        self.client.force_authenticate(user=self.other_user)
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

        # Unauthenticated gets 401
        self.client.logout()
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

