"""Unit tests for Phase 11C: Background Invoice & Email Processing Idempotency."""
from unittest.mock import patch, MagicMock
from decimal import Decimal

from django.test import TestCase
from django.core.files.base import ContentFile
from users.models import User
from orders.models import Order
from orders.tasks import process_order_invoice_and_email


class OrderBackgroundTasksTests(TestCase):
    """Verify background task idempotency, status safety, and error handling."""

    def setUp(self):
        self.user = User.objects.create_user(
            email='buyer@example.com',
            password='Password123!',
            first_name='Test',
            last_name='Buyer'
        )
        self.order = Order.objects.create(
            user=self.user,
            full_name='Test Buyer',
            email='buyer@example.com',
            total_amount=Decimal('500.00'),
            status='paid',
            payment_method='razorpay'
        )

    def test_task_skips_unpaid_order(self):
        """Unpaid order is skipped safely and status is unchanged."""
        self.order.status = 'pending'
        self.order.save()

        result = process_order_invoice_and_email(None, self.order.id)
        self.assertEqual(result['status'], 'skipped')
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'pending')

    def test_task_skips_nonexistent_order(self):
        """Nonexistent order ID returns error status without crashing."""
        result = process_order_invoice_and_email(None, 999999)
        self.assertEqual(result['status'], 'error')

    @patch('orders.utils.send_invoice_email')
    def test_task_generates_invoice_on_first_run(self, mock_email):
        """First execution generates invoice PDF and invokes email."""
        self.assertFalse(bool(self.order.invoice_pdf))
        
        result = process_order_invoice_and_email(None, self.order.id)
        self.assertEqual(result['status'], 'success')
        self.order.refresh_from_db()
        self.assertTrue(bool(self.order.invoice_pdf))

    @patch('orders.utils.send_invoice_email')
    def test_task_is_idempotent_on_subsequent_runs(self, mock_email):
        """Subsequent runs do not overwrite existing invoice PDF."""
        # Attach dummy invoice
        self.order.invoice_pdf.save('test_invoice.pdf', ContentFile(b'%PDF dummy'))
        self.order.save()
        initial_file = self.order.invoice_pdf.name

        result = process_order_invoice_and_email(None, self.order.id, force=False)
        self.assertEqual(result['status'], 'success')
        self.order.refresh_from_db()
        self.assertEqual(self.order.invoice_pdf.name, initial_file)
        # Email sender should not be called again
        mock_email.assert_not_called()

