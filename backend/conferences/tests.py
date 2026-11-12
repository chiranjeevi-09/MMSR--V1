from datetime import timedelta
import json
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status

from users.models import User
from core.api import is_valid_public_id
from .models import Conference, ConferenceSubmission
from .serializers import PAID_STATUSES


def make_file(name='paper.pdf', size=1024, content_type='application/pdf'):
    return SimpleUploadedFile(name, b'%PDF-1.4 ' + b'x' * (size - 8), content_type=content_type)


class ConferenceSubmissionTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email='author@test.com', password='pass12345')
        self.other = User.objects.create_user(email='other@test.com', password='pass12345')
        self.staff = User.objects.create_user(email='admin@test.com', password='pass12345', is_staff=True)
        self.conference = Conference.objects.create(
            title='Test Conference 2099',
            slug='test-conf-2099',
            acronym='TC2099',
            status='Upcoming',
            is_accepting_submissions=True,
            submission_deadline=timezone.localdate() + timedelta(days=30),
            tracks=[{'id': 'ai', 'title': 'Artificial Intelligence', 'topics': []}],
        )

    def _payload(self, **overrides):
        data = {
            'conference': self.conference.id,
            'client_reference': f'cr-{id(self)}-{overrides.get("title", "x")}',
            'title': 'A Study of Test Methodology',
            'abstract': 'This is an abstract that is definitely long enough to satisfy the fifty character minimum requirement.',
            'keywords': 'testing, quality',
            'paper_type': 'Full Paper',
            'selected_track': 'ai',
            'author_full_name': 'Test Author',
            'author_email': 'author@test.com',
            'author_phone': '9876543210',
            'institution': 'Test University',
            'country': 'India',
            'manuscript_file': make_file(),
            'declarations': json.dumps({
                'originalWork': True, 'notSubmittedElsewhere': True, 'allAuthorsApproved': True,
                'agreeToPeerReview': True, 'agreeToEthics': True, 'agreeToCopyright': True,
                'authorWillPresent': True,
            }),
            'co_authors': json.dumps([{'full_name': 'Co Author One', 'email': 'co@test.com', 'institution': 'X'}]),
        }
        data.update(overrides)
        return data

    # 1. valid submission saved + 12 initial status + 13 standardized reference
    def test_valid_submission_is_created(self):
        self.client.force_authenticate(self.user)
        res = self.client.post('/api/conference-submissions/', self._payload(), format='multipart')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        sub = ConferenceSubmission.objects.get(id=res.data['id'])
        self.assertEqual(sub.status, 'submitted')
        # spec §11: the legacy CONF-{year}-{pk} reference (calendar year + PK
        # leak) is replaced by the standardized CPS public ID, mirrored into the
        # legacy reference_number column so every existing display path is safe.
        self.assertTrue(is_valid_public_id(sub.reference_number))
        self.assertTrue(sub.reference_number.startswith('MMSR-CPS-1931-'))
        self.assertEqual(sub.reference_number, sub.public_id)
        # normalized authors: corresponding (#1) + one co-author (#2)
        authors = list(sub.authors.all())
        self.assertEqual(len(authors), 2)
        self.assertTrue(authors[0].is_corresponding)
        self.assertEqual(authors[0].order, 1)

    # 2. required field missing
    def test_missing_required_field_rejected(self):
        self.client.force_authenticate(self.user)
        res = self.client.post('/api/conference-submissions/', self._payload(title=''), format='multipart')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    # 2b. regression: a normally formatted phone must NOT 400 (the form's own
    # placeholder invites "+91 98765 43210"); it is normalized to 10 digits.
    def test_formatted_phone_is_normalized_and_accepted(self):
        self.client.force_authenticate(self.user)
        for raw in ('+91 98765 43210', '98765-43210', '09876543210', '9876543210', '+919876543210'):
            with self.subTest(raw=raw):
                res = self.client.post(
                    '/api/conference-submissions/',
                    self._payload(author_phone=raw,
                                  client_reference=f'phone-{raw}'),
                    format='multipart',
                )
                self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
                sub = ConferenceSubmission.objects.get(id=res.data['id'])
                self.assertEqual(sub.author_phone, '9876543210')

    # 2c. a clearly invalid phone is still rejected with a readable message
    def test_invalid_phone_rejected(self):
        self.client.force_authenticate(self.user)
        res = self.client.post('/api/conference-submissions/', self._payload(author_phone='123'), format='multipart')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('author_phone', res.data)

    # 3. closed conference rejected
    def test_closed_conference_rejected(self):
        self.client.force_authenticate(self.user)
        self.conference.is_accepting_submissions = False
        self.conference.save()
        res = self.client.post('/api/conference-submissions/', self._payload(), format='multipart')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('conference', res.data)

    # (bonus) past-deadline conference rejected
    def test_past_deadline_rejected(self):
        self.client.force_authenticate(self.user)
        self.conference.submission_deadline = timezone.localdate() - timedelta(days=1)
        self.conference.save()
        res = self.client.post('/api/conference-submissions/', self._payload(), format='multipart')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    # 4. invalid conference id
    def test_invalid_conference_id_rejected(self):
        self.client.force_authenticate(self.user)
        res = self.client.post('/api/conference-submissions/', self._payload(conference=999999), format='multipart')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    # 5. invalid track
    def test_invalid_track_rejected(self):
        self.client.force_authenticate(self.user)
        res = self.client.post('/api/conference-submissions/', self._payload(selected_track='nonexistent'), format='multipart')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('selected_track', res.data)

    # 6. unsupported file type
    def test_unsupported_file_rejected(self):
        self.client.force_authenticate(self.user)
        data = self._payload(manuscript_file=make_file(name='evil.exe', content_type='application/octet-stream'))
        res = self.client.post('/api/conference-submissions/', data, format='multipart')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('manuscript_file', res.data)

    # 7. oversize file
    def test_oversize_file_rejected(self):
        self.client.force_authenticate(self.user)
        data = self._payload(manuscript_file=make_file(size=11 * 1024 * 1024))
        res = self.client.post('/api/conference-submissions/', data, format='multipart')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('manuscript_file', res.data)

    # 8. unauthenticated submission blocked
    def test_anonymous_cannot_submit(self):
        res = self.client.post('/api/conference-submissions/', self._payload(), format='multipart')
        self.assertIn(res.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    # 8b. unauthenticated listing blocked
    def test_anonymous_cannot_list_submissions(self):
        res = self.client.get('/api/conference-submissions/')
        self.assertIn(res.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    # 9. cannot view another user's submission
    def test_cross_user_detail_not_found(self):
        self.client.force_authenticate(self.user)
        created = self.client.post('/api/conference-submissions/', self._payload(), format='multipart')
        sub_id = created.data['id']
        self.client.force_authenticate(self.other)
        res = self.client.get(f'/api/conference-submissions/{sub_id}/')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    # 10. duplicate client_reference does not create a second row
    def test_idempotency_no_duplicate(self):
        self.client.force_authenticate(self.user)
        payload = self._payload(client_reference='dup-key-1')
        first = self.client.post('/api/conference-submissions/', payload, format='multipart')
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        second = self.client.post('/api/conference-submissions/', payload, format='multipart')
        self.assertIn(second.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED))
        self.assertEqual(ConferenceSubmission.objects.filter(client_reference='dup-key-1').count(), 1)

    # 11. manuscript stored privately + served only via authorized download
    def test_manuscript_is_private_and_owner_can_download(self):
        self.client.force_authenticate(self.user)
        res = self.client.post('/api/conference-submissions/', self._payload(), format='multipart')
        sub = ConferenceSubmission.objects.get(id=res.data['id'])
        self.assertTrue(str(sub.manuscript_file.name).startswith('conference_submissions/manuscripts/'))
        # read serializer must not expose a public media url for the manuscript
        self.assertNotIn('manuscript_file', res.data)
        # owner download works
        dl = self.client.get(f'/api/conference-submissions/{sub.id}/manuscript/')
        self.assertEqual(dl.status_code, status.HTTP_200_OK)
        # anonymous download blocked
        self.client.logout()
        anon = self.client.get(f'/api/conference-submissions/{sub.id}/manuscript/')
        self.assertIn(anon.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    # 14. admin can create a conference via API; anonymous cannot
    def test_conference_write_requires_admin(self):
        self.client.force_authenticate(self.staff)
        res = self.client.post('/api/conferences/', {
            'title': 'Admin Created Conference', 'acronym': 'AC2099', 'status': 'Upcoming',
            'is_accepting_submissions': True,
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.client.force_authenticate(None)
        anon = self.client.post('/api/conferences/', {'title': 'Nope'}, format='json')
        self.assertIn(anon.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    # public list + accepting filter
    def test_public_conference_list_and_accepting_filter(self):
        self.conference.is_accepting_submissions = False
        self.conference.save()
        res = self.client.get('/api/conferences/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        acc = self.client.get('/api/conferences/?accepting=true')
        self.assertEqual(acc.status_code, status.HTTP_200_OK)
        ids = [c['id'] for c in acc.data] if isinstance(acc.data, list) else [c['id'] for c in acc.data['results']]
        self.assertNotIn(self.conference.id, ids)


class ConferencePaymentTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email='payer@test.com', password='pass12345')
        self.staff = User.objects.create_user(email='staff@test.com', password='pass12345', is_staff=True)
        self.paid_conference = Conference.objects.create(
            title='Paid Conference 2099',
            slug='paid-conf-2099',
            acronym='PC2099',
            status='Upcoming',
            is_accepting_submissions=True,
            submission_deadline=timezone.localdate() + timedelta(days=30),
            submission_fee=500,
        )

    def _payload(self, **overrides):
        data = {
            'conference': self.paid_conference.id,
            'client_reference': f'pay-cr-{overrides.get("title", "x")}',
            'title': 'Payment Gated Paper Title',
            'abstract': 'This abstract comfortably exceeds the fifty character minimum for payment testing purposes.',
            'keywords': 'payments, testing',
            'author_full_name': 'Payer Author',
            'author_email': 'payer@test.com',
            'author_phone': '9876543210',
            'institution': 'Pay University',
            'country': 'India',
            'manuscript_file': make_file(),
        }
        data.update(overrides)
        return data

    def _create(self, **overrides):
        self.client.force_authenticate(self.user)
        res = self.client.post('/api/conference-submissions/', self._payload(**overrides), format='multipart')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        return res.data

    # fee > 0 → submission is held as pending_payment with a fee snapshot
    def test_paid_conference_creates_pending_payment(self):
        data = self._create()
        self.assertEqual(data['status'], 'pending_payment')
        self.assertEqual(float(data['submission_fee']), 500.0)
        self.assertFalse(data['has_invoice'])

    # fee = 0 → straight to submitted (no payment gate)
    def test_free_conference_submits_directly(self):
        self.paid_conference.submission_fee = 0
        self.paid_conference.save()
        data = self._create()
        self.assertEqual(data['status'], 'submitted')
        self.assertEqual(float(data['submission_fee']), 0.0)

    # initiate-payment refuses non-pending submissions
    def test_initiate_payment_rejects_paid_submission(self):
        self.paid_conference.submission_fee = 0
        self.paid_conference.save()
        data = self._create()
        res = self.client.post(f'/api/conference-submissions/{data["id"]}/initiate-payment/')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    # verify-payment requires all three gateway params
    def test_verify_payment_missing_params(self):
        data = self._create()
        res = self.client.post(f'/api/conference-submissions/{data["id"]}/verify-payment/', {}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    # verify-payment rejects a payment id already used on another submission
    def test_verify_payment_duplicate_id(self):
        first = self._create(client_reference='dup-pay-1', title='First Paid Paper')
        second = self._create(client_reference='dup-pay-2', title='Second Paid Paper')
        sub = ConferenceSubmission.objects.get(id=first['id'])
        sub.razorpay_payment_id = 'pay_used_once'
        sub.save()
        res = self.client.post(f'/api/conference-submissions/{second["id"]}/verify-payment/', {
            'razorpay_payment_id': 'pay_used_once',
            'razorpay_order_id': 'order_x',
            'razorpay_signature': 'sig_x',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already been used', res.data.get('error', ''))

    # simulate-payment is hard-gated (DEBUG=False during tests)
    def test_simulate_payment_blocked_outside_debug(self):
        data = self._create()
        res = self.client.post(f'/api/conference-submissions/{data["id"]}/simulate-payment/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    # simulate-payment (DEBUG + test keys) finalizes + generates invoice
    @override_settings(DEBUG=True, RAZORPAY_KEY_ID='rzp_test_dummy', RAZORPAY_KEY_SECRET='dummy')
    def test_simulate_payment_finalizes_and_generates_invoice(self):
        data = self._create()
        res = self.client.post(f'/api/conference-submissions/{data["id"]}/simulate-payment/')
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        sub = ConferenceSubmission.objects.get(id=data['id'])
        self.assertEqual(sub.status, 'submitted')
        self.assertTrue(sub.razorpay_payment_id.startswith('pay_sim_'))
        self.assertTrue(sub.invoice_pdf, 'invoice PDF should be generated')

        # owner can download the invoice
        dl = self.client.get(f'/api/conference-submissions/{sub.id}/invoice/')
        self.assertEqual(dl.status_code, status.HTTP_200_OK)

        # conference revenue fields reflect the paid submission
        conf_res = self.client.get(f'/api/conferences/{self.paid_conference.id}/')
        self.assertEqual(conf_res.data['submissions_count'], 1)
        self.assertEqual(float(conf_res.data['total_collected']), 500.0)

    # delete rules: owner only while pending_payment; staff anytime
    def test_delete_rules(self):
        pending = self._create()
        res = self.client.delete(f'/api/conference-submissions/{pending["id"]}/')
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(ConferenceSubmission.objects.filter(id=pending['id']).exists())

        self.paid_conference.submission_fee = 0
        self.paid_conference.save()
        submitted = self._create(client_reference='no-del-1', title='Not Deletable Paper')
        blocked = self.client.delete(f'/api/conference-submissions/{submitted["id"]}/')
        self.assertEqual(blocked.status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(self.staff)
        allowed = self.client.delete(f'/api/conference-submissions/{submitted["id"]}/')
        self.assertEqual(allowed.status_code, status.HTTP_204_NO_CONTENT)

    # admin-update: staff-only, can move workflow status + notes
    def test_admin_update_permissions(self):
        data = self._create()
        non_staff = self.client.patch(f'/api/conference-submissions/{data["id"]}/admin-update/',
                                      {'status': 'under_review'}, format='json')
        self.assertIn(non_staff.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

        self.client.force_authenticate(self.staff)
        # pending_payment rows are not editable
        blocked = self.client.patch(f'/api/conference-submissions/{data["id"]}/admin-update/',
                                    {'status': 'under_review'}, format='json')
        self.assertEqual(blocked.status_code, status.HTTP_400_BAD_REQUEST)

        sub = ConferenceSubmission.objects.get(id=data['id'])
        sub.status = 'submitted'
        sub.save()
        ok = self.client.patch(f'/api/conference-submissions/{data["id"]}/admin-update/',
                               {'status': 'under_review', 'admin_notes': 'looks good'}, format='json')
        self.assertEqual(ok.status_code, status.HTTP_200_OK, ok.data)
        sub.refresh_from_db()
        self.assertEqual(sub.status, 'under_review')
        self.assertEqual(sub.admin_notes, 'looks good')

    # unauthenticated users cannot touch payment endpoints
    def test_payment_endpoints_require_auth(self):
        self.client.force_authenticate(self.user)
        data = self._create()
        self.client.force_authenticate(None)
        for path in ('initiate-payment', 'verify-payment', 'simulate-payment'):
            res = self.client.post(f'/api/conference-submissions/{data["id"]}/{path}/')
            self.assertIn(res.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN), path)


@override_settings(RAZORPAY_KEY_ID='rzp_test_LEAK', RAZORPAY_KEY_SECRET='leak-secret')
class ConferencePaymentErrorLeakTests(APITestCase):
    """Insecure-defaults audit finding 1 (debug leakage).

    Both conference payment endpoints used to return the raw Razorpay SDK
    exception text in their 400 body. Razorpay's payload can echo
    payment-entity internals, and these routes are reachable by any
    authenticated caller holding a submission id — so the message must be
    logged server-side and replaced with a generic client-facing error.
    """

    def setUp(self):
        self.user = User.objects.create_user(email='leak-payer@test.com', password='pass12345')
        self.conference = Conference.objects.create(
            title='Leak Gate Conference 2099',
            slug='leak-gate-conf-2099',
            acronym='LG2099',
            status='Upcoming',
            is_accepting_submissions=True,
            submission_deadline=timezone.localdate() + timedelta(days=30),
            submission_fee=500,
        )

    def _pending_submission(self, ref):
        """Create a fee-held submission; returns its id. Caller stays authenticated."""
        res = self.client.post('/api/conference-submissions/', {
            'conference': self.conference.id,
            'client_reference': ref,
            'title': 'Leak Probe Paper',
            'abstract': 'An abstract comfortably exceeding the fifty character minimum for leak testing.',
            'keywords': 'security, testing',
            'author_full_name': 'Leak Payer',
            'author_email': 'leak-payer@test.com',
            'author_phone': '9876543210',
            'institution': 'Leak University',
            'country': 'India',
            'manuscript_file': make_file(),
        }, format='multipart')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        return res.data['id']

    @patch('conferences.views.razorpay.Client')
    def test_initiate_payment_failure_leaks_no_gateway_text(self, mock_client):
        mock_client.return_value.order.create.side_effect = Exception('conf-order-internals-7z4')
        self.client.force_authenticate(self.user)
        sid = self._pending_submission('leak-init-1')
        res = self.client.post(f'/api/conference-submissions/{sid}/initiate-payment/')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertNotIn('conf-order-internals-7z4', str(res.data))

    @patch('conferences.views.razorpay.Client')
    def test_verify_payment_failure_leaks_no_gateway_text(self, mock_client):
        mock_client.return_value.utility.verify_payment_signature.side_effect = Exception('conf-verify-internals-8q2')
        self.client.force_authenticate(self.user)
        sid = self._pending_submission('leak-ver-1')
        res = self.client.post(f'/api/conference-submissions/{sid}/verify-payment/', {
            'razorpay_order_id': 'order_leak',
            'razorpay_payment_id': 'pay_leak',
            'razorpay_signature': 'sig_leak',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertNotIn('conf-verify-internals-8q2', str(res.data))
        # Rejected verification must never flip the submission to paid.
        sub = ConferenceSubmission.objects.get(pk=sid)
        self.assertEqual(sub.status, 'pending_payment')


class ConferenceProtectedDownloadsTests(APITestCase):
    """Phase 11G verification: conference manuscript and invoice downloads use protected_file_response."""

    def setUp(self):
        self.owner = User.objects.create_user(email='conf-owner@test.com', password='pass12345')
        self.other = User.objects.create_user(email='conf-other@test.com', password='pass12345')
        self.staff = User.objects.create_user(email='conf-admin@test.com', password='pass12345', is_staff=True)
        self.conference = Conference.objects.create(
            title='Downloads Test Conf 2099',
            slug='downloads-test-conf-2099',
            acronym='DTC2099',
            status='Upcoming',
            is_accepting_submissions=True,
            submission_deadline=timezone.localdate() + timedelta(days=30),
            submission_fee=0,
        )
        self.submission = ConferenceSubmission.objects.create(
            conference=self.conference,
            submitted_by=self.owner,
            client_reference='test-dl-ref-001',
            title='Protected Download Paper',
            abstract='A sufficiently long abstract for verifying protected file responses.',
            keywords='downloads, security',
            author_full_name='Owner Author',
            author_email='conf-owner@test.com',
            author_phone='9876543210',
            institution='Download University',
            country='India',
            status='accepted',
        )

    def test_download_manuscript_missing_returns_404(self):
        self.client.force_authenticate(self.owner)
        res = self.client.get(f'/api/conference-submissions/{self.submission.id}/manuscript/')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_download_manuscript_owner_success(self):
        from django.core.files.base import ContentFile
        self.submission.manuscript_file.save('test_paper.pdf', ContentFile(b'%PDF-1.4 sample content'))
        self.submission.save()

        self.client.force_authenticate(self.owner)
        res = self.client.get(f'/api/conference-submissions/{self.submission.id}/manuscript/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('attachment;', res.get('Content-Disposition', ''))
        self.assertIn('.pdf', res.get('Content-Disposition', ''))

    def test_download_manuscript_unauthorized_user_fails(self):
        from django.core.files.base import ContentFile
        self.submission.manuscript_file.save('test_paper.pdf', ContentFile(b'%PDF-1.4 sample content'))
        self.submission.save()

        self.client.force_authenticate(self.other)
        res = self.client.get(f'/api/conference-submissions/{self.submission.id}/manuscript/')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    @override_settings(USE_X_ACCEL_REDIRECT=True)
    def test_download_manuscript_x_accel_redirect_in_production(self):
        from django.core.files.base import ContentFile
        self.submission.manuscript_file.save('test_paper.pdf', ContentFile(b'%PDF-1.4 sample content'))
        self.submission.save()

        self.client.force_authenticate(self.owner)
        res = self.client.get(f'/api/conference-submissions/{self.submission.id}/manuscript/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.has_header('X-Accel-Redirect'))
        self.assertTrue(res['X-Accel-Redirect'].startswith('/protected_media_internal/'))

    def test_download_invoice_owner_success(self):
        from django.core.files.base import ContentFile
        self.submission.invoice_pdf.save('test_inv.pdf', ContentFile(b'%PDF-1.4 invoice sample'))
        self.submission.save()

        self.client.force_authenticate(self.owner)
        res = self.client.get(f'/api/conference-submissions/{self.submission.id}/invoice/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res['Content-Type'], 'application/pdf')
        self.assertIn('attachment;', res['Content-Disposition'])

    def test_download_invoice_generates_on_demand_if_missing_for_paid_submission(self):
        """Audit safety verification: If a paid submission has not yet had its invoice PDF
        generated (or previous generation had an issue), calling download_invoice creates
        the invoice PDF on demand instead of failing with 404."""
        self.submission.status = 'submitted'
        self.submission.razorpay_payment_id = 'pay_conf_sample_123'
        self.submission.invoice_pdf = None
        self.submission.save()

        self.client.force_authenticate(self.owner)
        res = self.client.get(f'/api/conference-submissions/{self.submission.id}/invoice/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.submission.refresh_from_db()
        self.assertTrue(bool(self.submission.invoice_pdf))

    def test_download_invoice_unpaid_submission_returns_404(self):
        """Unpaid submission (pending_payment) without invoice must return 404."""
        self.submission.status = 'pending_payment'
        self.submission.invoice_pdf = None
        self.submission.save()

        self.client.force_authenticate(self.owner)
        res = self.client.get(f'/api/conference-submissions/{self.submission.id}/invoice/')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_download_invoice_never_sends_email(self):
        """Invoice download must NOT trigger an unexpected email dispatch."""
        from django.core import mail
        mail.outbox = []

        self.submission.status = 'submitted'
        self.submission.razorpay_payment_id = 'pay_conf_sample_456'
        self.submission.invoice_pdf = None
        self.submission.save()

        self.client.force_authenticate(self.owner)
        res = self.client.get(f'/api/conference-submissions/{self.submission.id}/invoice/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        # Mail outbox must remain empty - downloading must never send an email!
        self.assertEqual(len(mail.outbox), 0)

    def test_download_invoice_repeated_requests_are_idempotent(self):
        """Repeated GET requests must serve the existing invoice without recreating it."""
        self.submission.status = 'submitted'
        self.submission.razorpay_payment_id = 'pay_conf_sample_789'
        self.submission.invoice_pdf = None
        self.submission.save()

        self.client.force_authenticate(self.owner)
        res1 = self.client.get(f'/api/conference-submissions/{self.submission.id}/invoice/')
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.submission.refresh_from_db()
        first_invoice_name = self.submission.invoice_pdf.name

        # Second download request
        res2 = self.client.get(f'/api/conference-submissions/{self.submission.id}/invoice/')
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.submission.refresh_from_db()
        self.assertEqual(self.submission.invoice_pdf.name, first_invoice_name)

    def test_download_invoice_concurrent_or_repeated_calls_generate_only_once(self):
        """Concurrent or repeated download requests must lock and generate the invoice
        at most once, with send_email=False, and serve the resulting file to both."""
        from unittest.mock import patch
        self.submission.status = 'submitted'
        self.submission.razorpay_payment_id = 'pay_conf_concurrent_1'
        self.submission.invoice_pdf = None
        self.submission.save()

        with patch('conferences.views.ConferenceSubmission.objects.select_for_update', wraps=ConferenceSubmission.objects.select_for_update) as mock_sfu:
            self.client.force_authenticate(self.owner)
            res1 = self.client.get(f'/api/conference-submissions/{self.submission.id}/invoice/')
            self.assertEqual(res1.status_code, status.HTTP_200_OK)
            self.submission.refresh_from_db()
            inv_name = self.submission.invoice_pdf.name

            # Second request: record is already locked/populated, must serve existing
            res2 = self.client.get(f'/api/conference-submissions/{self.submission.id}/invoice/')
            self.assertEqual(res2.status_code, status.HTTP_200_OK)
            self.submission.refresh_from_db()
            self.assertEqual(self.submission.invoice_pdf.name, inv_name)
            self.assertTrue(mock_sfu.called)
