from django.db import models
from django.conf import settings
from django.utils.text import slugify
from django.utils import timezone
from django.core.validators import RegexValidator, FileExtensionValidator, MaxValueValidator

from core.models import PublicIDTrackable

# Manuscripts, supplementary files and invoices are stored OUTSIDE the public
# MEDIA tree and served only through an authorised download view. The instance
# is defined once in core.storages so migrations never record this machine's
# absolute path (SECURITY-QA-REPORT C-1, M-3); re-exported here for the
# existing ``from conferences.models import protected_storage`` call sites.
from core.storages import ProtectedStorage, protected_storage  # noqa: F401,E402

phone_validator = RegexValidator(
    regex=r'^\d{10}$',
    message='Phone number must be exactly 10 digits.',
)

MANUSCRIPT_EXTENSIONS = ['pdf', 'doc', 'docx']


class Conference(PublicIDTrackable):
    """A conference researchers can submit papers to. Populated by admins and
    served to the public via GET /api/conferences/."""

    public_id_prefix = 'CON'  # MMSR-CON-1931-NNNNNN (spec §3)

    MODE_CHOICES = (
        ('Hybrid', 'Hybrid'),
        ('Online', 'Online'),
        ('Offline', 'Offline (In-person)'),
    )
    STATUS_CHOICES = (
        ('Upcoming', 'Upcoming'),
        ('Ongoing', 'Ongoing'),
        ('Completed', 'Completed'),
        ('Cancelled', 'Cancelled'),
    )

    title = models.CharField(max_length=300)
    slug = models.SlugField(max_length=320, unique=True, blank=True)
    acronym = models.CharField(max_length=60, blank=True)
    description = models.TextField(blank=True)
    full_description = models.TextField(blank=True)

    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    venue = models.CharField(max_length=300, blank=True)
    country = models.CharField(max_length=120, blank=True, default='India')
    mode = models.CharField(max_length=20, choices=MODE_CHOICES, default='Hybrid')
    domain = models.CharField(max_length=150, blank=True, default='Multidisciplinary')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Upcoming')
    organizer = models.CharField(max_length=300, blank=True, default='MMSR Publications')

    submission_deadline = models.DateField(null=True, blank=True)
    registration_deadline = models.DateField(null=True, blank=True)
    registration_open = models.BooleanField(default=True)
    submission_fee = models.DecimalField(
        max_digits=10, decimal_places=2, default=0,
        help_text='Paper submission fee (INR) charged per submission to this conference. 0 = free.',
    )
    is_accepting_submissions = models.BooleanField(
        default=False,
        help_text='Only conferences with this enabled (and a deadline not passed) accept paper submissions.',
    )

    doi_prefix = models.CharField(max_length=80, blank=True)
    isbn_proceedings = models.CharField(max_length=80, blank=True)
    submission_guidelines = models.TextField(blank=True)
    call_for_papers = models.TextField(blank=True)

    # Configured research tracks: list of {id, title, description, topics[]}
    tracks = models.JSONField(default=list, blank=True)
    # Key dates shown to authors: list of {label, date}
    important_dates = models.JSONField(default=list, blank=True)

    cover_image = models.ImageField(upload_to='conferences/covers/', blank=True, null=True)
    banner_image = models.ImageField(upload_to='conferences/banners/', blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-start_date', '-created_at']
        verbose_name = 'Conference'
        verbose_name_plural = 'Conferences'

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)[:320]
        super().save(*args, **kwargs)

    @classmethod
    def open_for_submissions(cls):
        """Conferences currently eligible to receive new paper submissions."""
        today = timezone.localdate()
        return cls.objects.filter(
            is_accepting_submissions=True,
        ).exclude(status='Cancelled').filter(
            models.Q(submission_deadline__isnull=True) | models.Q(submission_deadline__gte=today)
        )

    @property
    def accepting(self):
        today = timezone.localdate()
        if not self.is_accepting_submissions or self.status == 'Cancelled':
            return False
        if self.submission_deadline and self.submission_deadline < today:
            return False
        return True


class ConferenceSubmission(PublicIDTrackable):
    """A conference paper submission with normalized co-author records and a
    privately stored manuscript."""

    public_id_prefix = 'CPS'  # MMSR-CPS-1931-NNNNNN (spec §3)

    STATUS_CHOICES = (
        ('pending_payment', 'Pending Payment'),
        ('submitted', 'Submitted'),
        ('under_review', 'Under Review'),
        ('revision_required', 'Revision Required'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
        ('camera_ready', 'Camera Ready'),
        ('published', 'Published'),
    )
    PAPER_TYPE_CHOICES = (
        ('Full Paper', 'Full Research Paper'),
        ('Short Paper', 'Short Paper'),
        ('Poster Paper', 'Poster Paper'),
        ('Review Paper', 'Review Paper'),
        ('Case Study', 'Case Study'),
        ('Survey Paper', 'Survey Paper'),
        ('Industry Paper', 'Industry Track Paper'),
        ('Student Paper', 'Student Competition Paper'),
    )

    # Target conference + submitting user (nullable so a deleted user doesn't cascade)
    conference = models.ForeignKey(Conference, on_delete=models.PROTECT, related_name='submissions')
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='conference_submissions',
    )

    # Paper metadata
    title = models.CharField(max_length=500)
    subtitle = models.CharField(max_length=500, blank=True)
    abstract = models.TextField()
    keywords = models.CharField(max_length=500, blank=True, help_text='Comma-separated keywords')
    paper_type = models.CharField(max_length=30, choices=PAPER_TYPE_CHOICES, default='Full Paper')
    research_domain = models.CharField(max_length=150, blank=True)
    language = models.CharField(max_length=60, blank=True, default='English')
    selected_track = models.CharField(max_length=200, blank=True)
    presentation_mode = models.CharField(max_length=40, blank=True, default='Oral')
    session_preference = models.CharField(max_length=80, blank=True)
    registration_category = models.CharField(max_length=60, blank=True)
    proceedings_preference = models.CharField(max_length=120, blank=True)
    gst_invoice_required = models.BooleanField(default=False)

    # Corresponding author snapshot (never mutates the user account)
    author_full_name = models.CharField(max_length=200)
    author_email = models.EmailField()
    author_phone = models.CharField(max_length=20, blank=True, validators=[phone_validator])
    institution = models.CharField(max_length=300, blank=True)
    department = models.CharField(max_length=200, blank=True)
    designation = models.CharField(max_length=150, blank=True)
    country = models.CharField(max_length=120, blank=True, default='India')
    orcid = models.CharField(max_length=40, blank=True)

    # Files (stored privately)
    manuscript_file = models.FileField(
        upload_to='conference_submissions/manuscripts/',
        storage=protected_storage,
        validators=[FileExtensionValidator(allowed_extensions=MANUSCRIPT_EXTENSIONS)],
    )
    supplementary_file = models.FileField(
        upload_to='conference_submissions/supplementary/',
        storage=protected_storage,
        blank=True,
        null=True,
    )

    # Reference + workflow
    reference_number = models.CharField(max_length=40, blank=True, editable=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='submitted', db_index=True)
    client_reference = models.CharField(
        max_length=64,
        help_text='Idempotency key supplied by the client to prevent duplicate submissions. '
                  'Unique per submitting account, not globally (SECURITY-QA-REPORT M-1).',
    )
    declarations = models.JSONField(default=dict, blank=True)
    admin_notes = models.TextField(blank=True)
    decision_notes = models.TextField(blank=True)

    # Submission fee snapshot + Razorpay payment trail
    submission_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    razorpay_order_id = models.CharField(max_length=255, blank=True, default='', db_index=True)
    razorpay_payment_id = models.CharField(max_length=255, blank=True, default='', db_index=True)
    razorpay_signature = models.CharField(max_length=255, blank=True, default='')
    invoice_pdf = models.FileField(
        upload_to='conference_invoices/',
        storage=protected_storage,
        blank=True,
        null=True,
    )

    submitted_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-submitted_at']
        verbose_name = 'Conference Submission'
        verbose_name_plural = 'Conference Submissions'
        indexes = [
            models.Index(fields=['conference', 'status', '-submitted_at']),
            models.Index(fields=['status', '-submitted_at']),
        ]
        constraints = [
            # A GLOBAL unique key turned the idempotency token into a
            # cross-account channel: another account posting the same
            # client_reference was handed back this author's record (title,
            # email, id) and could occupy the reference to block them
            # (SECURITY-QA-REPORT M-1). Scoping the key to the submitting
            # account keeps replay protection and removes both effects.
            models.UniqueConstraint(
                fields=['submitted_by', 'client_reference'],
                name='unique_client_reference_per_submitter',
            ),
        ]

    def __str__(self):
        return f'{self.reference_number or self.title} — {self.conference.acronym or self.conference.title}'

    def save(self, *args, **kwargs):
        # spec §11: the old CONF-{year}-{id:05d} reference used the calendar
        # year and leaked the internal PK. New submissions allocate the
        # standardized CPS public ID and mirror it into the legacy reference
        # column in a single INSERT; historical rows keep their CONF-... value.
        if not self.public_id:
            self._prepare_public_id(kwargs.get('update_fields'))
        if self.public_id and not self.reference_number:
            self.reference_number = self.public_id
        super().save(*args, **kwargs)


class ConferenceSubmissionAuthor(PublicIDTrackable):
    """Normalized, ordered co-author record for a conference submission."""

    public_id_prefix = 'CSA'  # MMSR-CSA-1931-NNNNNN (spec §3)

    submission = models.ForeignKey(
        ConferenceSubmission, on_delete=models.CASCADE, related_name='authors'
    )
    full_name = models.CharField(max_length=200)
    email = models.EmailField(blank=True)
    institution = models.CharField(max_length=300, blank=True)
    department = models.CharField(max_length=200, blank=True)
    designation = models.CharField(max_length=150, blank=True)
    country = models.CharField(max_length=120, blank=True, default='India')
    orcid = models.CharField(max_length=40, blank=True)
    order = models.PositiveIntegerField(default=1, validators=[MaxValueValidator(50)])
    is_corresponding = models.BooleanField(default=False)

    class Meta:
        ordering = ['order', 'id']
        verbose_name = 'Submission Author'
        verbose_name_plural = 'Submission Authors'

    def __str__(self):
        return f'{self.full_name} (#{self.order})'
