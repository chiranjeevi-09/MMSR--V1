"""Centralized public ID generation service (spec §5).

One allocation path for every entity type. Sequences live in the
``core_publicidcounter`` table; the counter row is read, locked, and
incremented inside a transaction, so simultaneous creations can never share
a value. ``core.models.PublicIDTrackable`` (the abstract base every tracked
model inherits) calls ``allocate_next()`` exactly once per new row.

Concurrency notes (spec §5 closing requirement — documented, not hidden):
- PostgreSQL (staging/production target): ``select_for_update()`` takes a real
  row lock; concurrent requests serialize per prefix, with no cross-prefix
  contention.
- SQLite (the current dev database): ``select_for_update()`` is a no-op
  because SQLite has no row locks; instead SQLite serializes whole write
  transactions, and the counter bump happens in its own short write
  transaction, which is sufficient for the single-process dev server.
  Multi-process deployments MUST run on PostgreSQL
  (``DB_ENGINE`` in backend/.env already selects the engine in settings.py).
- Final belt: ``public_id`` carries a database UNIQUE constraint. A
  collision (only possible if a row was inserted outside this service) fails
  the INSERT, and ``PublicIDTrackable.save()`` re-allocates and retries
  inside a savepoint instead of corrupting the counter.
"""

import logging

from django.db import IntegrityError, transaction

from core.models import (
    MAX_SEQUENCE,
    MIN_SEQUENCE,
    PublicIDCounter,
    PublicIDOverflow,
    format_public_id,
)

logger = logging.getLogger(__name__)

MAX_ALLOCATION_RETRIES = 5


def allocate_next(prefix):
    """Reserve and return the next public ID for ``prefix``.

    Raises ValueError for unapproved prefixes or a counter corrupted below
    the 000101 baseline, and PublicIDOverflow past 999999 — an invalid ID is
    never emitted (spec §1 rules 1/2/7, §5 requirements 14–16).
    """
    with transaction.atomic():
        counter = PublicIDCounter.objects.select_for_update().filter(pk=prefix).first()
        if counter is None:
            # Create the row inside its own committed transaction first to
            # avoid locking a not-yet-existing row. A concurrent creator loses
            # the INSERT race and simply falls through to the re-read.
            try:
                with transaction.atomic():
                    # next_sequence is the value to hand out NEXT, so a fresh
                    # prefix starts at exactly 000101.
                    PublicIDCounter.objects.create(
                        pk=prefix, next_sequence=MIN_SEQUENCE,
                    )
            except IntegrityError:
                pass
            counter = PublicIDCounter.objects.select_for_update().filter(pk=prefix).first()

        seq = counter.next_sequence
        if seq < MIN_SEQUENCE:
            raise ValueError(
                f'Counter for {prefix} corrupted below baseline: {seq}. '
                'Refusing to generate a public ID.'
            )
        if seq > MAX_SEQUENCE:
            raise PublicIDOverflow(prefix, seq)

        counter.next_sequence = seq + 1
        counter.save(update_fields=['next_sequence', 'updated_at'])
    return format_public_id(prefix, seq)


def is_public_id_conflict(error):
    """True when an IntegrityError was raised by a public_id UNIQUE clash.

    SQLite: 'UNIQUE constraint failed: app_model.public_id'.
    PostgreSQL: 'duplicate key value violates unique constraint
    "..._public_id_..."'. Both name the column; PK/other-constraint clashes
    must NOT be retried away.
    """
    text = str(error).lower()
    return 'public_id' in text and ('unique' in text or 'duplicate key' in text)


def reserve_public_id(prefix, sequence):
    """Validate + render one explicitly chosen sequence.

    Used by the data migration to reserve the Super Admin's
    MMSR-ADM-1931-000101 permanently and to backfill existing rows in
    deterministic ascending-PK order. Kept here so the format rules are
    enforced from a single place even for migrations (which cannot import
    model behaviour).
    """
    return format_public_id(prefix, sequence)


def ensure_admin_profile(user):
    """Return the ADM profile for a staff account, creating it on demand.

    Called wherever an account is granted staff/admin status (invitation
    activation, Super Admin's "Add Admin" flow) so every admin — including
    accounts created before this standardization — carries
    ``MMSR-ADM-1931-NNNNNN`` without duplicating the User row (spec §2).
    """
    from core.models import AdminProfile

    profile, _created = AdminProfile.objects.get_or_create(user=user)
    return profile
