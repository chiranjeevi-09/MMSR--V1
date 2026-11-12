from rest_framework import serializers

from .models import Policy, PolicyVersion, PolicyAcceptance


class PolicyVersionPublicSerializer(serializers.ModelSerializer):
    """Only what the public site is allowed to see for a published version."""
    class Meta:
        model = PolicyVersion
        fields = ('id', 'public_id', 'title', 'version', 'content', 'content_format', 'effective_date', 'published_at')
        read_only_fields = fields


class PolicyAdminVersionSerializer(serializers.ModelSerializer):
    """Full version detail for administrators (includes internal revision notes)."""
    created_by_email = serializers.CharField(source='created_by.email', read_only=True, default=None)
    last_edited_by_email = serializers.CharField(source='last_edited_by.email', read_only=True, default=None)
    acceptance_count = serializers.IntegerField(source='acceptance_records.count', read_only=True)

    class Meta:
        model = PolicyVersion
        fields = (
            'id', 'public_id', 'policy', 'version', 'title', 'content', 'content_format', 'status',
            'effective_date', 'published_at', 'change_summary',
            'created_by', 'created_by_email', 'last_edited_by', 'last_edited_by_email',
            'acceptance_count', 'created_at', 'updated_at',
        )
        read_only_fields = (
            'id', 'public_id', 'published_at', 'created_by', 'last_edited_by', 'content_format',
            'created_at', 'updated_at', 'acceptance_count',
        )


class PolicyDraftSerializer(serializers.Serializer):
    """Payload for creating/updating a draft version."""
    content = serializers.CharField()
    title = serializers.CharField(required=False, allow_blank=True)
    effective_date = serializers.DateField(required=False, allow_null=True)
    change_summary = serializers.CharField(required=False, allow_blank=True)
    # Optional: draft on top of a specific existing version id (used by "restore").
    base_version = serializers.CharField(required=False, allow_blank=True)


class PolicyAdminSerializer(serializers.ModelSerializer):
    """Policy list/detail for admins, enriched with current/latest version metadata."""
    policy_type_display = serializers.CharField(source='get_policy_type_display', read_only=True)
    canonical_route = serializers.CharField(read_only=True)
    current_version_number = serializers.CharField(source='current_version.version', read_only=True, default=None)
    current_version_id = serializers.UUIDField(source='current_version.id', read_only=True, default=None)
    current_effective_date = serializers.DateField(source='current_version.effective_date', read_only=True, default=None)
    current_published_at = serializers.DateTimeField(source='current_version.published_at', read_only=True, default=None)
    latest_version_id = serializers.UUIDField(source='latest_version.id', read_only=True, default=None)
    latest_status = serializers.CharField(source='latest_version.status', read_only=True, default=None)
    last_updated_by_email = serializers.SerializerMethodField()
    versions_count = serializers.IntegerField(source='versions.count', read_only=True)
    has_draft = serializers.SerializerMethodField()
    draft_version_number = serializers.SerializerMethodField()

    class Meta:
        model = Policy
        fields = (
            'id', 'public_id', 'policy_type', 'policy_type_display', 'title', 'is_archived',
            'canonical_route', 'current_version_number', 'current_version_id',
            'current_effective_date', 'current_published_at',
            'latest_version_id', 'latest_status', 'versions_count',
            'last_updated_by_email', 'has_draft', 'draft_version_number',
            'created_at', 'updated_at',
        )
        read_only_fields = fields

    def get_has_draft(self, obj):
        return obj.versions.filter(status='draft').exists()

    def get_draft_version_number(self, obj):
        draft = obj.versions.filter(status='draft').order_by('-created_at').first()
        return draft.version if draft else None

    def get_last_updated_by_email(self, obj):
        latest = obj.latest_version
        if not latest:
            return None
        editor = latest.last_edited_by or latest.created_by
        return editor.email if editor else None


class PolicyAcceptanceAdminSerializer(serializers.ModelSerializer):
    """Read-only view of acceptance audit records for administrators."""
    user_email = serializers.CharField(source='user.email', read_only=True, default=None)
    user_name = serializers.SerializerMethodField()
    policy_title = serializers.CharField(source='policy.title', read_only=True, default=None)
    policy_type_display = serializers.CharField(source='get_policy_type_display', read_only=True)
    submission_id = serializers.IntegerField(source='submission.id', read_only=True, default=None)
    # Standardized references of the linked rows, so the audit screen never has
    # to quote an internal primary key (Phase 5 spec §11). The existing numeric
    # fields stay exactly as they are for current consumers.
    user_public_id = serializers.CharField(source='user.public_id', read_only=True, default=None)
    submission_public_id = serializers.CharField(source='submission.public_id', read_only=True, default=None)
    policy_version_public_id = serializers.CharField(source='policy_version.public_id', read_only=True, default=None)

    class Meta:
        model = PolicyAcceptance
        fields = (
            'id', 'public_id', 'user', 'user_email', 'user_name', 'user_public_id',
            'submission', 'submission_id', 'submission_public_id',
            'policy', 'policy_title', 'policy_type', 'policy_type_display',
            'policy_version', 'policy_version_public_id', 'version_number', 'content_snapshot',
            'agreement_text', 'accepted_at',
        )
        read_only_fields = fields

    def get_user_name(self, obj):
        """Best available author name for the linked user (null if user was removed)."""
        if not obj.user:
            return None
        full = obj.user.get_full_name().strip() if hasattr(obj.user, 'get_full_name') else ''
        return full or getattr(obj.user, 'username', '') or obj.user.email
