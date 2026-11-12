from django.db import models
from django.conf import settings
from django.utils import timezone
from publications.models import Book, Journal, JournalIssue, JournalArticle
from django.core.validators import RegexValidator, MinValueValidator, MaxValueValidator
from decimal import Decimal

from core.models import PublicIDTrackable

# Invoice PDFs are customer financial documents (name, address, GST details,
# Razorpay payment IDs). They used to be written into the publicly served
# MEDIA_ROOT under ``invoice_<reference>.pdf`` with a sequential reference,
# which let an anonymous visitor walk 1..N (SECURITY-QA-REPORT C-1). They now
# live in PROTECTED_MEDIA_ROOT and are streamed only by the owner-or-staff
# download view.
from core.storages import protected_storage  # noqa: E402

phone_validator = RegexValidator(
    regex=r'^\d{10}$',
    message='Phone number must be exactly 10 digits.'
)

# Shipping: list price Rs.80 with a standing 50% discount => customer pays Rs.40.
# Charged only on orders that contain physical (print/bundle) items.
SHIPPING_ORIGINAL_PRICE = Decimal('80.00')
SHIPPING_PRICE = Decimal('40.00')

class Order(PublicIDTrackable):
    public_id_prefix = 'ORD'  # MMSR-ORD-1931-NNNNNN (spec §3)

    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('shipped', 'Shipped'),
        ('delivered', 'Delivered'),
        ('cancelled', 'Cancelled'),
    )

    # Statuses that mean "the money is with the publisher". Every entitlement
    # check uses this list (SECURITY-QA-REPORT H-3) so a pending or cancelled
    # order can never unlock paid content — and so no caller has to re-guess
    # which of the five statuses count as paid.
    PAID_STATUSES = ('paid', 'shipped', 'delivered')

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='orders')
    
    # Contact/Shipping Info
    full_name = models.CharField(max_length=255, default='')
    email = models.EmailField(default='')
    phone_number = models.CharField(max_length=20, default='', validators=[phone_validator])
    shipping_address = models.TextField(default='')
    city = models.CharField(max_length=100, default='')
    state = models.CharField(max_length=100, default='', blank=True)
    postal_code = models.CharField(max_length=20, default='')
    country = models.CharField(max_length=100, default='')
    
    # Payment Info
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    
    # Razorpay specific
    razorpay_order_id = models.CharField(max_length=255, blank=True, null=True, db_index=True)
    razorpay_payment_id = models.CharField(max_length=255, blank=True, null=True, db_index=True)
    razorpay_signature = models.CharField(max_length=255, blank=True, null=True)
    transaction_id = models.CharField(max_length=255, blank=True, null=True)
    payment_method = models.CharField(max_length=50, blank=True, null=True, default='card')
    refund_status = models.CharField(max_length=50, blank=True, null=True, default='none')
    
    # Invoice PDF (protected storage — never reachable by URL)
    invoice_pdf = models.FileField(
        upload_to='invoices/',
        storage=protected_storage,
        blank=True,
        null=True,
    )
    
    # Legacy public reference column (spec §11 compatibility). Historical rows
    # keep their MMSR-{CATEGORY}-{nnnn}-{nnnnn} values; new orders mirror the
    # standardized MMSR-ORD-1931-NNNNNN public ID here.
    custom_order_id = models.CharField(max_length=50, blank=True, null=True, unique=True)
    
    # Physical Fulfillment Tracking
    FULFILLMENT_STATUS_CHOICES = (
        ('not_required', 'Not Required'),
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('packed', 'Packed'),
        ('dispatched', 'Dispatched'),
        ('delivered', 'Delivered'),
        ('cancelled', 'Cancelled'),
    )

    fulfillment_status = models.CharField(
        max_length=20,
        choices=FULFILLMENT_STATUS_CHOICES,
        default='not_required',
        help_text="Physical shipping and fulfillment status"
    )
    courier_name = models.CharField(max_length=100, blank=True, default='', help_text="Courier partner name")
    tracking_number = models.CharField(max_length=100, blank=True, default='', help_text="Courier tracking number")
    tracking_url = models.URLField(max_length=500, blank=True, default='', help_text="Courier tracking URL")
    dispatched_at = models.DateTimeField(null=True, blank=True, help_text="Timestamp when order was dispatched")
    delivered_at = models.DateTimeField(null=True, blank=True, help_text="Timestamp when order was delivered")
    fulfillment_notes = models.TextField(blank=True, default='', help_text="Staff notes on physical shipping")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def requires_shipping(self):
        """Returns True if any item in this order requires physical shipment."""
        if hasattr(self, '_prefetched_objects_cache') and 'items' in self._prefetched_objects_cache:
            return any(
                (item.journal_issue_id and item.format in ('print', 'bundle')) or
                (item.book_id and item.format == 'print')
                for item in self.items.all()
            )
        return self.items.filter(
            models.Q(journal_issue__isnull=False, format__in=['print', 'bundle']) |
            models.Q(book__isnull=False, format='print')
        ).exists()

    def get_shipping_amount(self):
        """Discounted flat shipping charged on physical orders (Rs.40, 50% off Rs.80)."""
        return SHIPPING_PRICE if self.requires_shipping() else Decimal('0.00')

    def get_physical_items(self):
        """Returns queryset of items requiring physical fulfillment."""
        return self.items.filter(
            models.Q(journal_issue__isnull=False, format__in=['print', 'bundle']) |
            models.Q(book__isnull=False, format='print')
        )

    def generate_custom_id(self):
        """Deprecated legacy shim — returns the standardized public ID.

        The old implementation built ``MMSR-{CATEGORY}-{nnnn}-{nnnnn}`` from
        the first item's category, which violated the approved standard
        (category-based numbering, PK-derived tail). The centralized counter
        service now issues ``MMSR-ORD-1931-NNNNNN`` at INSERT time; this
        method only keeps existing call sites working.
        """
        if self.custom_order_id:
            return self.custom_order_id
        if self.public_id:
            return self.public_id
        from core.services import allocate_next
        return allocate_next(self.public_id_prefix)

    # Operational stage ordering for physical fulfillment. The stage itself is
    # the single source of truth — dispatched_at/delivered_at are derived audit
    # timestamps and must never be used to infer a stage the admin hasn't set.
    FULFILLMENT_STAGES = ['not_required', 'pending', 'processing', 'packed', 'dispatched', 'delivered']

    def fulfillment_rank(self):
        if self.fulfillment_status == 'cancelled':
            return -1
        try:
            return self.FULFILLMENT_STAGES.index(self.fulfillment_status)
        except ValueError:
            return 0

    def save(self, *args, **kwargs):
        rank = self.fulfillment_rank()
        if rank >= 0:  # never rewrite history on cancelled consignments
            # Backfill missing stage timestamps for stages already reached...
            if rank >= 4 and not self.dispatched_at:
                self.dispatched_at = timezone.now()
            if rank >= 5 and not self.delivered_at:
                self.delivered_at = timezone.now()
            # ...and strip timestamps that contradict the current stage, so a
            # stale delivered_at can't make dashboards claim "delivered" while
            # the fulfillment desk still says "dispatched".
            if rank < 4 and self.dispatched_at:
                self.dispatched_at = None
            if rank < 5 and self.delivered_at:
                self.delivered_at = None
        # Allocate the standardized ORD id before writing, then mirror it into
        # the legacy custom_order_id column so every existing display path
        # (invoices, WhatsApp replies, admin lists) shows the standard ID.
        # Historical orders keep their original MMSR-{CAT} reference untouched.
        if not self.public_id:
            self._prepare_public_id(kwargs.get('update_fields'))
        if self.public_id and not self.custom_order_id:
            self.custom_order_id = self.public_id
        super().save(*args, **kwargs)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'status', '-created_at']),
            models.Index(fields=['status', '-created_at']),
        ]

    def __str__(self):
        identifier = self.public_id or self.custom_order_id or f"#{self.id}"
        return f"Order {identifier} - {self.user.email}"

class OrderItem(PublicIDTrackable):
    public_id_prefix = 'ORI'  # MMSR-ORI-1931-NNNNNN (spec §3)

    FORMAT_CHOICES = (
        ('digital', 'Digital (PDF)'),
        ('print', 'Printed Edition'),
        ('bundle', 'Print + Digital Bundle'),
    )

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    
    # Product references (only one should be set)
    book = models.ForeignKey(Book, on_delete=models.SET_NULL, null=True, blank=True)
    journal_issue = models.ForeignKey(JournalIssue, on_delete=models.SET_NULL, null=True, blank=True)
    journal_subscription = models.ForeignKey(Journal, on_delete=models.SET_NULL, null=True, blank=True, help_text="For annual subscriptions")
    article = models.ForeignKey(JournalArticle, on_delete=models.SET_NULL, null=True, blank=True, help_text="For individual article purchases")
    
    format = models.CharField(max_length=20, choices=FORMAT_CHOICES, default='digital', help_text="Purchased product format")
    # Bounded on purpose (SECURITY-QA-REPORT H-4): the column is a
    # PositiveIntegerField, so a negative quantity used to reach the database
    # and trip its CHECK constraint — an uncaught sqlite3.IntegrityError that
    # returned HTTP 500 and left the already-committed parent order orphaned.
    quantity = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1), MaxValueValidator(99)])
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.0, help_text="Price at time of purchase")

    def clean(self):
        from django.core.exceptions import ValidationError
        products = [self.book, self.journal_issue, self.journal_subscription, self.article]
        set_products = [p for p in products if p is not None]
        if len(set_products) == 0:
            raise ValidationError("OrderItem must reference at least one product (book, journal_issue, journal_subscription, or article).")
        if len(set_products) > 1:
            raise ValidationError("OrderItem must reference exactly ONE product, not multiple.")

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        if self.book:
            return f"Book: {self.book.title}"
        elif self.journal_issue:
            return f"Issue: {self.journal_issue}"
        elif self.journal_subscription:
            return f"Sub: {self.journal_subscription.title}"
        elif self.article:
            return f"Article: {self.article.title}"
        return "Unknown Item"


# ---------------------------------------------------------------------------
# InvoiceJob — database-backed outbox record for background invoice processing
# ---------------------------------------------------------------------------
# Imported here (not defined here) so the outbox model lives in its own module
# (job_models.py) but Django's app registry discovers it via this import.
from orders.job_models import InvoiceJob  # noqa: F401,E402
