from django.db import models
from django.conf import settings
from django.core.validators import RegexValidator, FileExtensionValidator

from core.models import PublicIDTrackable

# Author uploads and issued notices are confidential pre-publication work.
# They used to land in the publicly served MEDIA_ROOT under the author's own
# filename (SECURITY-QA-REPORT C-1 / H-2) and now use the same protected store
# the conference pipeline already had.
from core.storages import protected_storage  # noqa: E402

phone_validator = RegexValidator(
    regex=r'^\d{10}$',
    message='Phone number must be exactly 10 digits.'
)

class PublishedVolume(PublicIDTrackable):
    """Represents an available volume that authors can submit chapters to."""
    public_id_prefix = 'VOL'  # MMSR-VOL-1931-NNNNNN (spec §3)
    title = models.CharField(max_length=255, help_text="e.g., Volume 3 – Applied Sciences 2024")
    subject_area = models.CharField(max_length=150)
    year = models.PositiveIntegerField()
    description = models.TextField(blank=True)
    is_accepting_chapters = models.BooleanField(default=True)
    deadline = models.DateField(null=True, blank=True)
    cover_image = models.ImageField(upload_to='volumes/covers/', blank=True, null=True)
    price_indian = models.DecimalField(max_digits=10, decimal_places=2, default=2000.00, help_text="Price in INR for Indian authors")
    price_international = models.DecimalField(max_digits=10, decimal_places=2, default=100.00, help_text="Price in USD for international authors")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-year', '-created_at']

    def __str__(self):
        return self.title


class Submission(PublicIDTrackable):
    public_id_prefix = 'SUB'  # MMSR-SUB-1931-NNNNNN (spec §3)

    STATUS_CHOICES = (
        ('pending', 'Pending Review'),
        ('editorial_screening', 'Editorial Screening'),
        ('under_review', 'Under Review'),
        ('accepted', 'Accepted'),
        ('revision_required', 'Revision Required'),
        ('rejected', 'Rejected'),
        ('published', 'Published'),
    )

    SUBMISSION_TYPE_CHOICES = (
        ('book_chapter', 'Book Chapter'),
        ('full_book', 'Full Book'),
        ('journal_article', 'Journal Article'),
    )

    PRICING_TIER_CHOICES = (
        ('indian', 'Indian Author'),
        ('international', 'International Author'),
        ('discounted', 'Discounted Package'),
    )

    # Core author info
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='submissions')
    author_affiliation = models.CharField(max_length=500, blank=True, help_text="University / Institution / Organization")
    corresponding_email = models.EmailField(blank=True)
    phone_number = models.CharField(max_length=20, blank=True, validators=[phone_validator])
    country = models.CharField(max_length=100, blank=True, default='India')
    whatsapp_consent = models.BooleanField(default=False, help_text="Author agrees to receive updates on WhatsApp")

    # Submission type & target
    submission_type = models.CharField(max_length=30, choices=SUBMISSION_TYPE_CHOICES, default='book_chapter')
    volume = models.ForeignKey(PublishedVolume, null=True, blank=True, on_delete=models.SET_NULL, related_name='submissions', help_text="Target volume for book chapter submissions")
    book = models.ForeignKey('publications.Book', null=True, blank=True, on_delete=models.SET_NULL, related_name='submissions', help_text="Target edited book selected on the submission form")

    # Manuscript details
    title = models.CharField(max_length=500)
    abstract = models.TextField()
    keywords = models.CharField(max_length=500, blank=True, help_text="Comma-separated keywords (3–6)")
    co_authors = models.TextField(blank=True, help_text="Co-author names and affiliations, one per line")
    category = models.CharField(max_length=100, default='General')

    # Files (protected storage — served only by the owner-or-staff download views)
    manuscript_file = models.FileField(
        upload_to='submissions/manuscripts/',
        storage=protected_storage,
        validators=[FileExtensionValidator(allowed_extensions=['pdf', 'doc', 'docx'])]
    )
    cover_letter = models.FileField(
        upload_to='submissions/cover_letters/',
        storage=protected_storage,
        blank=True,
        null=True,
    )

    # Pricing & admin
    pricing_tier = models.CharField(max_length=30, choices=PRICING_TIER_CHOICES, default='indian', blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    admin_notes = models.TextField(blank=True, help_text="Internal notes for admins")

    # Author agreement (server-validated; detailed versions live in PolicyAcceptance).
    agreed_to_terms = models.BooleanField(
        default=False,
        help_text="Author explicitly agreed to the published Terms and Conditions.",
    )
    agreed_to_publication_policies = models.BooleanField(
        default=False,
        help_text="Author explicitly agreed to the published Publication Policies and Ethics.",
    )

    # Certificate
    certificate_issued = models.BooleanField(default=False)
    certificate_file = models.FileField(
        upload_to='submissions/certificates/',
        storage=protected_storage,
        blank=True,
        null=True,
    )

    # Timestamps
    submitted_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-submitted_at']

    def __str__(self):
        return f"{self.title} by {self.author.email} [{self.get_submission_type_display()}]"
