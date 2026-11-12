import uuid

from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError

from core.models import PublicIDTrackable


class Policy(PublicIDTrackable):
    """A stable policy identity. Exactly one non-archived Policy exists per canonical
    policy_type so the public site never has two contradictory live policies."""

    public_id_prefix = 'POL'  # MMSR-POL-1931-NNNNNN (spec §3)

    POLICY_TYPE_CHOICES = (
        ('terms', 'Terms and Conditions'),
        ('privacy', 'Privacy Policy'),
        ('publication_policies', 'Publication Policies and Ethics'),
    )

    # Canonical front-end routes per policy type. Used by public pages and the
    # submission agreement links so routing stays consistent with the DB.
    CANONICAL_ROUTE = {
        'terms': '/terms-and-conditions',
        'privacy': '/privacy-policy',
        'publication_policies': '/publication-policies',
    }

    policy_type = models.CharField(max_length=40, choices=POLICY_TYPE_CHOICES, unique=True)
    title = models.CharField(max_length=255)
    is_archived = models.BooleanField(
        default=False,
        help_text="Archived policies are hidden from the public site but retained for audit.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['policy_type']
        verbose_name = 'Policy'
        verbose_name_plural = 'Policies'

    def __str__(self):
        return f"{self.title} ({self.get_policy_type_display()})"

    @property
    def canonical_route(self):
        return self.CANONICAL_ROUTE.get(self.policy_type, '/')

    @property
    def current_version(self):
        """The currently published version, or None."""
        return self.versions.filter(status='published').order_by('-published_at').first()

    @property
    def latest_version(self):
        """The most recently created version regardless of status (draft or published)."""
        return self.versions.order_by('-created_at', '-id').first()


class PolicyVersion(PublicIDTrackable):
    """An immutable snapshot of policy content. Once published it is never edited in
    place; new content is created as a new version so historical acceptance records
    always resolve to the exact text that was accepted."""

    public_id_prefix = 'PLV'  # MMSR-PLV-1931-NNNNNN (spec §3)

    STATUS_CHOICES = (
        ('draft', 'Draft'),
        ('published', 'Published'),
        ('unpublished', 'Unpublished'),
        ('archived', 'Archived'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    policy = models.ForeignKey(Policy, on_delete=models.CASCADE, related_name='versions')
    version = models.CharField(max_length=20, help_text="e.g. 1.0, 1.1, 2.0")
    title = models.CharField(max_length=255)
    content = models.TextField(help_text="Policy body stored as safe Markdown.")
    content_format = models.CharField(max_length=20, default='markdown', editable=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    effective_date = models.DateField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    change_summary = models.TextField(blank=True, help_text="Internal change summary / revision note. Never shown publicly.")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='authored_policy_versions',
    )
    last_edited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='edited_policy_versions',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at', '-id']
        verbose_name = 'Policy Version'
        verbose_name_plural = 'Policy Versions'
        indexes = [
            models.Index(fields=['policy', 'status', '-published_at']),
        ]
        constraints = [
            # Only one published version per policy at any time.
            models.UniqueConstraint(
                fields=['policy'],
                condition=models.Q(status='published'),
                name='unique_published_version_per_policy',
            ),
            # Version identifiers must be unique within a policy.
            models.UniqueConstraint(
                fields=['policy', 'version'],
                name='unique_version_number_per_policy',
            ),
        ]

    def __str__(self):
        return f"{self.policy.title} v{self.version} [{self.get_status_display()}]"

    def clean(self):
        super().clean()
        # Historical (published/archived) content is immutable.
        if self.pk:
            db_self = PolicyVersion.objects.filter(pk=self.pk).first()
            if db_self and db_self.status in ('published', 'archived'):
                if self.content != db_self.content:
                    raise ValidationError(
                        "Published or archived policy versions are immutable. "
                        "Create a new version instead of editing historical content."
                    )

    def is_referenced_by_acceptance(self):
        return self.acceptance_records.exists()


class PolicyAcceptance(PublicIDTrackable):
    """An auditable, append-only record that a specific authenticated user accepted a
    specific published policy version. Stores an immutable content snapshot so the
    exact accepted text remains available even after the policy is later revised."""

    public_id_prefix = 'PLA'  # MMSR-PLA-1931-NNNNNN (spec §3)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='policy_acceptances',
        help_text="Resolved from the authenticated request, never from client input.",
    )
    # Linked manuscript submission (nullable so the record survives submission deletion
    # for audit purposes). Cross-app reference kept as a lazy string.
    submission = models.ForeignKey(
        'submissions.Submission', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='policy_acceptances',
    )
    policy = models.ForeignKey(Policy, on_delete=models.PROTECT, related_name='acceptance_records')
    policy_version = models.ForeignKey(
        PolicyVersion, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='acceptance_records',
    )
    policy_type = models.CharField(max_length=40, choices=Policy.POLICY_TYPE_CHOICES)
    version_number = models.CharField(max_length=20, blank=True)
    content_snapshot = models.TextField(help_text="Immutable copy of the exact accepted content.")
    agreement_text = models.TextField(blank=True, help_text="The statement the author agreed to.")
    # Server-generated timestamp (auto). Never trusted from the client.
    accepted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-accepted_at']
        verbose_name = 'Policy Acceptance Record'
        verbose_name_plural = 'Policy Acceptance Records'
        indexes = [
            models.Index(fields=['policy_type', 'accepted_at']),
            models.Index(fields=['user', 'accepted_at']),
        ]

    def __str__(self):
        who = self.user.email if self.user else 'Anonymous'
        ref = f"submission #{self.submission_id}" if self.submission_id else "no submission"
        return f"{who} accepted {self.get_policy_type_display()} v{self.version_number} ({ref})"
