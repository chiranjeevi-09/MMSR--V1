"""Deactivate admin/staff accounts that have not logged in for a while.

The platform owner's rule: an admin who has not signed in for 60 days should
automatically lose access (their account flips to Inactive). This command
implements that as a scheduled job — run it daily from cron / Windows Task
Scheduler, e.g.:

    python manage.py deactivate_inactive_users

Key behaviour:
- Idempotent: running it repeatedly is safe.
- Non-destructive: it only flips ``is_active`` to False. No user, permission,
  invitation, or history data is deleted. A Super Admin can reactivate an
  account at any time from /admin/access — a reactivated user clears the check
  again as soon as they log in.
- Superusers are exempt by default so the platform is never locked out. Pass
  ``--include-superusers`` to apply the rule to them too.
- Every deactivation is recorded in the append-only admin audit log.
"""
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from users.models import User, AdminAuditEvent


class Command(BaseCommand):
    help = 'Deactivate staff/admin accounts that have been inactive past the threshold.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            type=int,
            default=None,
            help='Inactivity threshold in days. Defaults to settings.ADMIN_INACTIVITY_DAYS (60).',
        )
        parser.add_argument(
            '--include-superusers',
            action='store_true',
            help='Also deactivate inactive Super Admins (exempt by default to avoid lockout).',
        )
        parser.add_argument(
            '--all-users',
            action='store_true',
            help='Apply to every account, not just staff/admins.',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Report which accounts WOULD be deactivated without changing anything.',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        days = options['days'] if options['days'] is not None else getattr(settings, 'ADMIN_INACTIVITY_DAYS', 60)
        if days <= 0:
            self.stdout.write(self.style.WARNING(
                'Inactivity threshold is 0 (disabled); nothing to do.'
            ))
            return

        cutoff = timezone.now() - timedelta(days=days)

        qs = User.objects.filter(is_active=True)
        if not options['all_users']:
            qs = qs.filter(is_staff=True)
        if not options['include_superusers']:
            qs = qs.filter(is_superuser=False)

        # Never logged in → measure from date_joined; otherwise from last_login.
        candidates = qs.filter(last_login__isnull=True, date_joined__lt=cutoff) | qs.filter(
            last_login__isnull=False, last_login__lt=cutoff
        )
        candidates = candidates.distinct().order_by('email')

        count = 0
        for user in candidates:
            reference = user.last_login or user.date_joined
            if options['dry_run']:
                self.stdout.write(
                    f'[dry-run] would deactivate {user.email} (idle since {reference:%Y-%m-%d})'
                )
                count += 1
                continue

            user.is_active = False
            user.save(update_fields=['is_active'])
            AdminAuditEvent.objects.create(
                action=AdminAuditEvent.Action.ACCOUNT_DEACTIVATED,
                actor=None,
                actor_email='system',
                target=user,
                target_email=user.email,
                detail={
                    'reason': 'inactive_account_auto_deactivate',
                    'days': days,
                    'idle_since': reference.isoformat() if reference else None,
                },
            )
            count += 1
            self.stdout.write(f'Deactivated {user.email} (idle since {reference:%Y-%m-%d})')

        verb = 'Would deactivate' if options['dry_run'] else 'Deactivated'
        self.stdout.write(self.style.SUCCESS(f'{verb} {count} account(s). Cutoff: {cutoff:%Y-%m-%d %H:%M} UTC.'))
