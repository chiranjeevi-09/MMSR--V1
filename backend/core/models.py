"""Centralized, concurrency-safe public ID storage (Phase 5 standardization).

Format: ``MMSR-[TYPE]-1931-000101`` — organization prefix, 3-letter entity
prefix, FIXED year 1931 (never the calendar year), and a per-prefix sequence
of exactly six digits starting at 000101. Sequences never reset and never
fall below 000101.

Public IDs are display/reference identifiers only. They are NEVER primary
keys and are NEVER trusted for authorization (auth still resolves through
the authenticated request, per the standardization spec §7/§13).
"""

import logging
import re

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured, ValidationError
from django.core.validators import RegexValidator
from django.db import IntegrityError, models, transaction

logger = logging.getLogger(__name__)

ORG_PREFIX = 'MMSR'
FIXED_YEAR = '1931'
MIN_SEQUENCE = 101          # every entity type starts at 000101 — spec §1
MAX_SEQUENCE = 999999       # six digits; overflow is raised, never wrapped
PUBLIC_ID_PATTERN = re.compile(r'^MMSR-[A-Z]{3}-1931-[0-9]{6}$')
PUBLIC_ID_LENGTH = 20       # exact rendered length of the approved format

# Approved 32-prefix master list (spec §3). Three prefixes from the master
# list have no independent model in this project and are therefore NOT
# activated (documented instead of invented, per spec §3/§9):
#   AUT — authors live as Book.author (CharField) and as the ChapterAuthor
#         (CAU) model referenced via M2M from chapters/articles;
#   INV — invoice PDFs are FileFields on Order/ConferenceSubmission, not
#         independent records (only rendered PDFs in media/invoices/);
#   PAY — payments are razorpay_* / transaction_id fields on Order and
#         ConferenceSubmission, not independent records.
ACTIVE_PREFIXES = (
    'USR', 'ADM', 'AIN', 'AUD', 'CAT', 'BOK', 'JRN', 'ISS', 'ART', 'JAC',
    'CAU', 'CHP', 'SEC', 'TST', 'UNI', 'MET', 'SLD', 'NLS', 'NLB', 'ENQ',
    'ORD', 'ORI', 'SUB', 'VOL', 'CON', 'CPS', 'CSA', 'POL', 'PLV', 'PLA',
)
DOCUMENTED_INACTIVE_PREFIXES = ('AUT', 'INV', 'PAY')


def format_public_id(prefix, sequence):
    """Render + validate one public ID. Raises on bad prefix/sequence."""
    if prefix not in ACTIVE_PREFIXES:
        raise ValueError(f'Unapproved public ID prefix: {prefix!r}')
    sequence = int(sequence)
    if sequence < MIN_SEQUENCE:
        raise ValueError(
            f'Public ID sequence {sequence} is below the {MIN_SEQUENCE:06d} baseline.')
    if sequence > MAX_SEQUENCE:
        raise PublicIDOverflow(prefix, sequence)
    return f'{ORG_PREFIX}-{prefix}-{FIXED_YEAR}-{sequence:06d}'


class PublicIDOverflow(RuntimeError):
    """A prefix's sequence exceeded 999999. Explicit failure, never an
    invalid ID (spec §5 requirement 16)."""

    def __init__(self, prefix, attempted):
        super().__init__(
            f'Public ID sequence overflow for prefix {prefix}: attempted '
            f'{attempted} > {MAX_SEQUENCE}. A new entity prefix must be '
            'approved before more records of this type can be created.'
        )
        self.prefix = prefix
        self.attempted = attempted


class PublicIDCounter(models.Model):
    """One row per entity prefix holding the NEXT sequence value."""

    prefix = models.CharField(max_length=3, primary_key=True,
                              validators=[RegexValidator(r'^[A-Z]{3}$')])
    next_sequence = models.PositiveIntegerField(default=MIN_SEQUENCE)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['prefix']
        verbose_name = 'Public ID Counter'
        verbose_name_plural = 'Public ID Counters'

    def __str__(self):
        return f'{self.prefix} → next {self.next_sequence:06d}'

    def as_next_id(self):
        return format_public_id(self.prefix, self.next_sequence)


class PublicIDTrackable(models.Model):
    """Abstract base adding the standardized ``public_id`` column.

    Concrete models set ``public_id_prefix`` to their approved 3-letter code
    (spec §3) and inherit everything else:

    - the column is a unique, indexed, non-primary-key string;
    - it is filled on the first INSERT by the centralized counter service —
      never by the client (``editable=False``);
    - it is immutable afterwards (compared against the value the row was
      loaded with, so the guard costs no extra query);
    - a database-level UNIQUE clash (only possible if a row was created
      outside this service) is retried with a freshly allocated ID.

    ``save()`` deliberately tolerates the ``update_fields`` partial writes
    used by existing models (e.g. reference-number backfills).
    """

    public_id = models.CharField(
        max_length=PUBLIC_ID_LENGTH, unique=True, db_index=True,
        null=True, blank=True, editable=False,
        validators=[RegexValidator(PUBLIC_ID_PATTERN)],
        help_text='MMSR public ID (MMSR-XXX-1931-NNNNNN). System generated, immutable.',
    )

    #: Approved entity prefix (spec §3). Concrete models must set this.
    public_id_prefix = None

    class Meta:
        abstract = True

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Value the row was loaded/created with — the immutability baseline.
        self._original_public_id = self.public_id

    def _prepare_public_id(self, update_fields):
        """Allocate a missing ID or refuse a tampered one."""
        if update_fields is not None and 'public_id' not in update_fields:
            return  # partial write cannot touch the column
        current = self.public_id
        original = self._original_public_id
        if original is None and self.pk is not None:
            # Rows written without going through a normal load (e.g.
            # ``obj = Model(); obj.pk = 1; obj.save()`` singleton saves)
            # still must not be able to rewrite an assigned ID. Costs one
            # query, and only that unusual path pays it.
            original = (
                type(self).objects.filter(pk=self.pk)
                .values_list('public_id', flat=True)
                .first()
            )
            self._original_public_id = original
        if original:
            if current != original:
                raise ValidationError(
                    f'{type(self).__name__} public_id is immutable '
                    f'({original} → {current} refused).'
                )
            return
        if current:
            return  # assigned by the backfill migration before this save
        if not self.public_id_prefix:
            raise ImproperlyConfigured(
                f'{type(self).__name__} inherits PublicIDTrackable but sets '
                'no public_id_prefix.'
            )
        # Imported lazily: core.services imports from this module.
        from core.services import allocate_next
        self.public_id = allocate_next(self.public_id_prefix)

    def save(self, *args, **kwargs):
        from core.services import MAX_ALLOCATION_RETRIES, is_public_id_conflict

        self._prepare_public_id(kwargs.get('update_fields'))
        attempts = 0
        while True:
            try:
                # Savepoint when the caller already opened a transaction, so a
                # failed INSERT can be retried cleanly.
                with transaction.atomic(using=kwargs.get('using')):
                    return super().save(*args, **kwargs)
            except IntegrityError as exc:
                attempts += 1
                if attempts >= MAX_ALLOCATION_RETRIES or not is_public_id_conflict(exc):
                    raise
                # The counter is untouched by the rolled-back INSERT; take the
                # next value and try again.
                logger.warning(
                    'public_id UNIQUE collision on %s (%s); re-allocating, attempt %d/%d',
                    type(self).__name__, self.public_id,
                    attempts, MAX_ALLOCATION_RETRIES,
                )
                from core.services import allocate_next
                self.public_id = allocate_next(self.public_id_prefix)


class AdminProfile(PublicIDTrackable):
    """Admin (ADM) identity for a staff account.

    Architecture mapping (spec §2): this project stores admins as User rows
    with is_staff/is_superuser, so the ADM public ID lives on a one-to-one
    profile attached to the *existing* account — the Super Admin is never
    duplicated. ``user.public_id`` keeps the USR value; admin surfaces
    display ``admin_public_id`` from this profile.
    """

    public_id_prefix = 'ADM'

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='admin_profile',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Admin Profile'
        verbose_name_plural = 'Admin Profiles'

    def __str__(self):
        return f'{self.public_id or "(unassigned)"} → user pk {self.user_id}'
