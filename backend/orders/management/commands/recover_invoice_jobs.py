"""Management command: recover_invoice_jobs

Re-dispatches InvoiceJob records that are ``pending`` or ``failed`` and have
not exceeded the maximum attempt count.

Usage:
    python manage.py recover_invoice_jobs [--older-than N] [--max-attempts N]

Cron example (run every 5 minutes on the VPS):
    */5 * * * * /path/to/venv/bin/python /path/to/manage.py recover_invoice_jobs >> /var/log/mmsr/recover_invoice_jobs.log 2>&1
"""
from django.core.management.base import BaseCommand

from orders.tasks import recover_pending_jobs


class Command(BaseCommand):
    help = 'Re-dispatch pending or failed invoice jobs (crash recovery).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--older-than',
            type=int,
            default=60,
            help='Only recover jobs created more than N seconds ago (default: 60).',
        )
        parser.add_argument(
            '--max-attempts',
            type=int,
            default=5,
            help='Skip jobs that have already been attempted N or more times (default: 5).',
        )
        parser.add_argument(
            '--stale-running-seconds',
            type=int,
            default=300,
            help='Reclaim jobs stuck in running status for more than N seconds (default: 300).',
        )

    def handle(self, *args, **options):
        older_than = options['older_than']
        max_attempts = options['max_attempts']
        stale_seconds = options['stale_running_seconds']
        count = recover_pending_jobs(
            older_than_seconds=older_than,
            max_attempts=max_attempts,
            stale_running_seconds=stale_seconds,
        )
        if count:
            self.stdout.write(
                self.style.SUCCESS(f'Dispatched {count} invoice job(s) for recovery.')
            )
        else:
            self.stdout.write('No recoverable invoice jobs found.')

