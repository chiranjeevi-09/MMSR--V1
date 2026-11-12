from rest_framework import serializers
from form_validation import validate_phone_number, validate_document_file, validate_image_file
from core.image_processing import get_variant_url
from .models import Submission, PublishedVolume
from users.serializers import UserSerializer

# 10 MB in bytes
MAX_FILE_SIZE = 10 * 1024 * 1024
ALLOWED_EXTENSIONS = {'pdf', 'doc', 'docx'}

# field name -> url segment of the authorised download route
PROTECTED_DOCUMENTS = {
    'manuscript_file': 'manuscript',
    'cover_letter': 'cover-letter',
    'certificate_file': 'notice',
}

# Reverse mapping: url segment -> model field name (supports 'notice' and 'certificate' alias)
DOCUMENT_KIND_TO_FIELD = {
    'manuscript': 'manuscript_file',
    'cover-letter': 'cover_letter',
    'cover_letter': 'cover_letter',
    'notice': 'certificate_file',
    'certificate': 'certificate_file',
}


class ProtectedDocumentsMixin:
    """Serialize submission documents as authorised URLs, never as paths.

    SECURITY-QA-REPORT C-1 / H-2: the manuscript, cover letter and publication
    notice used to live in the publicly served MEDIA_ROOT, so the API handed out
    ``/media/submissions/...`` links and — worse — those links worked with no
    authentication at all. They are now in PROTECTED_MEDIA_ROOT, where a file
    has no URL; ``use_url=False`` keeps DRF from asking for one (the raw storage
    key it would return is overwritten below and never leaves the process), and
    the value a client sees is the download view that re-checks owner-or-staff
    on every request.
    """

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ref = instance.public_id or instance.pk
        for field, kind in PROTECTED_DOCUMENTS.items():
            if field not in ret:
                continue
            has_file = bool(getattr(instance, field, None))
            ret[field] = f"/api/submissions/{ref}/documents/{kind}/" if has_file else None
        return ret


class PublishedVolumeSerializer(serializers.ModelSerializer):
    cover_image_webp = serializers.SerializerMethodField()

    class Meta:
        model = PublishedVolume
        fields = '__all__'

    def get_cover_image_webp(self, obj):
        return get_variant_url(obj.cover_image, variant='webp', request=self.context.get('request'))

    def validate_cover_image(self, value):
        if value:
            return validate_image_file(value)
        return value


class SubmissionSerializer(ProtectedDocumentsMixin, serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    volume_title = serializers.CharField(source='volume.title', read_only=True, default=None)
    book_title = serializers.CharField(source='book.title', read_only=True, default=None)
    submission_type_display = serializers.CharField(source='get_submission_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    # See ProtectedDocumentsMixin: writable for uploads, rendered as a download
    # endpoint on the way out — never as a storage path or media URL.
    manuscript_file = serializers.FileField(use_url=False, required=False, allow_null=True)
    cover_letter = serializers.FileField(use_url=False, required=False, allow_null=True)
    certificate_file = serializers.FileField(use_url=False, read_only=True)
    # ISBN of the linked book, surfaced read-only for the admin Publication Notice card.
    book_isbn = serializers.SerializerMethodField()
    # Editorial remarks / reviewer notes. Stored in the model's admin_notes field
    # but surfaced and written under the 'editorial_notes' key that both the admin
    # review drawer and the author's submission detail page read. Readable by the
    # author; writable only by staff (enforced in __init__) so a submitted
    # manuscript cannot self-author its own editorial feedback.
    editorial_notes = serializers.CharField(source='admin_notes', required=False, allow_blank=True)

    def get_book_isbn(self, obj):
        return obj.book.isbn if obj.book_id and obj.book else None

    class Meta:
        model = Submission
        fields = '__all__'
        read_only_fields = ('author', 'submitted_at', 'updated_at', 'admin_notes', 'certificate_issued', 'certificate_file')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        is_staff = bool(user is not None and getattr(user, 'is_authenticated', False)
                        and (getattr(user, 'is_staff', False) or getattr(user, 'is_superuser', False)))
        # Only staff may write editorial remarks, advance the workflow status, or
        # flip the certificate issuance flag; authors see all three as output-only
        # so they cannot self-approve or fake editorial feedback. Non-staff PATCH
        # requests silently drop these keys.
        if 'editorial_notes' in self.fields:
            self.fields['editorial_notes'].read_only = not is_staff
        if 'status' in self.fields:
            self.fields['status'].read_only = not is_staff
        if 'certificate_issued' in self.fields:
            self.fields['certificate_issued'].read_only = not is_staff
        # L-3: which book/volume a manuscript is filed under, and which pricing
        # tier it is billed at, are editorial decisions. An author PATCHing them
        # could re-attach a paper to a different volume or drop themselves to the
        # free tier, so they are output-only outside staff as well.
        for editable_for_staff in ('book', 'volume', 'pricing_tier'):
            if editable_for_staff in self.fields:
                self.fields[editable_for_staff].read_only = not is_staff


class SubmissionCreateSerializer(ProtectedDocumentsMixin, serializers.ModelSerializer):
    # Author agreement flags. Write-only and validated server-side; the actual accepted
    # policy versions are resolved by the backend (never trusted from the client).
    agreed_to_terms = serializers.BooleanField(required=True, write_only=True)
    agreed_to_publication_policies = serializers.BooleanField(required=True, write_only=True)
    # Same treatment as SubmissionSerializer — the 201 response renders these.
    manuscript_file = serializers.FileField(use_url=False, required=False, allow_null=True)
    cover_letter = serializers.FileField(use_url=False, required=False, allow_null=True)

    class Meta:
        model = Submission
        fields = (
            'id',
            'submission_type',
            'volume',
            'book',
            'title',
            'abstract',
            'keywords',
            'co_authors',
            'category',
            'author_affiliation',
            'corresponding_email',
            'phone_number',
            'country',
            'whatsapp_consent',
            'pricing_tier',
            'manuscript_file',
            'cover_letter',
            'agreed_to_terms',
            'agreed_to_publication_policies',
        )

    def validate_agreed_to_terms(self, value):
        if not value:
            raise serializers.ValidationError(
                'You must agree to the Terms and Conditions before submitting.'
            )
        return value

    def validate_agreed_to_publication_policies(self, value):
        if not value:
            raise serializers.ValidationError(
                'You must agree to the Publication Policies and Ethics before submitting.'
            )
        return value

    def validate_phone_number(self, value):
        # Optional author contact: blank stays blank; anything else must be a
        # valid 10-digit Indian mobile (model rule, enforced here because DRF
        # does not run model validators).
        return validate_phone_number(value)

    def _validate_file(self, value, field_label):
        """Shared file validator: check extension, size, path traversal, and magic bytes."""
        if value:
            return validate_document_file(
                value,
                field_label=field_label,
                max_size_bytes=MAX_FILE_SIZE,
                allowed_extensions=ALLOWED_EXTENSIONS,
            )
        return value

    def validate_manuscript_file(self, value):
        return self._validate_file(value, 'Manuscript file')

    def validate_cover_letter(self, value):
        return self._validate_file(value, 'Cover letter')
