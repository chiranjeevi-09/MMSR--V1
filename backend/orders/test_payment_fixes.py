import hmac
import hashlib
import json
from decimal import Decimal
from unittest.mock import patch, MagicMock

from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from orders.models import Order, OrderItem
from orders.job_models import InvoiceJob
from publications.models import Category, Journal, JournalIssue, JournalArticle, UserJournalAccess

User = get_user_model()

TEST_WEBHOOK_SECRET = 'test_webhook_secret_key_12345'


@override_settings(
    RAZORPAY_KEY_ID='rzp_test_Tao8dWsQ8CcnzA',
    RAZORPAY_KEY_SECRET='m5cuo9TSxQUM3zQscg6ZAxPw',
    RAZORPAY_WEBHOOK_SECRET=TEST_WEBHOOK_SECRET,
)
class PaymentSecurityFixesTests(TestCase):
    """Exhaustive test suite verifying the two payment security fixes:
      - PAY-01: Secure Razorpay Webhook integration (cases 1-5, 8-10)
      - PAY-02: Transaction-safe, idempotent verification (cases 6-7)
    """

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='author.payment@example.com',
            password='testpassword123',
            first_name='Author',
            last_name='Tester'
        )
        self.category = Category.objects.create(
            name='Computer Science',
            slug='comp-sci',
            category_type='journals'
        )
        self.journal = Journal.objects.create(
            title='Journal of Advanced AI',
            slug='journal-adv-ai',
            issn='2456-7890',
            category=self.category,
            subscription_price_annual=Decimal('1000.00'),
            access_type='Subscription'
        )
        self.order = Order.objects.create(
            user=self.user,
            full_name='Author Tester',
            email='author.payment@example.com',
            phone_number='9876543210',
            shipping_address='123 Tech Park',
            city='Bangalore',
            state='Karnataka',
            postal_code='560001',
            country='India',
            total_amount=Decimal('1000.00'),
            status='pending',
            razorpay_order_id='order_test_998877'
        )
        OrderItem.objects.create(
            order=self.order,
            journal_subscription=self.journal,
            quantity=1,
            price=Decimal('1000.00'),
            format='digital'
        )

    def _generate_webhook_headers(self, raw_bytes, secret=TEST_WEBHOOK_SECRET):
        sig = hmac.new(
            secret.encode('utf-8'),
            raw_bytes,
            hashlib.sha256
        ).hexdigest()
        return {'HTTP_X_RAZORPAY_SIGNATURE': sig}

    def _make_webhook_payload(self, event, payment_id='pay_test_123', amount=100000,
                             currency='INR', rzp_order_id='order_test_998877',
                             status='captured', error_desc=None):
        payload = {
            "entity": "event",
            "account_id": "acc_test_mmsr",
            "event": event,
            "contains": ["payment"],
            "payload": {
                "payment": {
                    "entity": {
                        "id": payment_id,
                        "entity": "payment",
                        "amount": amount,
                        "currency": currency,
                        "status": status,
                        "order_id": rzp_order_id,
                        "method": "upi",
                    }
                },
                "order": {
                    "entity": {
                        "id": rzp_order_id,
                        "amount": amount,
                        "currency": currency,
                        "status": "paid" if status == 'captured' else 'attempted',
                        "receipt": f"receipt_order_{self.order.id}"
                    }
                }
            }
        }
        if error_desc:
            payload['payload']['payment']['entity']['error_description'] = error_desc
        return json.dumps(payload).encode('utf-8')

    # ─────────────────────────────────────────────────────────────────────────
    # 1. Valid successful payment via webhook
    # ─────────────────────────────────────────────────────────────────────────
    @patch('orders.webhook_views.generate_invoice')
    def test_1_valid_successful_payment_via_webhook(self, mock_gen_invoice):
        raw_body = self._make_webhook_payload('payment.captured', payment_id='pay_test_001')
        headers = self._generate_webhook_headers(raw_body)

        response = self.client.post(
            '/api/commerce/webhook/',
            raw_body,
            content_type='application/json',
            **headers
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'paid')
        self.assertEqual(self.order.razorpay_payment_id, 'pay_test_001')
        self.assertTrue(UserJournalAccess.objects.filter(user=self.user, journal=self.journal).exists())
        # Outbox job created for background invoice/email processing
        self.assertTrue(InvoiceJob.objects.filter(order=self.order).exists())

    # ─────────────────────────────────────────────────────────────────────────
    # 2. Invalid webhook signature rejected
    # ─────────────────────────────────────────────────────────────────────────
    def test_2_invalid_webhook_signature_rejected(self):
        raw_body = self._make_webhook_payload('payment.captured', payment_id='pay_test_002')
        # Generate with wrong secret
        headers = self._generate_webhook_headers(raw_body, secret='wrong_secret_attacker')

        response = self.client.post(
            '/api/commerce/webhook/',
            raw_body,
            content_type='application/json',
            **headers
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'pending')

    # ─────────────────────────────────────────────────────────────────────────
    # 3. Repeated identical webhook event is completely idempotent
    # ─────────────────────────────────────────────────────────────────────────
    @patch('orders.webhook_views.generate_invoice')
    def test_3_repeated_identical_webhook_event_is_idempotent(self, mock_gen_invoice):
        raw_body = self._make_webhook_payload('payment.captured', payment_id='pay_test_003')
        headers = self._generate_webhook_headers(raw_body)

        # First delivery
        res1 = self.client.post('/api/commerce/webhook/', raw_body, content_type='application/json', **headers)
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.assertEqual(InvoiceJob.objects.filter(order=self.order).count(), 1)

        # Second delivery (Razorpay webhook retry)
        res2 = self.client.post('/api/commerce/webhook/', raw_body, content_type='application/json', **headers)
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.data.get('message'), "Order was already paid")

        # Invoice job must not be duplicated
        self.assertEqual(InvoiceJob.objects.filter(order=self.order).count(), 1)
        self.assertEqual(UserJournalAccess.objects.filter(user=self.user, journal=self.journal).count(), 1)

    # ─────────────────────────────────────────────────────────────────────────
    # 4. Successful payment followed by browser closure before frontend verify
    # ─────────────────────────────────────────────────────────────────────────
    @patch('orders.webhook_views.generate_invoice')
    def test_4_browser_closed_before_frontend_verify_resolved_by_webhook(self, mock_gen_invoice):
        # Order is pending in database; browser crashed/closed immediately after Razorpay charge
        self.assertEqual(self.order.status, 'pending')

        # Asynchronous server-to-server webhook arrives from Razorpay
        raw_body = self._make_webhook_payload('order.paid', payment_id='pay_test_004')
        headers = self._generate_webhook_headers(raw_body)

        res = self.client.post('/api/commerce/webhook/', raw_body, content_type='application/json', **headers)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'paid')
        self.assertEqual(self.order.transaction_id, 'pay_test_004')
        # Digital access granted despite browser closure
        self.assertTrue(UserJournalAccess.objects.filter(user=self.user, journal=self.journal).exists())
        self.assertTrue(InvoiceJob.objects.filter(order=self.order).exists())

    # ─────────────────────────────────────────────────────────────────────────
    # 5. Failed payment event handled safely without marking order paid
    # ─────────────────────────────────────────────────────────────────────────
    def test_5_failed_payment_event_does_not_mark_order_paid(self):
        raw_body = self._make_webhook_payload(
            'payment.failed',
            payment_id='pay_test_005',
            status='failed',
            error_desc='Customer bank declined transaction'
        )
        headers = self._generate_webhook_headers(raw_body)

        res = self.client.post('/api/commerce/webhook/', raw_body, content_type='application/json', **headers)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data.get('status'), 'acknowledged')

        self.order.refresh_from_db()
        self.assertNotEqual(self.order.status, 'paid')
        self.assertEqual(self.order.status, 'pending')

    # ─────────────────────────────────────────────────────────────────────────
    # 6. Two simultaneous verification requests for the same order (PAY-02)
    # ─────────────────────────────────────────────────────────────────────────
    @patch('orders.views.generate_invoice')
    @patch('orders.views.razorpay.Client')
    def test_6_concurrent_verification_requests_idempotent(self, mock_rzp_client, mock_gen_invoice):
        mock_instance = MagicMock()
        mock_rzp_client.return_value = mock_instance
        mock_instance.utility.verify_payment_signature.return_value = True
        mock_instance.payment.fetch.return_value = {
            'amount': 100000,
            'currency': 'INR',
            'status': 'captured'
        }

        self.client.force_authenticate(user=self.user)
        verify_payload = {
            'razorpay_order_id': 'order_test_998877',
            'razorpay_payment_id': 'pay_test_006',
            'razorpay_signature': 'valid_sig_test_006'
        }

        # Request 1
        res1 = self.client.post(f'/api/commerce/{self.order.id}/verify_razorpay/', verify_payload)
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'paid')

        # Request 2 (Concurrent or immediate re-submit)
        res2 = self.client.post(f'/api/commerce/{self.order.id}/verify_razorpay/', verify_payload)
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.data.get('message'), "Payment already verified")

        # Invoice job must only be created once
        self.assertEqual(InvoiceJob.objects.filter(order=self.order).count(), 1)

    # ─────────────────────────────────────────────────────────────────────────
    # 7. Repeated verification after order is already paid
    # ─────────────────────────────────────────────────────────────────────────
    @patch('orders.views.generate_invoice')
    @patch('orders.views.razorpay.Client')
    def test_7_repeated_verification_after_already_paid(self, mock_rzp_client, mock_gen_invoice):
        # Manually set order as paid
        self.order.status = 'paid'
        self.order.razorpay_payment_id = 'pay_existing_007'
        self.order.save()

        self.client.force_authenticate(user=self.user)
        verify_payload = {
            'razorpay_order_id': 'order_test_998877',
            'razorpay_payment_id': 'pay_existing_007',
            'razorpay_signature': 'valid_sig_007'
        }

        res = self.client.post(f'/api/commerce/{self.order.id}/verify_razorpay/', verify_payload)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data.get('message'), "Payment already verified")
        mock_gen_invoice.assert_not_called()

    # ─────────────────────────────────────────────────────────────────────────
    # 8. Incorrect payment amount rejected
    # ─────────────────────────────────────────────────────────────────────────
    def test_8_incorrect_payment_amount_rejected(self):
        # Amount 5000 paise (Rs. 50) instead of 100000 paise (Rs. 1000)
        raw_body = self._make_webhook_payload('payment.captured', payment_id='pay_test_008', amount=5000)
        headers = self._generate_webhook_headers(raw_body)

        res = self.client.post('/api/commerce/webhook/', raw_body, content_type='application/json', **headers)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("amount mismatch", res.data.get('error', '').lower())

        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'pending')

    # ─────────────────────────────────────────────────────────────────────────
    # 9. Incorrect currency rejected
    # ─────────────────────────────────────────────────────────────────────────
    def test_9_incorrect_currency_rejected(self):
        raw_body = self._make_webhook_payload('payment.captured', payment_id='pay_test_009', currency='USD')
        headers = self._generate_webhook_headers(raw_body)

        res = self.client.post('/api/commerce/webhook/', raw_body, content_type='application/json', **headers)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("currency mismatch", res.data.get('error', '').lower())

        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'pending')

    # ─────────────────────────────────────────────────────────────────────────
    # 10. Payment belonging to a different order rejected (Replay protection)
    # ─────────────────────────────────────────────────────────────────────────
    def test_10_payment_belonging_to_different_order_rejected(self):
        # Create Order A and mark it paid with payment ID 'pay_used_earlier'
        other_order = Order.objects.create(
            user=self.user,
            full_name='Other Order',
            email='author.payment@example.com',
            total_amount=Decimal('1000.00'),
            status='paid',
            razorpay_payment_id='pay_used_earlier',
            transaction_id='pay_used_earlier'
        )

        # Attempt to submit 'pay_used_earlier' on Order B via webhook
        raw_body = self._make_webhook_payload('payment.captured', payment_id='pay_used_earlier')
        headers = self._generate_webhook_headers(raw_body)

        res = self.client.post('/api/commerce/webhook/', raw_body, content_type='application/json', **headers)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already used", res.data.get('error', '').lower())

        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'pending')

    # ─────────────────────────────────────────────────────────────────────────
    # 11. New Offline Bank Transfer submissions rejected on order creation
    # ─────────────────────────────────────────────────────────────────────────
    def test_11_offline_bank_transfer_rejected_on_order_create(self):
        self.client.force_authenticate(user=self.user)
        payload = {
            'full_name': 'Author Tester',
            'email': 'author.payment@example.com',
            'phone_number': '9876543210',
            'shipping_address': '123 Tech Park',
            'city': 'Bangalore',
            'state': 'Karnataka',
            'postal_code': '560001',
            'country': 'India',
            'payment_method': 'bank_transfer',
            'items': [
                {
                    'journal_subscription': self.journal.id,
                    'quantity': 1,
                    'format': 'digital',
                }
            ]
        }
        res = self.client.post('/api/commerce/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("offline bank transfer is not supported", str(res.data).lower())

    # ─────────────────────────────────────────────────────────────────────────
    # 12. Razorpay payment method accepted on order creation
    # ─────────────────────────────────────────────────────────────────────────
    def test_12_razorpay_order_create_accepted(self):
        self.client.force_authenticate(user=self.user)
        payload = {
            'full_name': 'Author Tester',
            'email': 'author.payment@example.com',
            'phone_number': '9876543210',
            'shipping_address': '123 Tech Park',
            'city': 'Bangalore',
            'state': 'Karnataka',
            'postal_code': '560001',
            'country': 'India',
            'payment_method': 'razorpay',
            'items': [
                {
                    'journal_subscription': self.journal.id,
                    'quantity': 1,
                    'format': 'digital',
                }
            ]
        }
        res = self.client.post('/api/commerce/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['payment_method'], 'razorpay')
