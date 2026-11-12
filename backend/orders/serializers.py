from rest_framework import serializers
from form_validation import normalize_indian_mobile, validate_phone_number, validate_optional_indian_pin, validate_alpha_text
from .models import Order, OrderItem
from publications.serializers import BookSerializer, JournalIssueSerializer, JournalSerializer, JournalArticleSerializer

from publications.models import Book, JournalIssue, Journal, JournalArticle
from core.image_processing import get_variant_url

class OrderItemBookSerializer(serializers.ModelSerializer):
    cover_image_webp = serializers.SerializerMethodField()
    cover_image_thumb = serializers.SerializerMethodField()

    class Meta:
        model = Book
        fields = ['id', 'public_id', 'title', 'slug', 'author', 'isbn', 'price', 'cover_image', 'cover_image_webp', 'cover_image_thumb']

    def get_cover_image_webp(self, obj):
        return get_variant_url(obj.cover_image, variant='webp', request=self.context.get('request'))

    def get_cover_image_thumb(self, obj):
        return get_variant_url(obj.cover_image, variant='thumb', request=self.context.get('request'))

class OrderItemJournalIssueSerializer(serializers.ModelSerializer):
    class Meta:
        model = JournalIssue
        fields = ['id', 'public_id', 'title', 'volume_number', 'issue_number', 'publication_date', 'price', 'cover_image']

class OrderItemJournalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Journal
        fields = ['id', 'public_id', 'title', 'slug', 'issn', 'subscription_price_annual', 'cover_image']

class OrderItemArticleSerializer(serializers.ModelSerializer):
    class Meta:
        model = JournalArticle
        fields = ['id', 'public_id', 'title', 'doi', 'author_names_raw', 'price']

class OrderItemSerializer(serializers.ModelSerializer):
    book = OrderItemBookSerializer(read_only=True)
    journal_issue = OrderItemJournalIssueSerializer(read_only=True)
    journal_subscription = OrderItemJournalSerializer(read_only=True)
    article = OrderItemArticleSerializer(read_only=True)
    
    class Meta:
        model = OrderItem
        fields = '__all__'

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    has_physical_items = serializers.SerializerMethodField()
    # SECURITY-QA-REPORT C-1: invoice_pdf now lives in protected storage, which
    # has no URL by design. Expose the authorised download endpoint instead (the
    # same pattern JournalArticleSerializer uses for file_pdf), so the dashboard,
    # the payment-success page and the admin order desk keep offering the invoice
    # without ever publishing a storage path. The view re-checks ownership and
    # is_active on every request.
    invoice_pdf = serializers.SerializerMethodField()
    
    class Meta:
        model = Order
        fields = '__all__'
        read_only_fields = ('user', 'status', 'razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature', 'transaction_id', 'created_at', 'updated_at')

    def get_invoice_pdf(self, obj):
        if not obj.invoice_pdf:
            return None
        return f"/api/commerce/{obj.public_id or obj.pk}/invoice/"

    def get_has_physical_items(self, obj):
        return obj.requires_shipping()

    # Model validators do not run through DRF — enforce the same rules here.
    def validate_phone_number(self, value):
        return validate_phone_number(value)

    def validate_postal_code(self, value):
        return validate_optional_indian_pin(value)

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        request = self.context.get('request')
        # Internal staff fulfillment notes must never be exposed to non-staff customers
        if not (request and request.user and request.user.is_authenticated and request.user.is_staff):
            ret.pop('fulfillment_notes', None)
        return ret

class CreateOrderItemSerializer(serializers.Serializer):
    book_id = serializers.IntegerField(required=False)
    book = serializers.IntegerField(required=False)
    journal_issue_id = serializers.IntegerField(required=False)
    journal_issue = serializers.IntegerField(required=False)
    journal_subscription_id = serializers.IntegerField(required=False)
    journal_subscription = serializers.IntegerField(required=False)
    article_id = serializers.IntegerField(required=False)
    article = serializers.IntegerField(required=False)
    format = serializers.CharField(required=False, default='digital')
    # Bounded in the serializer as well as on the model (SECURITY-QA-REPORT
    # H-4): an unbounded IntegerField let quantity=-3 reach the database, whose
    # PositiveIntegerField CHECK constraint then raised an uncaught
    # IntegrityError — an HTTP 500 plus an orphaned order — and quantity=0
    # created a payable order for nothing but shipping.
    quantity = serializers.IntegerField(default=1, min_value=1, max_value=99)

class CreateOrderSerializer(serializers.ModelSerializer):
    items = CreateOrderItemSerializer(many=True)
    # Aliases for the checkout payload keys ("phone", "address"). Without these,
    # DRF silently dropped the values and every order was stored with a blank
    # phone_number and blank shipping_address (invoices showed "—"/half address).
    phone = serializers.CharField(required=False, allow_blank=True, write_only=True)
    address = serializers.CharField(required=False, allow_blank=True, write_only=True)
    payment_method = serializers.CharField(required=False, default='card')

    class Meta:
        model = Order
        fields = ('full_name', 'email', 'phone_number', 'shipping_address', 'phone', 'address', 'city', 'state', 'postal_code', 'country', 'items', 'total_amount', 'payment_method')

    def validate_phone_number(self, value):
        # A submitted value must be a real mobile number — never cleaned
        # silently into something else (normalize raises on letters/garbage).
        return normalize_indian_mobile(value, field_label='Phone number')

    def validate_postal_code(self, value):
        return validate_optional_indian_pin(value)

    # Recipient / place names must be letters-only (no digits). Blank is left to
    # the existing required-ness of each field; we only reject bad characters
    # when a value is actually supplied.
    def validate_full_name(self, value):
        return validate_alpha_text(value, 'Full name')

    def validate_city(self, value):
        return validate_alpha_text(value, 'City')

    def validate_state(self, value):
        return validate_alpha_text(value, 'State')

    def validate_country(self, value):
        return validate_alpha_text(value, 'Country')

    def validate_payment_method(self, value):
        val = (value or '').strip().lower()
        if val in ('bank_transfer', 'offline', 'neft', 'rtgs', 'cheque', 'dd'):
            raise serializers.ValidationError(
                "Offline bank transfer is not supported. Please complete your purchase securely using Razorpay."
            )
        return value

    def validate(self, attrs):
        # Map aliases onto the real model fields; never overwrite explicit values.
        phone_alias = attrs.pop('phone', None)
        if phone_alias and not attrs.get('phone_number'):
            # Raises a structured FIELD error when the alias is not a valid
            # mobile — the old behavior of keeping "the last 10 digits" of
            # arbitrary input silently stored wrong numbers.
            try:
                attrs['phone_number'] = normalize_indian_mobile(phone_alias, field_label='Phone number')
            except serializers.ValidationError as exc:
                raise serializers.ValidationError({'phone_number': exc.detail})
        address_alias = attrs.pop('address', None)
        if address_alias and not attrs.get('shipping_address'):
            attrs['shipping_address'] = str(address_alias).strip()
        if not attrs.get('phone_number') and not self.partial:
            raise serializers.ValidationError({'phone_number': ['Phone number is required for delivery updates.']})
        return attrs
