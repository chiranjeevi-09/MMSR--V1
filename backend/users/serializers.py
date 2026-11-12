from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from form_validation import validate_phone_number, validate_optional_indian_pin, validate_alpha_text
from .models import ADMIN_ROLE_CHOICES, AdminInvitation
from .roles import ALL_SECTION_KEYS

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    # ADM display identity, for staff accounts only (spec §2 architecture
    # mapping). Customer rows resolve to null without touching the table, so
    # nested author serialization gains no queries.
    admin_public_id = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            'id', 'public_id', 'admin_public_id', 'email', 'work_email',
            'first_name', 'last_name',
            'phone_number', 'address', 'city', 'country', 'postal_code',
            'is_author', 'is_staff', 'is_superuser', 'admin_permissions',
            'admin_role', 'department',
        )
        # Profile is self-service: role/permission flags are surfaced for the
        # sidebar to render but only changeable through the admin user APIs.
        read_only_fields = ('id', 'public_id', 'admin_public_id', 'work_email', 'is_author', 'is_staff', 'is_superuser', 'admin_permissions', 'admin_role', 'department')

    def get_admin_public_id(self, obj):
        if not obj.is_staff:
            return None
        # Views that serialize several staff users at once select_related
        # 'admin_profile', which keeps this at zero extra queries.
        profile = getattr(obj, 'admin_profile', None)
        return profile.public_id if profile is not None else None

    # Model validators do NOT run through DRF, so the business rules are
    # re-declared here (backend/form_validation.py is the single source).
    def validate_phone_number(self, value):
        return validate_phone_number(value)

    def validate_postal_code(self, value):
        return validate_optional_indian_pin(value)

    # Person name is letters-only (no digits); blank allowed so clearing a
    # name never errors, but a typed value must be a valid name.
    def validate_first_name(self, value):
        return validate_alpha_text(value, 'First name')

    def validate_last_name(self, value):
        return validate_alpha_text(value, 'Last name')

class AdminUserSerializer(serializers.ModelSerializer):
    """Staff-only representation used by /api/users/ management endpoints."""
    # The ADM identity lives on the one-to-one core.AdminProfile row (spec §2
    # architecture mapping: admins are User rows here). The view resolves it
    # with select_related, so a listing stays a constant number of queries.
    admin_public_id = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            'id', 'public_id', 'admin_public_id', 'email', 'work_email',
            'first_name', 'last_name',
            'phone_number', 'address', 'city', 'country', 'postal_code',
            'is_author', 'is_staff', 'is_superuser', 'is_active',
            'date_joined', 'last_login', 'admin_permissions',
            'admin_role', 'department',
        )
        # Email is the identity key and the superuser flag must never be
        # toggled over the API; the work email is minted by the invitation
        # flow only. Everything else is admin-editable.
        read_only_fields = ('id', 'public_id', 'admin_public_id', 'email', 'work_email',
                            'is_superuser', 'date_joined', 'last_login')

    def get_admin_public_id(self, obj):
        # Missing profile (an account that predates Phase 5 and was never
        # activated through the admin flow) renders as null, never as the PK.
        profile = getattr(obj, 'admin_profile', None)
        return profile.public_id if profile is not None else None

    def validate_admin_permissions(self, value):
        """Normalise the per-section grant map written by /admin/access."""
        if value in (None, ''):
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError('admin_permissions must be an object.')
        allowed = ('none', 'read', 'edit')
        cleaned = {}
        for key, level in value.items():
            if level is None:
                continue
            if level not in allowed:
                raise serializers.ValidationError(f"Invalid access level '{level}'.")
            cleaned[str(key)] = level
        return cleaned

    def validate_phone_number(self, value):
        return validate_phone_number(value)

    def validate_postal_code(self, value):
        return validate_optional_indian_pin(value)

class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    
    class Meta:
        model = User
        fields = ('email', 'password', 'first_name', 'last_name', 'phone_number')
    
    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user

    def validate_phone_number(self, value):
        # Optional at registration; when present it must be a valid mobile.
        return validate_phone_number(value)

    def validate_first_name(self, value):
        return validate_alpha_text(value, 'First name')

    def validate_last_name(self, value):
        return validate_alpha_text(value, 'Last name')

class GoogleAuthSerializer(serializers.Serializer):
    token = serializers.CharField(required=True)

class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)

class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField(required=True)
    token = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, write_only=True, validators=[validate_password])


class ChangePasswordSerializer(serializers.Serializer):
    """Authenticated user changes their own password."""
    current_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True, validators=[validate_password])


class VerifyPasswordSerializer(serializers.Serializer):
    """Checks the account's current password before revealing change fields."""
    current_password = serializers.CharField(required=True, write_only=True)


class AdminInvitationCreateSerializer(serializers.Serializer):
    """Validated payload for the /admin/access 'Add Admin' invitation wizard.

    ``email`` is the WORK email (delivery address + admin login identifier).
    ``personal_email``/``user_id`` carry the invitee's existing identity so
    the personal email is never overwritten; both may be omitted by legacy
    single-email callers, in which case ``email`` is the account identity.
    ``permissions`` is the explicit grant map chosen before sending —
    a section missing from it becomes "none", never an implicit "edit".
    """
    full_name = serializers.CharField(max_length=200)
    email = serializers.EmailField()
    personal_email = serializers.EmailField(required=False, allow_blank=True)
    user_id = serializers.IntegerField(required=False, allow_null=True)
    role = serializers.ChoiceField(choices=ADMIN_ROLE_CHOICES)
    department = serializers.CharField(max_length=120, required=False, allow_blank=True, default='')
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True, default='')
    notes = serializers.CharField(required=False, allow_blank=True, default='')
    permissions = serializers.DictField(required=False, child=serializers.CharField(allow_blank=True))

    def validate_phone(self, value):
        # Staff contact mobile: optional, but when present it must be a valid
        # 10-digit Indian number — the same rule that lands on the profile.
        return validate_phone_number(value) or ''

    def validate_permissions(self, value):
        allowed = ('none', 'read', 'edit')
        cleaned = {}
        for key, level in (value or {}).items():
            if key not in ALL_SECTION_KEYS:
                raise serializers.ValidationError(f"Unknown CMS section '{key}'.")
            if level not in allowed:
                raise serializers.ValidationError(f"Invalid access level '{level}' for '{key}'.")
            cleaned[key] = level
        return cleaned


class AdminInvitationSerializer(serializers.ModelSerializer):
    """Read-only representation used by the Admin Access table."""
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    status = serializers.CharField(source='effective_status', read_only=True)
    created_by_email = serializers.CharField(source='created_by.email', default='', read_only=True)

    class Meta:
        model = AdminInvitation
        fields = (
            'id', 'public_id', 'email', 'personal_email', 'full_name', 'role', 'role_display',
            'department', 'phone', 'notes', 'permissions', 'status', 'created_at',
            'sent_at', 'expires_at', 'accepted_at', 'revoked_at', 'created_by_email',
            'user',
        )
        read_only_fields = fields


class InvitationAcceptSerializer(serializers.Serializer):
    """Payload for activating an invited admin account (public, throttled)."""
    token = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True, validators=[validate_password])

