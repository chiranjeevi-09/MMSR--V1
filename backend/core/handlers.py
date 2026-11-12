"""Signal handlers that keep the ADM identity in step with staff status.

Spec §2 requires every administrative account to carry
``MMSR-ADM-1931-NNNNNN`` without duplicating the User row. Rather than
remembering to call the service from each place that grants staff access
(invitation activation, the Super Admin's role editor, ``createsuperuser``,
Django admin), one idempotent receiver covers all of them.

Registered from ``core.apps.CoreConfig.ready()`` against the concrete user
model, so historical models used inside data migrations never trigger it.
"""

import logging

from django.db import transaction

logger = logging.getLogger(__name__)


def assign_admin_profile(sender, instance, created, **kwargs):
    """Create (or fetch) the AdminProfile whenever a staff account is saved."""
    if not getattr(instance, 'is_staff', False):
        return
    from core.services import ensure_admin_profile

    try:
        # A savepoint keeps a failure here from unwinding the caller's own
        # user save: the ADM identity is a display/reference concern.
        with transaction.atomic():
            ensure_admin_profile(instance)
    except Exception:  # pragma: no cover - defensive: never break a login/save
        logger.exception('Could not ensure an ADM public ID for user pk=%s', instance.pk)
