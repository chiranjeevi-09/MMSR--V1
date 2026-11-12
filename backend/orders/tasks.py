"""Background invoice and email dispatch using a database-backed outbox pattern.

Runtime model
-------------
Celery is NOT installed by default. This module uses a two-layer approach:

Layer 1 — Database outbox (crash-safe):
    ``InvoiceJob`` rows are created in the SAME transaction as the payment
    record. Even if the web process crashes immediately after commit, the job
    survives and is recoverable.

Layer 2 — Threading dispatch (low-latency):
    After the transaction commits, ``dispatch_invoice_job()`` launches a
    background ``threading.Thread`` to run the job *in the same process*.
    This avoids blocking the HTTP response while keeping the implementation
    simple. If the thread or process crashes, Layer 1 recovers the job.

Recovery
--------
Run ``python manage.py recover_invoice_jobs`` as a cron job every 5 minutes:

    */5 * * * * /path/to/venv/bin/python /path/to/manage.py recover_invoice_jobs

This picks up all ``pending`` jobs older than 60 seconds (missed dispatches)
and all ``failed`` jobs with fewer than 5 attempts, and re-runs them.
"""
import logging
import threading

from django.db import close_old_connections, transaction
from orders.utils import generate_invoice, send_invoice_email

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 5


def enqueue_invoice_job(order):
    """Create an InvoiceJob for this order inside the current transaction.

    Must be called from within a ``transaction.atomic()`` block so the job
    record is committed atomically with the payment status update.

    Uses ``get_or_create`` so a duplicate webhook or concurrent request never
    produces two job records for the same order.

    Returns the InvoiceJob instance (created or existing).
    """
    from orders.job_models import InvoiceJob

    job, created = InvoiceJob.objects.get_or_create(
        order=order,
        defaults={'status': InvoiceJob.STATUS_PENDING},
    )
    if not created:
        logger.info(
            'InvoiceJob for Order #%s already exists (status=%s); skipping duplicate creation.',
            order.id, job.status,
        )
    else:
        logger.info('InvoiceJob #%s created for Order #%s.', job.id, order.id)
    return job


def dispatch_invoice_job(job_id):
    """Launch a background thread to run the invoice job after transaction commit.

    Call this from ``transaction.on_commit()``::

        transaction.on_commit(lambda: dispatch_invoice_job(job.id))
    """
    t = threading.Thread(
        target=_run_job_safe,
        args=(job_id,),
        daemon=True,
        name=f'invoice-job-{job_id}',
    )
    t.start()
    logger.info('Invoice job #%s dispatched to background thread.', job_id)


def _run_job_safe(job_id):
    """Execute the invoice job, updating status/attempt count in the database."""
    close_old_connections()
    try:
        _execute_invoice_job(job_id)
    except Exception as exc:
        logger.exception('Unhandled error in invoice job #%s: %s', job_id, exc)
    finally:
        close_old_connections()


def _execute_invoice_job(job_id):
    """Core logic: generate the invoice PDF and send the email, separately.

    Steps:
      1. Atomically claim the job by transitioning status to RUNNING.
      2. If already RUNNING or DONE (or attempts >= MAX_ATTEMPTS), abort immediately.
      3. Generate the invoice PDF if not already generated.
      4. Send the email if not already sent.
      5. Mark the job ``done`` or ``failed``.
    """
    from django.db.models import F
    from django.utils import timezone
    from orders.job_models import InvoiceJob

    # Atomically claim the job. Only pending or failed jobs with remaining attempts
    # can be claimed. This prevents concurrent workers from duplicate execution.
    now = timezone.now()
    claimed = InvoiceJob.objects.filter(
        pk=job_id,
        status__in=[InvoiceJob.STATUS_PENDING, InvoiceJob.STATUS_FAILED],
        attempts__lt=MAX_ATTEMPTS,
    ).update(
        status=InvoiceJob.STATUS_RUNNING,
        attempts=F('attempts') + 1,
        updated_at=now,
    )

    if not claimed:
        existing = InvoiceJob.objects.filter(pk=job_id).first()
        if not existing:
            logger.error('InvoiceJob #%s not found; aborting.', job_id)
        elif existing.status == InvoiceJob.STATUS_DONE:
            logger.info('InvoiceJob #%s already done; skipping.', job_id)
        elif existing.status == InvoiceJob.STATUS_RUNNING:
            logger.info('InvoiceJob #%s is already running in another worker/thread; skipping.', job_id)
        elif existing.attempts >= MAX_ATTEMPTS:
            logger.warning('InvoiceJob #%s reached max attempts (%s); skipping.', job_id, existing.attempts)
        return

    job = InvoiceJob.objects.select_related('order').get(pk=job_id)
    order = job.order

    errors = []

    # ── Step 1: Generate invoice PDF ──
    if not job.invoice_generated:
        try:
            generate_invoice(order, force=False)
            order.refresh_from_db()
            if order.invoice_pdf:
                job.invoice_generated = True
                job.save(update_fields=['invoice_generated', 'updated_at'])
                logger.info('InvoiceJob #%s: PDF generated for Order #%s.', job.id, order.id)
            else:
                raise RuntimeError('generate_invoice() returned but invoice_pdf is still empty.')
        except Exception as exc:
            errors.append(f'PDF generation failed: {exc}')
            logger.error('InvoiceJob #%s: PDF generation error for Order #%s: %s', job.id, order.id, exc)

    # ── Step 2: Send email (only if PDF exists; never re-send if already sent) ──
    if job.invoice_generated and not job.email_sent:
        try:
            send_invoice_email(order)
            job.email_sent = True
            job.save(update_fields=['email_sent', 'updated_at'])
            logger.info('InvoiceJob #%s: email sent for Order #%s.', job.id, order.id)
        except Exception as exc:
            errors.append(f'Email dispatch failed: {exc}')
            logger.error('InvoiceJob #%s: email error for Order #%s: %s', job.id, order.id, exc)

    # ── Finalise job status ──
    if job.invoice_generated and job.email_sent:
        job.status = InvoiceJob.STATUS_DONE
        job.last_error = ''
    else:
        job.status = InvoiceJob.STATUS_FAILED
        job.last_error = ' | '.join(errors)

    job.save(update_fields=['status', 'last_error', 'updated_at'])
    logger.info(
        'InvoiceJob #%s finished with status=%s for Order #%s.',
        job.id, job.status, order.id,
    )


def process_order_invoice_and_email(self_or_task, order_id, force=False):
    """Backward-compatible task runner for processing an order's invoice and email."""
    close_old_connections()
    from orders.models import Order
    from orders.job_models import InvoiceJob

    try:
        order = Order.objects.filter(id=order_id).first()
        if not order:
            logger.error("Order #%s not found for invoice background task.", order_id)
            return {'status': 'error', 'detail': 'Order not found'}

        if order.status not in Order.PAID_STATUSES:
            logger.warning("Order #%s is status '%s' (not paid); skipping invoice generation.", order_id, order.status)
            return {'status': 'skipped', 'detail': 'Order not in paid status'}

        job, _ = InvoiceJob.objects.get_or_create(
            order=order,
            defaults={'status': InvoiceJob.STATUS_PENDING}
        )

        if not order.invoice_pdf or force:
            logger.info("Generating invoice for Order #%s.", order_id)
            generate_invoice(order, force=force)
            order.refresh_from_db()
            job.invoice_generated = bool(order.invoice_pdf)
            job.save(update_fields=['invoice_generated', 'updated_at'])
            if job.invoice_generated and not job.email_sent:
                try:
                    send_invoice_email(order)
                    job.email_sent = True
                    job.status = InvoiceJob.STATUS_DONE
                    job.save(update_fields=['email_sent', 'status', 'updated_at'])
                except Exception as e:
                    job.status = InvoiceJob.STATUS_FAILED
                    job.last_error = str(e)
                    job.save(update_fields=['status', 'last_error', 'updated_at'])
        else:
            logger.info("Invoice already exists for Order #%s; skipping generation.", order_id)

        return {'status': 'success', 'order_id': order_id, 'invoice': bool(order.invoice_pdf)}
    except Exception as exc:
        logger.exception("Error in process_order_invoice_and_email for Order #%s: %s", order_id, exc)
        return {'status': 'error', 'detail': str(exc)}
    finally:
        close_old_connections()


def recover_pending_jobs(older_than_seconds=60, max_attempts=MAX_ATTEMPTS, stale_running_seconds=300):
    """Find pending/failed jobs and stale running jobs, and re-dispatch them in background threads.

    :param older_than_seconds: Minimum age (in seconds) since last update for pending/failed jobs.
    :param max_attempts: Maximum number of attempts allowed before abandoning recovery.
    :param stale_running_seconds: Duration after which a job stuck in 'running' is considered
                                  crashed/stale and reclaimed for re-execution.
    :return: Number of jobs dispatched for recovery.
    """
    import datetime
    from django.utils import timezone
    from orders.job_models import InvoiceJob

    now = timezone.now()
    dispatched = 0

    # 1. Recover crashed / stale running jobs (lease expiry recovery)
    stale_cutoff = now - datetime.timedelta(seconds=stale_running_seconds)
    stale_jobs = list(
        InvoiceJob.objects.filter(
            status=InvoiceJob.STATUS_RUNNING,
            updated_at__lte=stale_cutoff,
            attempts__lt=max_attempts,
        ).values_list('id', flat=True)
    )

    for job_id in stale_jobs:
        reset = InvoiceJob.objects.filter(
            pk=job_id,
            status=InvoiceJob.STATUS_RUNNING,
            updated_at__lte=stale_cutoff,
        ).update(
            status=InvoiceJob.STATUS_PENDING,
            updated_at=now,
        )
        if reset:
            logger.warning(
                'Reset stale running InvoiceJob #%s (stuck > %ds) to pending for recovery.',
                job_id, stale_running_seconds,
            )
            dispatch_invoice_job(job_id)
            dispatched += 1

    # 2. Recover pending and failed jobs that have cooled down.
    # Eligibility is based exclusively on ``updated_at`` (the timestamp of
    # the last status transition). Using ``created_at`` in an OR condition
    # would allow a job that failed 30 seconds ago to bypass the cooldown
    # just because it was created long ago — that defect was identified in
    # the Phase 11H audit and corrected here (Phase 11I).
    pending_cutoff = now - datetime.timedelta(seconds=older_than_seconds)
    jobs = (
        InvoiceJob.objects.filter(
            status__in=[InvoiceJob.STATUS_PENDING, InvoiceJob.STATUS_FAILED],
            attempts__lt=max_attempts,
            updated_at__lte=pending_cutoff,
        )
        .exclude(pk__in=stale_jobs)
        .values_list('id', flat=True)
    )

    for job_id in jobs:
        logger.info('Recovering InvoiceJob #%s.', job_id)
        dispatch_invoice_job(job_id)
        dispatched += 1

    return dispatched
