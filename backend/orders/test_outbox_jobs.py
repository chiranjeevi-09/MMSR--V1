"""Integration tests for Outbox Pattern Invoice & Email background processing."""
import io
import unittest
from unittest.mock import patch, MagicMock
from decimal import Decimal
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.db import transaction

from orders.models import Order
from orders.job_models import InvoiceJob
from orders.tasks import (
    enqueue_invoice_job,
    dispatch_invoice_job,
    _execute_invoice_job,
    recover_pending_jobs,
)

User = get_user_model()


class OutboxInvoiceJobTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='customer@example.com',
            password='TestPassword123!',
            first_name='Test',
            last_name='Customer',
        )
        self.order = Order.objects.create(
            user=self.user,
            total_amount=Decimal('500.00'),
            status='pending',
            email='customer@example.com',
            full_name='Test Customer',
        )

    def test_enqueue_invoice_job_creates_exactly_one_job(self):
        """enqueue_invoice_job should create a job, and subsequent calls should not duplicate it."""
        job1 = enqueue_invoice_job(self.order)
        self.assertEqual(job1.order, self.order)
        self.assertEqual(job1.status, InvoiceJob.STATUS_PENDING)
        self.assertFalse(job1.invoice_generated)
        self.assertFalse(job1.email_sent)

        # Second call for the same order should return the existing job
        job2 = enqueue_invoice_job(self.order)
        self.assertEqual(job1.id, job2.id)
        self.assertEqual(InvoiceJob.objects.filter(order=self.order).count(), 1)

    @patch('orders.tasks.send_invoice_email')
    @patch('orders.tasks.generate_invoice')
    def test_execute_job_success_marks_done(self, mock_gen, mock_send):
        """When invoice generation and email succeed, job is marked done."""
        job = enqueue_invoice_job(self.order)
        self.order.status = 'paid'
        self.order.save()

        # Simulate generate_invoice setting invoice_pdf
        def fake_generate(order, force=False):
            order.invoice_pdf = 'invoices/test_inv.pdf'
            order.save()
            return order

        mock_gen.side_effect = fake_generate

        _execute_invoice_job(job.id)

        job.refresh_from_db()
        self.assertEqual(job.status, InvoiceJob.STATUS_DONE)
        self.assertTrue(job.invoice_generated)
        self.assertTrue(job.email_sent)
        self.assertEqual(job.attempts, 1)
        mock_gen.assert_called_once()
        mock_send.assert_called_once()

    @patch('orders.tasks.send_invoice_email', side_effect=RuntimeError('SMTP error'))
    @patch('orders.tasks.generate_invoice')
    def test_email_failure_does_not_erase_invoice(self, mock_gen, mock_send):
        """Email failure marks job failed but preserves generated invoice."""
        job = enqueue_invoice_job(self.order)
        self.order.status = 'paid'
        self.order.save()

        def fake_generate(order, force=False):
            order.invoice_pdf = 'invoices/test_inv.pdf'
            order.save()
            return order

        mock_gen.side_effect = fake_generate

        _execute_invoice_job(job.id)

        job.refresh_from_db()
        self.assertEqual(job.status, InvoiceJob.STATUS_FAILED)
        self.assertTrue(job.invoice_generated)
        self.assertFalse(job.email_sent)
        self.assertIn('SMTP error', job.last_error)

        # Payment remains intact
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'paid')
        self.assertTrue(bool(self.order.invoice_pdf))

    @patch('orders.tasks.send_invoice_email')
    @patch('orders.tasks.generate_invoice')
    def test_retrying_email_does_not_regenerate_invoice(self, mock_gen, mock_send):
        """If invoice was already generated, retry only sends email."""
        job = enqueue_invoice_job(self.order)
        self.order.status = 'paid'
        self.order.invoice_pdf = 'invoices/existing.pdf'
        self.order.save()

        job.invoice_generated = True
        job.email_sent = False
        job.status = InvoiceJob.STATUS_FAILED
        job.save()

        _execute_invoice_job(job.id)

        job.refresh_from_db()
        self.assertEqual(job.status, InvoiceJob.STATUS_DONE)
        self.assertTrue(job.email_sent)
        # generate_invoice was NEVER called because invoice_generated was already True
        mock_gen.assert_not_called()
        mock_send.assert_called_once()

    @patch('orders.tasks.dispatch_invoice_job')
    def test_recover_pending_jobs(self, mock_dispatch):
        """recover_pending_jobs picks up pending/failed jobs based on updated_at cooldown."""
        job = enqueue_invoice_job(self.order)
        import datetime
        from django.utils import timezone
        old_time = timezone.now() - datetime.timedelta(seconds=120)
        InvoiceJob.objects.filter(id=job.id).update(created_at=old_time, updated_at=old_time)

        dispatched = recover_pending_jobs(older_than_seconds=60, max_attempts=5)
        self.assertEqual(dispatched, 1)
        mock_dispatch.assert_called_once_with(job.id)

    @patch('orders.tasks.dispatch_invoice_job')
    def test_recently_failed_job_with_old_created_at_not_dispatched(self, mock_dispatch):
        """Scenario 1: Job created 2h ago and failed 30s ago must NOT bypass 60s cooldown."""
        import datetime
        from django.utils import timezone
        now = timezone.now()
        job = enqueue_invoice_job(self.order)
        job.status = InvoiceJob.STATUS_FAILED
        job.attempts = 1
        job.save()
        created_two_hours_ago = now - datetime.timedelta(hours=2)
        failed_thirty_seconds_ago = now - datetime.timedelta(seconds=30)
        InvoiceJob.objects.filter(id=job.id).update(
            created_at=created_two_hours_ago,
            updated_at=failed_thirty_seconds_ago,
        )

        dispatched = recover_pending_jobs(older_than_seconds=60, max_attempts=5)
        self.assertEqual(dispatched, 0)
        mock_dispatch.assert_not_called()

    @patch('orders.tasks.dispatch_invoice_job')
    def test_failed_job_past_cooldown_is_dispatched(self, mock_dispatch):
        """Scenario 2: Job created 2h ago and failed 2m ago is eligible after 60s cooldown."""
        import datetime
        from django.utils import timezone
        now = timezone.now()
        job = enqueue_invoice_job(self.order)
        job.status = InvoiceJob.STATUS_FAILED
        job.attempts = 1
        job.save()
        created_two_hours_ago = now - datetime.timedelta(hours=2)
        failed_two_minutes_ago = now - datetime.timedelta(minutes=2)
        InvoiceJob.objects.filter(id=job.id).update(
            created_at=created_two_hours_ago,
            updated_at=failed_two_minutes_ago,
        )

        dispatched = recover_pending_jobs(older_than_seconds=60, max_attempts=5)
        self.assertEqual(dispatched, 1)
        mock_dispatch.assert_called_once_with(job.id)

    @patch('orders.tasks.dispatch_invoice_job')
    def test_pending_job_older_than_cooldown_is_dispatched(self, mock_dispatch):
        """Scenario 3: Pending job older than 60s is eligible."""
        import datetime
        from django.utils import timezone
        now = timezone.now()
        job = enqueue_invoice_job(self.order)
        old_time = now - datetime.timedelta(seconds=90)
        InvoiceJob.objects.filter(id=job.id).update(
            created_at=old_time,
            updated_at=old_time,
        )

        dispatched = recover_pending_jobs(older_than_seconds=60, max_attempts=5)
        self.assertEqual(dispatched, 1)
        mock_dispatch.assert_called_once_with(job.id)

    def test_atomic_concurrency_claiming(self):
        """If a job is already claimed (running), another execution call must skip it."""
        job = enqueue_invoice_job(self.order)
        # Mark as running by simulating worker 1 claiming it
        job.status = InvoiceJob.STATUS_RUNNING
        job.attempts = 1
        job.save()

        # Worker 2 attempts to execute the same job
        with patch('orders.tasks.generate_invoice') as mock_gen:
            _execute_invoice_job(job.id)
            mock_gen.assert_not_called()

        job.refresh_from_db()
        # Attempts should still be 1 (worker 2 did not increment or claim)
        self.assertEqual(job.attempts, 1)
        self.assertEqual(job.status, InvoiceJob.STATUS_RUNNING)

    @patch('orders.tasks.dispatch_invoice_job')
    def test_recover_stale_running_jobs(self, mock_dispatch):
        """Stale running jobs (crashed workers) older than stale_running_seconds are reset to pending and re-dispatched."""
        import datetime
        from django.utils import timezone

        job = enqueue_invoice_job(self.order)
        job.status = InvoiceJob.STATUS_RUNNING
        job.attempts = 1
        stale_time = timezone.now() - datetime.timedelta(seconds=400)
        job.save()
        InvoiceJob.objects.filter(id=job.id).update(updated_at=stale_time)

        dispatched = recover_pending_jobs(older_than_seconds=60, max_attempts=5, stale_running_seconds=300)
        self.assertEqual(dispatched, 1)
        mock_dispatch.assert_called_once_with(job.id)

        job.refresh_from_db()
        self.assertEqual(job.status, InvoiceJob.STATUS_PENDING)

    @patch('orders.tasks.dispatch_invoice_job')
    def test_active_running_jobs_not_reclaimed(self, mock_dispatch):
        """Active running jobs (updated recently) are not touched by recovery."""
        import datetime
        from django.utils import timezone

        job = enqueue_invoice_job(self.order)
        job.status = InvoiceJob.STATUS_RUNNING
        job.attempts = 1
        job.save()
        # Updated only 30 seconds ago
        recent_time = timezone.now() - datetime.timedelta(seconds=30)
        InvoiceJob.objects.filter(id=job.id).update(updated_at=recent_time)

        dispatched = recover_pending_jobs(older_than_seconds=60, max_attempts=5, stale_running_seconds=300)
        self.assertEqual(dispatched, 0)
        mock_dispatch.assert_not_called()

        job.refresh_from_db()
        self.assertEqual(job.status, InvoiceJob.STATUS_RUNNING)

    @patch('orders.tasks.dispatch_invoice_job')
    def test_max_attempts_exhausted_not_recovered(self, mock_dispatch):
        """Jobs with attempts >= max_attempts are not picked up by recovery."""
        import datetime
        from django.utils import timezone

        job = enqueue_invoice_job(self.order)
        job.status = InvoiceJob.STATUS_FAILED
        job.attempts = 5
        stale_time = timezone.now() - datetime.timedelta(seconds=120)
        job.save()
        InvoiceJob.objects.filter(id=job.id).update(updated_at=stale_time, created_at=stale_time)

        dispatched = recover_pending_jobs(older_than_seconds=60, max_attempts=5)
        self.assertEqual(dispatched, 0)
        mock_dispatch.assert_not_called()

    def test_transaction_rollback_prevents_job_and_dispatch(self):
        """When a payment transaction aborts, the InvoiceJob is rolled back and on_commit hook does not fire."""
        from django.db import transaction

        dispatched_ids = []

        try:
            with transaction.atomic():
                self.order.status = 'paid'
                self.order.save()
                job = enqueue_invoice_job(self.order)
                transaction.on_commit(lambda: dispatched_ids.append(job.id))
                raise ValueError("Simulated failure inside transaction before commit")
        except ValueError:
            pass

        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'pending')
        self.assertEqual(InvoiceJob.objects.filter(order=self.order).count(), 0)
        self.assertEqual(dispatched_ids, [])
