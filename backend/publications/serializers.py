from rest_framework import serializers
from decimal import Decimal
import json
import re
from form_validation import validate_isbn, validate_issn, validate_phone_number, validate_image_file
from core.image_processing import get_variant_url
from .models import (
    Category, Book, Journal, JournalIssue, Testimonial, ContactInquiry,
    SiteMetrics, UniversityPartner, NewsletterSubscriber, NewsletterBroadcast,
    ChapterAuthor, BookChapter, ChapterSection, JournalArticle, UserJournalAccess
)


class FormJSONField(serializers.JSONField):
    """A ``JSONField`` that also accepts a JSON *string*.

    The journal desk posts ``multipart/form-data`` because covers are file
    uploads, and in that encoding a nested list or object arrives as a plain
    text field. DRF would then store the raw string in the JSON column, so the
    value would come back as text and the frontend would have to parse it (or
    silently show nothing). Decoding here keeps the column genuinely structured.
    """

    def to_internal_value(self, data):
        if isinstance(data, str):
            if not data.strip():
                data = []
            else:
                try:
                    data = json.loads(data)
                except (ValueError, TypeError):
                    self.fail('invalid')
        return super().to_internal_value(data)


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'


class ProtectedProductPdfMixin:
    """Render a protected ``file_pdf`` as its authorised download URL.

    SECURITY-QA-REPORT C-1: full-book and chapter PDFs are the purchased
    product, so they were moved out of the publicly served MEDIA_ROOT into
    ``protected_storage``, where a file has no URL by construction.
    ``use_url=False`` keeps DRF from asking for one (it would raise
    ``ValueError``), and the storage key it would have returned is replaced here
    by the streaming view that re-checks the requester on every call — the same
    arrangement JournalArticleSerializer already uses for article PDFs.
    """

    def _pdf_download_url(self, instance):
        raise NotImplementedError

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        if 'file_pdf' in ret:
            ret['file_pdf'] = (
                self._pdf_download_url(instance) if getattr(instance, 'file_pdf', None) else None
            )
        return ret


class ChapterAuthorSerializer(serializers.ModelSerializer):
    photo_webp = serializers.SerializerMethodField()

    class Meta:
        model = ChapterAuthor
        fields = ['id', 'public_id', 'name', 'affiliation', 'designation', 'bio', 'photo', 'photo_webp', 'created_at']

    def get_photo_webp(self, obj):
        return get_variant_url(obj.photo, variant='webp', request=self.context.get('request'))

    def validate_photo(self, value):
        if value:
            return validate_image_file(value)
        return value


class ChapterSectionPublicSerializer(serializers.ModelSerializer):
    """Public serializer for chapter sections. Excludes full_content for security."""
    class Meta:
        model = ChapterSection
        fields = ['id', 'public_id', 'chapter', 'display_order', 'title', 'preview_content', 'status', 'created_at', 'updated_at']


class ChapterSectionFullSerializer(serializers.ModelSerializer):
    """Full serializer including complete section content for authorized access & admin."""
    class Meta:
        model = ChapterSection
        fields = '__all__'


class ChapterSectionAdminNestedSerializer(serializers.ModelSerializer):
    """Writable nested serializer for admin chapter management.

    The `chapter` FK is intentionally omitted — it is set by the parent
    BookChapterAdminSerializer's create/update, so requiring it here would
    both reject payloads and collide with the explicit chapter kwarg.
    """
    class Meta:
        model = ChapterSection
        fields = ['id', 'public_id', 'display_order', 'title', 'full_content', 'preview_content', 'status']
        read_only_fields = ['id', 'public_id']
        extra_kwargs = {
            'display_order': {'required': False},
            'status': {'required': False},
            'full_content': {'required': False},
            'preview_content': {'required': False},
        }


class BookChapterPublicSerializer(serializers.ModelSerializer):
    authors = ChapterAuthorSerializer(many=True, read_only=True)
    sections = serializers.SerializerMethodField()

    class Meta:
        model = BookChapter
        fields = [
            'id', 'public_id', 'book', 'chapter_number', 'title', 'slug', 'description',
            'authors', 'author_names_raw', 'status', 'access_mode',
            'sample_content', 'doi', 'page_range', 'publication_date',
            'sections', 'created_at', 'updated_at'
        ]

    def get_sections(self, obj):
        # Python-side filter keeps the prefetch cache warm (a .filter() here
        # would fire one extra query per chapter).
        pub_sections = [s for s in obj.sections.all() if s.status == 'published']
        if obj.access_mode == 'open_access':
            return ChapterSectionFullSerializer(pub_sections, many=True).data
        return ChapterSectionPublicSerializer(pub_sections, many=True).data


class BookChapterAdminSerializer(ProtectedProductPdfMixin, serializers.ModelSerializer):
    authors = ChapterAuthorSerializer(many=True, read_only=True)
    author_ids = serializers.PrimaryKeyRelatedField(
        queryset=ChapterAuthor.objects.all(), source='authors', many=True, write_only=True, required=False
    )
    sections = ChapterSectionAdminNestedSerializer(many=True, required=False)
    # Writable on upload, rendered as the staff download view on the way out.
    file_pdf = serializers.FileField(use_url=False, required=False, allow_null=True)

    def _pdf_download_url(self, instance):
        ref = instance.public_id or instance.pk
        return f'/api/publications/admin/chapters/{ref}/pdf/'

    class Meta:
        model = BookChapter
        fields = '__all__'

    def create(self, validated_data):
        sections_data = validated_data.pop('sections', [])
        authors_data = validated_data.pop('authors', [])
        chapter = BookChapter.objects.create(**validated_data)
        if authors_data:
            chapter.authors.set(authors_data)
        for idx, sec in enumerate(sections_data):
            sec.pop('id', None)
            sec['display_order'] = sec.get('display_order', idx + 1)
            ChapterSection.objects.create(chapter=chapter, **sec)
        return chapter

    def update(self, instance, validated_data):
        sections_data = validated_data.pop('sections', None)
        authors_data = validated_data.pop('authors', None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()

        if authors_data is not None:
            instance.authors.set(authors_data)

        if sections_data is not None:
            existing_ids = [s.get('id') for s in sections_data if s.get('id')]
            instance.sections.exclude(id__in=existing_ids).delete()
            for idx, sec in enumerate(sections_data):
                sec_id = sec.pop('id', None)
                sec['display_order'] = sec.get('display_order', idx + 1)
                if sec_id:
                    ChapterSection.objects.filter(id=sec_id, chapter=instance).update(**sec)
                else:
                    ChapterSection.objects.create(chapter=instance, **sec)

        return instance


class BookSerializer(ProtectedProductPdfMixin, serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), source='category', write_only=True
    )
    chapters = serializers.SerializerMethodField()
    cover_image_webp = serializers.SerializerMethodField()
    cover_image_thumb = serializers.SerializerMethodField()
    # Multipart uploads from the book desk must keep working, so the field stays
    # writable; only the representation changes (see ProtectedProductPdfMixin).
    file_pdf = serializers.FileField(use_url=False, required=False, allow_null=True)

    def _pdf_download_url(self, instance):
        # BookViewSet resolves slug, numeric pk or public ID interchangeably.
        ref = instance.slug or instance.pk
        return f'/api/publications/books/{ref}/pdf/'

    class Meta:
        model = Book
        fields = '__all__'

    def get_chapters(self, obj):
        # List comprehension over the prefetched cache; .filter() would defeat it.
        pub_chapters = [c for c in obj.chapters.all() if c.status == 'published']
        return BookChapterPublicSerializer(pub_chapters, many=True).data

    def get_cover_image_webp(self, obj):
        return get_variant_url(obj.cover_image, variant='webp', request=self.context.get('request'))

    def get_cover_image_thumb(self, obj):
        return get_variant_url(obj.cover_image, variant='thumb', request=self.context.get('request'))

    # ISBN is an identifier (checksum verified), not a quantity; price/stock
    # ranges mirror the admin form's business rules. Model validators do not
    # run through DRF, so they are re-declared here.
    def validate_isbn(self, value):
        return validate_isbn(value)

    def validate_cover_image(self, value):
        return validate_image_file(value)

    def validate_price(self, value):
        if value is None or value < Decimal('0'):
            raise serializers.ValidationError('Price must be zero or greater.')
        if value > Decimal('1000000'):
            raise serializers.ValidationError('Price cannot exceed 1,000,000.')
        return value


class JournalArticleSerializer(serializers.ModelSerializer):
    authors = ChapterAuthorSerializer(many=True, read_only=True)
    author_ids = serializers.PrimaryKeyRelatedField(
        queryset=ChapterAuthor.objects.all(), source='authors', many=True, write_only=True, required=False
    )
    # Write-only so admins can manage the protected body, but it can never be read back out.
    full_text = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = JournalArticle
        fields = '__all__'
        # full_text is protected content — declared write_only above so it is never
        # serialized into any response. It is served exclusively through /fulltext/.
        read_only_fields = ('created_at', 'updated_at')

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        if instance.file_pdf:
            ret['file_pdf'] = f"/api/publications/articles/{instance.id}/pdf/"
        else:
            ret['file_pdf'] = None
        ret['has_full_text'] = bool(instance.full_text)
        return ret


class JournalIssueSerializer(serializers.ModelSerializer):
    articles = serializers.SerializerMethodField()
    supported_formats = serializers.SerializerMethodField()
    cover_image_webp = serializers.SerializerMethodField()
    cover_image_thumb = serializers.SerializerMethodField()

    class Meta:
        model = JournalIssue
        fields = '__all__'

    def get_articles(self, obj):
        # List comprehension over the prefetched cache; .filter() would defeat it.
        pub_articles = [a for a in obj.articles.all() if a.status == 'published']
        return JournalArticleSerializer(pub_articles, many=True).data

    def get_cover_image_webp(self, obj):
        return get_variant_url(obj.cover_image, variant='webp', request=self.context.get('request'))

    def get_cover_image_thumb(self, obj):
        return get_variant_url(obj.cover_image, variant='thumb', request=self.context.get('request'))

    def get_supported_formats(self, obj):
        formats = []
        has_digital_file = bool(obj.file_digital)
        # Digital format
        if has_digital_file or obj.price > 0:
            formats.append({
                'format': 'digital',
                'name': 'Digital Edition (PDF)',
                'price': str(obj.price),
                'available': has_digital_file,
                'description': 'Immediate digital PDF delivery and library entitlement.' if has_digital_file else 'Digital edition in preparation.',
            })
        # Print format
        print_price = obj.price_print if obj.price_print is not None else obj.price
        formats.append({
            'format': 'print',
            'name': 'Printed Issue',
            'price': str(print_price),
            'available': obj.stock > 0,
            'description': 'Official printed edition shipped to your postal address.' if obj.stock > 0 else 'Printed edition currently out of stock.',
        })
        # Bundle format (only if price_bundle is configured AND stock > 0 AND digital file exists)
        if obj.price_bundle is not None and obj.stock > 0 and has_digital_file:
            formats.append({
                'format': 'bundle',
                'name': 'Print + Digital Bundle',
                'price': str(obj.price_bundle),
                'available': True,
                'description': 'Printed copy shipped to address + immediate digital PDF library entitlement.',
            })
        return formats

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        if instance.file_digital:
            ret['file_digital'] = f"/api/publications/issues/{instance.id}/pdf/"
            # Expose the persisted document's identity so the admin and public
            # UI can label it and offer View / Download without leaking storage paths.
            ret['file_digital_url'] = f"/api/publications/issues/{instance.id}/pdf/"
            ret['file_digital_name'] = instance.file_digital.name.rsplit('/', 1)[-1]
            ret['has_file_digital'] = True
        else:
            ret['file_digital'] = None
            ret['file_digital_url'] = None
            ret['file_digital_name'] = None
            ret['has_file_digital'] = False
        return ret


    def validate_cover_image(self, value):
        if value:
            return validate_image_file(value)
        return value

class JournalSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), source='category', write_only=True
    )
    issues = JournalIssueSerializer(many=True, read_only=True)
    articles = serializers.SerializerMethodField()
    cover_image_webp = serializers.SerializerMethodField()
    cover_image_thumb = serializers.SerializerMethodField()
    # Free-form CMS content (SECURITY-QA-REPORT L-5): real columns now, sent as
    # JSON text by the multipart journal form, and bounded by the validators
    # below instead of being trusted because a browser asked for it.
    scope_topics = FormJSONField(required=False)
    editorial_board = FormJSONField(required=False)

    class Meta:
        model = Journal
        fields = '__all__'

    def get_cover_image_webp(self, obj):
        return get_variant_url(obj.cover_image, variant='webp', request=self.context.get('request'))

    def get_cover_image_thumb(self, obj):
        return get_variant_url(obj.cover_image, variant='thumb', request=self.context.get('request'))

    # ISSN is an identifier (checksum verified) and the annual subscription
    # price is a bounded quantity; model validators do not run through DRF.
    def validate_issn(self, value):
        return validate_issn(value)

    def validate_cover_image(self, value):
        return validate_image_file(value)

    def validate_subscription_price_annual(self, value):
        if value is None or value < Decimal('0'):
            raise serializers.ValidationError('Subscription price must be zero or greater.')
        if value > Decimal('1000000'):
            raise serializers.ValidationError('Subscription price cannot exceed 1,000,000.')
        return value

    def validate_impact_factor(self, value):
        value = (value or '').strip()
        if value and not re.fullmatch(r'[0-9]([0-9.,()\s-]{0,18}[0-9])?', value):
            raise serializers.ValidationError(
                'Impact factor must be a short numeric label, for example "3.50" or "7.2 (2025)".'
            )
        return value

    @staticmethod
    def _clean_text_list(value, *, limit, max_len, field):
        """Coerce an incoming JSON value into a bounded list of plain strings."""
        if isinstance(value, str):
            value = [part for part in re.split(r'[,\n]', value)]
        if not isinstance(value, list):
            raise serializers.ValidationError(f'{field} must be a list.')
        if len(value) > limit:
            raise serializers.ValidationError(f'{field} cannot contain more than {limit} entries.')
        out = []
        for item in value:
            if not isinstance(item, str):
                raise serializers.ValidationError(f'{field} entries must be text.')
            text = ' '.join(item.split())[:max_len]
            if text and text not in out:
                out.append(text)
        return out

    def validate_scope_topics(self, value):
        return self._clean_text_list(value, limit=30, max_len=100, field='scope_topics')

    def validate_editorial_board(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError('editorial_board must be a list.')
        if len(value) > 50:
            raise serializers.ValidationError('editorial_board cannot contain more than 50 members.')
        allowed = {'name', 'role', 'institution', 'country'}
        board = []
        for entry in value:
            if not isinstance(entry, dict):
                raise serializers.ValidationError('Each editorial board member must be an object.')
            member = {}
            for key in allowed:
                raw = entry.get(key)
                if raw is None:
                    continue
                if not isinstance(raw, str):
                    raise serializers.ValidationError(f'{key} must be text.')
                member[key] = ' '.join(raw.split())[:200]
            if not member.get('name'):
                # Rows without a name are UI placeholders, not board members.
                continue
            member.setdefault('role', 'Editorial Board Member')
            member['research_areas'] = self._clean_text_list(
                entry.get('research_areas') or entry.get('researchAreas') or [],
                limit=10, max_len=100, field='research_areas',
            ) or ['Academic Research']
            board.append(member)
        return board

    def get_articles(self, obj):
        # List comprehension over the prefetched cache; .filter() would defeat it.
        pub_articles = [a for a in obj.articles.all() if a.status == 'published']
        return JournalArticleSerializer(pub_articles, many=True).data


class UserJournalAccessSerializer(serializers.ModelSerializer):
    # An access row only carries the user FK. The admin entitlement table needs a
    # displayable identity for that person, so the email and the standardized
    # MMSR reference travel with the record — the frontend never falls back to
    # printing the raw database key (Phase 5 spec §11).
    user_email = serializers.ReadOnlyField(source='user.email', default=None)
    user_public_id = serializers.ReadOnlyField(source='user.public_id', default=None)
    journal_title = serializers.ReadOnlyField(source='journal.title')
    journal_slug = serializers.ReadOnlyField(source='journal.slug')
    # Standardized references of the linked catalog objects, so a library card
    # can name the journal/issue/article it unlocks without quoting a database
    # key when the title is missing.
    journal_public_id = serializers.ReadOnlyField(source='journal.public_id', default=None)
    issue_public_id = serializers.ReadOnlyField(source='issue.public_id', default=None)
    article_public_id = serializers.ReadOnlyField(source='article.public_id', default=None)
    issue_title = serializers.ReadOnlyField(source='issue.title', default=None)
    issue_volume = serializers.ReadOnlyField(source='issue.volume_number', default=None)
    issue_number = serializers.ReadOnlyField(source='issue.issue_number', default=None)
    article_title = serializers.ReadOnlyField(source='article.title', default=None)
    article_slug = serializers.ReadOnlyField(source='article.slug', default=None)
    is_valid = serializers.SerializerMethodField()

    class Meta:
        model = UserJournalAccess
        fields = '__all__'

    def get_is_valid(self, obj):
        return obj.is_valid_now()


class TestimonialPublicSerializer(serializers.ModelSerializer):
    """Read-only shape for the public testimonial slider / homepage (no email or internal links)."""
    class Meta:
        model = Testimonial
        fields = ['id', 'public_id', 'name', 'designation', 'institution', 'country', 'content', 'rating', 'avatar', 'created_at']


class TestimonialAdminSerializer(serializers.ModelSerializer):
    book_title = serializers.SerializerMethodField()
    journal_title = serializers.SerializerMethodField()

    class Meta:
        model = Testimonial
        fields = '__all__'

    def validate_rating(self, value):
        if value is None or not 1 <= value <= 5:
            raise serializers.ValidationError('Rating must be between 1 and 5.')
        return value

    def validate_avatar(self, value):
        if value:
            return validate_image_file(value)
        return value
    def get_book_title(self, obj):
        return obj.book.title if obj.book else None

    def get_journal_title(self, obj):
        return obj.journal.title if obj.journal else None


class TestimonialSubmitSerializer(serializers.ModelSerializer):
    """Public review submission from the book / journal pages. Always lands pending (is_active=False)."""
    book_id = serializers.PrimaryKeyRelatedField(queryset=Book.objects.all(), source='book', required=False, allow_null=True)
    journal_id = serializers.PrimaryKeyRelatedField(queryset=Journal.objects.all(), source='journal', required=False, allow_null=True)

    class Meta:
        model = Testimonial
        fields = ['name', 'email', 'designation', 'institution', 'rating', 'content', 'source', 'book_id', 'journal_id']

    def validate_rating(self, value):
        if not 1 <= value <= 5:
            raise serializers.ValidationError("Rating must be between 1 and 5.")
        return value

    def validate_content(self, value):
        words = len(value.strip().split())
        if words < 3:
            raise serializers.ValidationError("Please write a little more about your experience.")
        if words > 50:
            raise serializers.ValidationError(f"Review cannot exceed 50 words. Currently it has {words} words.")
        return value.strip()

    def validate(self, attrs):
        source = attrs.get('source', 'manual')
        if source == 'book' and not attrs.get('book'):
            raise serializers.ValidationError({"book_id": "A book review must reference a book."})
        if source == 'journal' and not attrs.get('journal'):
            raise serializers.ValidationError({"journal_id": "A journal review must reference a journal."})
        return attrs

class ContactInquirySerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactInquiry
        fields = '__all__'
        # The public contact form posts through this serializer (create is
        # AllowAny). Every staff-controlled field must be read-only here or an
        # anonymous caller could self-assign status / admin_notes / admin_reply
        # (mass assignment) and poison the moderation queue. Admins edit these
        # via the Django admin, never through this endpoint.
        read_only_fields = (
            'reference_number', 'status', 'admin_reply', 'admin_notes',
            'replied_at', 'is_resolved', 'created_at',
        )

    def validate_name(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError('Name is required.')
        return value.strip()

    def validate_phone(self, value):
        # Optional field: blank stays blank, anything present must be a
        # valid 10-digit Indian mobile (the model's documented rule).
        return validate_phone_number(value)

    def validate_message(self, value):
        if len(value.strip()) < 10:
            raise serializers.ValidationError('Message must be at least 10 characters.')
        return value

# ─── New CMS Serializers ───────────────────────────────────────────────────────

class SiteMetricsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteMetrics
        fields = '__all__'

class UniversityPartnerSerializer(serializers.ModelSerializer):
    class Meta:
        model = UniversityPartner
        fields = '__all__'

class NewsletterSubscriberSerializer(serializers.ModelSerializer):
    class Meta:
        model = NewsletterSubscriber
        fields = '__all__'
        read_only_fields = ('subscribed_at', 'is_active')

class NewsletterBroadcastSerializer(serializers.ModelSerializer):
    class Meta:
        model = NewsletterBroadcast
        fields = '__all__'
        read_only_fields = ('sent_at', 'is_sent', 'recipients_count', 'created_at')
