from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.utils.translation import gettext_lazy as _
from django.core.validators import RegexValidator
from django.utils import timezone

from core.models import PublicIDTrackable

phone_validator = RegexValidator(
    regex=r'^\d{10}$',
    message='Phone number must be exactly 10 digits.'
)

# Admin roles configurable from the /admin/access "Add Admin" flow.
# "super_admin" maps to Django's is_superuser; the other roles seed the
# per-section grant map on activation (see users.roles.permissions_for_role).
ADMIN_ROLE_CHOICES = (
    ('super_admin', 'Super Admin'),
    ('publication_admin', 'Publication Admin'),
    ('editorial_admin', 'Editorial Admin'),
    ('finance_admin', 'Finance Admin'),
    ('support_admin', 'Support Admin'),
)

class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError('The given email must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', False)
        extra_fields.setdefault('is_superuser', False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self._create_user(email, password, **extra_fields)

class User(PublicIDTrackable, AbstractUser):
    public_id_prefix = 'USR'  # MMSR-USR-1931-NNNNNN (spec §3)
    username = None
    email = models.EmailField(_('email address'), unique=True)
    # Administrative login email handed out through an invitation. `email`
    # stays the personal identity (public login is unchanged); staff may sign
    # in with either address — see users.backends.EmailOrWorkEmailBackend.
    work_email = models.EmailField(_('work email'), max_length=254, unique=True, null=True, blank=True)
    
    # Profile fields
    phone_number = models.CharField(max_length=15, blank=True, null=True, validators=[phone_validator])
    address = models.TextField(blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    country = models.CharField(max_length=100, blank=True, null=True)
    postal_code = models.CharField(max_length=20, blank=True, null=True)
    
    # Role-based fields
    is_author = models.BooleanField(default=False)

    # Granular CMS access granted by a super admin (/admin/access).
    # Shape: {"<section key>": "none" | "read" | "edit"}. Enforcement is
    # least-privilege: a section with no entry is denied, so every staff
    # account must carry a complete map (0009_seed_staff_admin_permissions
    # wrote one for pre-existing accounts; the invitation flow and the admin
    # add-form seed it for new ones).
    admin_permissions = models.JSONField(default=dict, blank=True)

    # Informational admin role label + team. The enforced permissions live
    # in admin_permissions; the role seeds sensible defaults on activation.
    admin_role = models.CharField(max_length=30, choices=ADMIN_ROLE_CHOICES, blank=True, default='')
    department = models.CharField(max_length=120, blank=True, default='')
    
    # Auth backend specific
    google_id = models.CharField(max_length=255, blank=True, null=True)
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    objects = UserManager()

    class Meta:
        # Stated explicitly because the abstract PublicIDTrackable base would
        # otherwise shadow the options AbstractUser.Meta contributes (see
        # users/migrations/0001_initial.py, which records them for `user`).
        verbose_name = _('user')
        verbose_name_plural = _('users')
        swappable = 'AUTH_USER_MODEL'

    def __str__(self):
        return self.email


class AdminInvitation(PublicIDTrackable):
    """Single-use invitation granting a user a CMS admin account.

    Only a SHA-256 hash of the token is stored; the raw token exists solely
    inside the activation link that was emailed. Resending replaces the hash
    (invalidating the old link) and pushes the expiry forward.
    """

    public_id_prefix = 'AIN'  # MMSR-AIN-1931-NNNNNN (spec §3)

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        ACCEPTED = 'accepted', 'Accepted'
        REVOKED = 'revoked', 'Revoked'

    # Work email — the administrative login address this invitation targets.
    email = models.EmailField(db_index=True, help_text='Work email: delivery address and admin login identifier.')
    # Account's personal email at invite time (audit/display only; never
    # overwritten by the work email).
    personal_email = models.EmailField(max_length=254, blank=True, default='',
                                       help_text='Personal email of the invitee\u2019s existing account.')
    full_name = models.CharField(max_length=200)
    role = models.CharField(max_length=30, choices=ADMIN_ROLE_CHOICES)
    # Explicit per-section grant map chosen by the Super Admin BEFORE sending
    # ({"<section>": "none|read|edit"}). Applied verbatim on activation so a
    # role preset can never override it. {} = legacy invitation → seed preset.
    permissions = models.JSONField(default=dict, blank=True)
    department = models.CharField(max_length=120, blank=True, default='')
    phone = models.CharField(max_length=20, blank=True, default='')
    notes = models.TextField(blank=True, default='', help_text='Internal notes; never emailed to the invitee.')

    # The (initially inactive) account this invitation will activate.
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='invitations')
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='invitations_sent'
    )

    token_hash = models.CharField(max_length=64)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    @property
    def is_expired(self):
        return self.status == self.Status.PENDING and self.expires_at < timezone.now()

    @property
    def effective_status(self):
        if self.status == self.Status.PENDING and self.is_expired:
            return 'expired'
        return self.status

    def __str__(self):
        return f'Invite {self.email} ({self.role}) — {self.effective_status}'


class AdminAuditEvent(PublicIDTrackable):
    """Append-only log of security-relevant admin access events.

    NEVER store passwords or raw invitation/reset tokens in `detail`.
    """

    public_id_prefix = 'AUD'  # MMSR-AUD-1931-NNNNNN (spec §3)

    class Action(models.TextChoices):
        INVITATION_CREATED = 'invitation_created', 'Invitation created'
        INVITATION_SENT = 'invitation_sent', 'Invitation email sent'
        INVITATION_SEND_FAILED = 'invitation_send_failed', 'Invitation email failed'
        INVITATION_RESENT = 'invitation_resent', 'Invitation resent'
        INVITATION_REVOKED = 'invitation_revoked', 'Invitation revoked'
        ACCOUNT_ACTIVATED = 'account_activated', 'Account activated'
        ROLE_CHANGED = 'role_changed', 'Admin role changed'
        PERMISSIONS_CHANGED = 'permissions_changed', 'CMS permissions changed'
        ACCOUNT_DEACTIVATED = 'account_deactivated', 'Account deactivated'
        ACCOUNT_REACTIVATED = 'account_reactivated', 'Account reactivated'
        PASSWORD_CHANGED = 'password_changed', 'Password changed'
        PASSWORD_RESET_REQUESTED = 'password_reset_requested', 'Password reset requested'
        PASSWORD_RESET_COMPLETED = 'password_reset_completed', 'Password reset completed'

    class Result(models.TextChoices):
        SUCCESS = 'success', 'Success'
        FAILED = 'failed', 'Failed'

    actor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_actions')
    actor_email = models.CharField(max_length=254, blank=True, default='')
    target = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_records')
    target_email = models.CharField(max_length=254, blank=True, default='')
    action = models.CharField(max_length=40, choices=Action.choices)
    result = models.CharField(max_length=10, choices=Result.choices, default=Result.SUCCESS)
    detail = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.action} → {self.target_email} ({self.result}) @ {self.created_at:%Y-%m-%d %H:%M}'
