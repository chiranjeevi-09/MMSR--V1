from rest_framework import serializers
from form_validation import validate_image_file
from core.image_processing import get_variant_url
from django.conf import settings
import json
import re

from .models import (
    Conference,
    ConferenceSubmission,
    ConferenceSubmissionAuthor,
    MANUSCRIPT_EXTENSIONS,
)

PAID_STATUSES = ('submitted', 'under_review', 'revision_required', 'accepted',
                 'rejected', 'camera_ready', 'published')


class LooseJSONField(serializers.JSONField):
    """Accepts either a native JSON value (application/json body) or a
    JSON-encoded string (multipart/form-data)."""

    def to_internal_value(self, data):
        if isinstance(data, (str, bytes)):
            try:
                decoded = json.loads(data)
            except (ValueError, TypeError):
                self.fail('invalid')
            return super().to_internal_value(decoded)
        return super().to_internal_value(data)


# 10 MB — matches the existing submissions module convention
MAX_FILE_SIZE = 10 * 1024 * 1024
MAX_CO_AUTHORS = 10


class ConferenceSerializer(serializers.ModelSerializer):
    """Public read serializer + admin write serializer for conferences."""
    accepting = serializers.BooleanField(read_only=True)
    submissions_count = serializers.SerializerMethodField()
    total_collected = serializers.SerializerMethodField()
    cover_image_webp = serializers.SerializerMethodField()
    banner_image_webp = serializers.SerializerMethodField()

    class Meta:
        model = Conference
        fields = [
            'id', 'public_id', 'title', 'slug', 'acronym', 'description', 'full_description',
            'start_date', 'end_date', 'venue', 'country', 'mode', 'domain', 'status',
            'organizer', 'submission_deadline', 'registration_deadline',
            'registration_open', 'submission_fee', 'is_accepting_submissions', 'accepting',
            'doi_prefix', 'isbn_proceedings', 'submission_guidelines', 'call_for_papers',
            'tracks', 'important_dates', 'cover_image', 'cover_image_webp', 'banner_image', 'banner_image_webp', 'created_at',
            'submissions_count', 'total_collected',
        ]
        read_only_fields = ['id', 'public_id', 'slug', 'created_at', 'submissions_count', 'total_collected', 'cover_image_webp', 'banner_image_webp']

    def get_cover_image_webp(self, obj):
        return get_variant_url(obj.cover_image, variant='webp', request=self.context.get('request'))

    def get_banner_image_webp(self, obj):
        return get_variant_url(obj.banner_image, variant='webp', request=self.context.get('request'))

    def validate(self, attrs):
        # Cross-field date ordering — the authoritative layer for the admin
        # conference form (client maxLength/date pickers protect nothing).
        start = attrs.get('start_date') or getattr(self.instance, 'start_date', None)
        end = attrs.get('end_date', getattr(self.instance, 'end_date', None))
        if start and end and end < start:
            raise serializers.ValidationError({'end_date': 'End date cannot be before the start date.'})
        return attrs

    def validate_cover_image(self, value):
        if value:
            return validate_image_file(value)
        return value

    def validate_banner_image(self, value):
        if value:
            return validate_image_file(value)
        return value

    def get_submissions_count(self, obj):
        if hasattr(obj, 'annotated_submissions_count'):
            return obj.annotated_submissions_count
        return obj.submissions.filter(status__in=PAID_STATUSES).count()

    def get_total_collected(self, obj):
        if hasattr(obj, 'annotated_total_collected'):
            return float(obj.annotated_total_collected or 0)
        from django.db.models import Sum
        total = obj.submissions.filter(status__in=PAID_STATUSES).aggregate(s=Sum('submission_fee'))['s']
        return float(total or 0)


class ConferenceSubmissionAuthorSerializer(serializers.ModelSerializer):
    """Read serializer for ordered co-author records."""

    class Meta:
        model = ConferenceSubmissionAuthor
        fields = [
            'id', 'public_id', 'full_name', 'email', 'institution', 'department',
            'designation', 'country', 'order', 'is_corresponding',
        ]
        read_only_fields = ['id', 'public_id']


class ConferenceSubmissionAuthorCreateSerializer(serializers.Serializer):
    """Write-side validation for a single co-author entry."""
    full_name = serializers.CharField(max_length=200)
    email = serializers.EmailField(required=False, allow_blank=True)
    institution = serializers.CharField(max_length=300, required=False, allow_blank=True)
    department = serializers.CharField(max_length=200, required=False, allow_blank=True)
    designation = serializers.CharField(max_length=150, required=False, allow_blank=True)
    country = serializers.CharField(max_length=120, required=False, allow_blank=True)
    order = serializers.IntegerField(required=False, min_value=1, max_value=50)
    is_corresponding = serializers.BooleanField(required=False, default=False)

    def validate_full_name(self, value):
        value = (value or '').strip()
        if not value:
            raise serializers.ValidationError('Co-author full name is required.')
        return value


class ConferenceSubmissionSerializer(serializers.ModelSerializer):
    """Read serializer returned to the submitting author and staff."""
    authors = ConferenceSubmissionAuthorSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    paper_type_display = serializers.CharField(source='get_paper_type_display', read_only=True)
    conference_title = serializers.CharField(source='conference.title', read_only=True)
    conference_acronym = serializers.CharField(source='conference.acronym', read_only=True)
    conference_slug = serializers.CharField(source='conference.slug', read_only=True)
    has_invoice = serializers.SerializerMethodField()

    class Meta:
        model = ConferenceSubmission
        fields = [
            'id', 'public_id', 'reference_number', 'title', 'subtitle', 'abstract', 'keywords',
            'paper_type', 'paper_type_display', 'research_domain', 'language',
            'selected_track', 'presentation_mode', 'session_preference',
            'registration_category', 'proceedings_preference', 'gst_invoice_required',
            'author_full_name', 'author_email', 'author_phone', 'institution',
            'department', 'designation', 'country',
            'conference', 'conference_title', 'conference_acronym', 'conference_slug',
            'authors', 'status', 'status_display', 'declarations',
            'submission_fee', 'razorpay_order_id', 'razorpay_payment_id',
            'has_invoice', 'admin_notes', 'decision_notes',
            'submitted_at', 'updated_at',
        ]
        read_only_fields = fields

    def get_has_invoice(self, obj):
        return bool(obj.invoice_pdf)


class ConferenceSubmissionCreateSerializer(serializers.ModelSerializer):
    co_authors = LooseJSONField(required=False)
    declarations = LooseJSONField(required=False)
    # Declared explicitly (without the model's strict `^\d{10}$` RegexValidator)
    # so normal user input like "+91 98765 43210" or "98765-43210" is accepted,
    # normalized in validate_author_phone below. Otherwise the form's own phone
    # placeholder produces a 400 "paper submission failed" for real users.
    author_phone = serializers.CharField(required=False, allow_blank=True, max_length=20)

    class Meta:
        model = ConferenceSubmission
        fields = [
            'conference', 'client_reference',
            'title', 'subtitle', 'abstract', 'keywords', 'paper_type',
            'research_domain', 'language', 'selected_track', 'presentation_mode',
            'session_preference', 'registration_category', 'proceedings_preference',
            'gst_invoice_required',
            'author_full_name', 'author_email', 'author_phone', 'institution',
            'department', 'designation', 'country',
            'manuscript_file', 'supplementary_file',
            'co_authors', 'declarations',
        ]

    # ── Field-level validation ──
    def validate_title(self, value):
        value = (value or '').strip()
        if len(value) < 5:
            raise serializers.ValidationError('Paper title must be at least 5 characters.')
        return value

    def validate_abstract(self, value):
        value = (value or '').strip()
        if len(value) < 50:
            raise serializers.ValidationError('Abstract must be at least 50 characters.')
        return value

    def validate_keywords(self, value):
        return (value or '').strip()

    def validate_author_phone(self, value):
        # Normalize freely-formatted phone numbers: strip every non-digit, drop a
        # leading international dial prefix / India country code / trunk 0, then
        # require a plausible length. Returns digits-only for consistent storage.
        digits = re.sub(r'\D', '', value or '')
        if digits.startswith('00'):
            digits = digits[2:]
        if digits.startswith('91') and len(digits) > 10:
            digits = digits[2:]
        elif digits.startswith('0') and len(digits) == 11:
            digits = digits[1:]
        if not (10 <= len(digits) <= 15):
            raise serializers.ValidationError(
                'Enter a valid phone number (10 digits for India; include the country code for international numbers).'
            )
        return digits

    def validate_co_authors(self, value):
        if value in (None, ''):
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError('co_authors must be a list.')
        if len(value) > MAX_CO_AUTHORS:
            raise serializers.ValidationError(
                f'A maximum of {MAX_CO_AUTHORS} co-authors is allowed.'
            )
        cleaned = []
        for idx, co in enumerate(value):
            if not isinstance(co, dict):
                raise serializers.ValidationError('Each co-author must be an object.')
            name = (co.get('full_name') or '').strip()
            if not name:
                raise serializers.ValidationError(
                    f'Co-author #{idx + 1}: full name is required.'
                )
            cleaned.append({
                'full_name': name,
                'email': (co.get('email') or '').strip(),
                'institution': (co.get('institution') or '').strip(),
                'department': (co.get('department') or '').strip(),
                'designation': (co.get('designation') or '').strip(),
                'country': (co.get('country') or 'India').strip(),
                'is_corresponding': bool(co.get('is_corresponding', False)),
            })
        return cleaned

    def validate_manuscript_file(self, value):
        if not value:
            raise serializers.ValidationError('A manuscript file is required.')
        from form_validation import validate_document_file
        return validate_document_file(
            value,
            field_label='Manuscript',
            max_size_bytes=MAX_FILE_SIZE,
            allowed_extensions=MANUSCRIPT_EXTENSIONS,
        )

    def validate_declarations(self, value):
        # Declarations are optional confirmations stored for record-keeping.
        if value in (None, ''):
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError('Declarations must be an object of confirmations.')
        return value

    # ── Object-level validation ──
    def validate(self, attrs):
        conference = attrs.get('conference')
        if conference is None:
            raise serializers.ValidationError({'conference': 'Please select a valid conference.'})

        # Conference must exist AND currently accept submissions
        if not conference.accepting:
            if conference.status == 'Cancelled':
                raise serializers.ValidationError({'conference': 'This conference has been cancelled.'})
            if not conference.is_accepting_submissions:
                raise serializers.ValidationError(
                    {'conference': 'This conference is not accepting submissions.'}
                )
            raise serializers.ValidationError({'conference': 'The submission deadline for this conference has passed.'})

        # Selected track must belong to the conference (when tracks are configured)
        tracks = conference.tracks or []
        selected = (attrs.get('selected_track') or '').strip()
        if tracks:
            valid_track_values = {
                str(t.get('id', '')).strip().lower() for t in tracks
            } | {str(t.get('title', '')).strip().lower() for t in tracks}
            if selected.lower() not in valid_track_values:
                raise serializers.ValidationError({
                    'selected_track': 'The selected track is not offered by this conference.',
                })

        # Cross-check the required paper fields are present
        for req in ('title', 'abstract'):
            if not attrs.get(req):
                raise serializers.ValidationError({req: 'This field is required.'})

        return attrs

    def create(self, validated_data):
        from django.db import transaction

        co_authors = validated_data.pop('co_authors', []) or []
        declarations = validated_data.pop('declarations', {}) or {}
        request = self.context.get('request')

        with transaction.atomic():
            # Fee gate: paid conferences hold the submission until payment completes
            conference = validated_data.get('conference')
            fee = getattr(conference, 'submission_fee', 0) or 0
            submission = ConferenceSubmission.objects.create(
                declarations=declarations,
                submission_fee=fee,
                status='pending_payment' if fee > 0 else 'submitted',
                submitted_by=getattr(request, 'user', None) if request and request.user.is_authenticated else None,
                **validated_data,
            )
            # Corresponding author as the ordered #1 author record
            ConferenceSubmissionAuthor.objects.create(
                submission=submission,
                full_name=submission.author_full_name,
                email=submission.author_email,
                institution=submission.institution,
                department=submission.department,
                designation=submission.designation,
                country=submission.country,
                order=1,
                is_corresponding=True,
            )
            for idx, co in enumerate(co_authors, start=2):
                is_corr = bool(co.pop('is_corresponding', False))
                ConferenceSubmissionAuthor.objects.create(
                    submission=submission, order=idx, is_corresponding=is_corr, **co
                )
        return submission
