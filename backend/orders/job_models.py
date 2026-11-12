"""Outbox-pattern job model for background invoice and email processing.

Design rationale
----------------
Celery is not installed (see requirements.txt). Installing Celery would require
a separate broker process (RabbitMQ or Redis-as-broker) and a persistent worker
process — infrastructure that is not provisioned yet.

Instead, this module implements a *database-backed outbox pattern*:

1. When a payment is confirmed, an ``InvoiceJob`` row is inserted in the **same
   database transaction** that records ``order.status = 'paid'``.  The job
   survives a crash because it is committed atomically with the payment.

2. After the transaction commits, ``dispatch_invoice_job()`` launches a
   background ``threading.Thread`` to execute the job.  If the web process
   crashes between the commit and the thread launch, the job remains ``pending``
   and is recovered by the management command ``recover_invoice_jobs``.

3. ``recover_invoice_jobs`` (see management/commands/) should be run as a
   periodic cron on the VPS (e.g. every 5 minutes via systemd timer or cron).
   It picks up all ``pending`` and ``failed`` jobs older than 60 seconds and
   retries them in a background thread.

4. ``InvoiceJob`` tracks invoice generation and email dispatch separately so
   a failed email does not force invoice regeneration, and retrying email does
   not regenerate an existing PDF.

Limitations (documented honestly)
----------------------------------
* Thread-based execution shares the web process's memory and I/O.  Under very
  high payment concurrency, invoice generation threads could saturate the same
  Gunicorn worker process.  For true process isolation, install Celery + Redis
  broker and replace ``dispatch_invoice_job()`` with a Celery task call.
* Email delivery is at-most-once from the SMTP provider's perspective — if the
  SMTP connection drops after the provider accepts the message, the email is
  delivered but ``email_sent`` stays False and the next retry sends a duplicate.
  This is unavoidable without provider-side deduplication (e.g. SendGrid
  message IDs). The idempotency guard prevents double *invoice generation* but
  cannot prevent double *email delivery* in this edge case.
"""
from django.db import models
from django.conf import settings


class InvoiceJob(models.Model):
    """Durable outbox record for invoice PDF generation and email dispatch.

    One record per Order. Unique constraint on ``order`` prevents duplicate jobs.
    """

    STATUS_PENDING = 'pending'
    STATUS_RUNNING = 'running'
    STATUS_DONE = 'done'
    STATUS_FAILED = 'failed'

    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_RUNNING, 'Running'),
        (STATUS_DONE, 'Done'),
        (STATUS_FAILED, 'Failed'),
    ]

    order = models.OneToOneField(
        'orders.Order',
        on_delete=models.CASCADE,
        related_name='invoice_job',
        help_text='The order this job processes. One job per order.',
    )

    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
        db_index=True,
    )

    # Separate tracking for invoice and email so each step can be retried independently.
    invoice_generated = models.BooleanField(
        default=False,
        help_text='True after invoice PDF has been successfully saved to storage.',
    )
    email_sent = models.BooleanField(
        default=False,
        help_text='True after the invoice email was accepted by the SMTP provider.',
    )

    attempts = models.PositiveSmallIntegerField(
        default=0,
        help_text='Total number of execution attempts (including the initial one).',
    )
    last_error = models.TextField(
        blank=True,
        default='',
        help_text='Last exception message for debugging.',
    )

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at']
        verbose_name = 'Invoice Job'
        verbose_name_plural = 'Invoice Jobs'
        indexes = [
            models.Index(fields=['status', 'created_at']),
        ]

    def __str__(self):
        return f'InvoiceJob(order={self.order_id}, status={self.status})'

