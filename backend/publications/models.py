from django.db import models
from django.utils.text import slugify
from django.utils import timezone
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator

from core.models import PublicIDTrackable

# The single shared protected-storage instance lives in core.storages so every
# app records the identical, argument-free storage path in its migrations
# (SECURITY-QA-REPORT M-3). It is re-exported here for the existing
# ``from publications.models import protected_storage`` call sites.
from core.storages import ProtectedStorage, protected_storage  # noqa: F401,E402

phone_validator = RegexValidator(
    regex=r'^\d{10}$',
    message='Phone number must be exactly 10 digits.'
)


CATEGORY_TYPE_CHOICES = [
    ('books', 'Books'),
    ('journals', 'Journals'),
    ('conferences', 'Conferences'),
    ('all', 'All Modules'),
]

class Category(PublicIDTrackable):
    public_id_prefix = 'CAT'  # MMSR-CAT-1931-NNNNNN (spec §3)
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True, blank=True)
    description = models.TextField(blank=True)
    category_type = models.CharField(
        max_length=20,
        choices=CATEGORY_TYPE_CHOICES,
        default='all',
        db_index=True
    )

    class Meta:
        verbose_name_plural = 'Categories'
        ordering = ['name']
        indexes = [
            models.Index(fields=['category_type', 'name']),
        ]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.get_category_type_display()})"

class Book(PublicIDTrackable):
    public_id_prefix = 'BOK'  # MMSR-BOK-1931-NNNNNN (spec §3)
    title = models.CharField(max_length=255)
    slug = models.SlugField(unique=True, blank=True)
    author = models.CharField(max_length=255)
    isbn = models.CharField(max_length=13, unique=True, blank=True, null=True)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, related_name='books')
    description = models.TextField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
    stock = models.PositiveIntegerField(default=0)
    cover_image = models.ImageField(upload_to='books/covers/')
    file_sample = models.FileField(upload_to='books/samples/', blank=True, null=True)
    # SECURITY-QA-REPORT C-1: the complete book PDF is the purchased product, so
    # it lives in the protected store and is streamed by the staff-only
    # /api/publications/books/<slug>/pdf/ view — never from a public /media URL.
    file_pdf = models.FileField(upload_to='books/full/', storage=protected_storage, blank=True, null=True, help_text="Complete full-book PDF download")
    published_date = models.DateField()
    is_featured = models.BooleanField(default=False, db_index=True)
    # Admin-assignable metadata
    pages = models.PositiveIntegerField(blank=True, null=True, help_text="Number of pages in the book")
    edition = models.CharField(max_length=50, blank=True, null=True, help_text="e.g. 1st Edition, 2nd Edition")
    rating = models.DecimalField(max_digits=3, decimal_places=1, blank=True, null=True, default=4.5, help_text="Rating out of 5.0")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title

class Journal(PublicIDTrackable):
    public_id_prefix = 'JRN'  # MMSR-JRN-1931-NNNNNN (spec §3)
    title = models.CharField(max_length=255)
    slug = models.SlugField(unique=True, blank=True)
    issn = models.CharField(max_length=20, unique=True, blank=True, null=True)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, related_name='journals')
    description = models.TextField()
    cover_image = models.ImageField(upload_to='journals/covers/')
    subscription_price_annual = models.DecimalField(max_digits=10, decimal_places=2, help_text="Price for yearly subscription")
    is_featured = models.BooleanField(default=False, db_index=True)
    # New fields for indexing, frequency, and access type
    indexed_in = models.CharField(max_length=500, blank=True, null=True, default='Crossref, Google Scholar, DOAJ, Scopus', help_text="Comma-separated list of indexing databases")
    frequency = models.CharField(max_length=100, blank=True, null=True, default='Quarterly', help_text="Publication frequency e.g. Quarterly, Monthly")
    access_type = models.CharField(max_length=100, blank=True, null=True, default='Open Access', help_text="Open Access, Subscription, Hybrid")
    total_volumes = models.PositiveIntegerField(null=True, blank=True, help_text="Total volumes published (admin-editable)")
    total_issues = models.PositiveIntegerField(null=True, blank=True, help_text="Total issues published (admin-editable)")
    # SECURITY-QA-REPORT L-5: the CMS desk has always offered these four fields,
    # but the model never had them, so every submit was silently dropped by DRF
    # and re-created client-side from a localStorage copy. They are real columns
    # now, which is the only way a journal's aims, scope, board and impact factor
    # can reach a visitor on another machine.
    aims_scope = models.TextField(
        blank=True, default='', max_length=5000,
        help_text="Aims, mission and scope overview paragraph",
    )
    scope_topics = models.JSONField(
        default=list, blank=True,
        help_text="Comma-free list of covered subject areas (max 30)",
    )
    editorial_board = models.JSONField(
        default=list, blank=True,
        help_text="Editorial board members: name, role, institution, country, research_areas",
    )
    impact_factor = models.CharField(
        max_length=20, blank=True, default='',
        help_text="Published impact factor, e.g. 3.50",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-is_featured", "title"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)
        super().save(*args, **kwargs)


class JournalIssue(PublicIDTrackable):
    public_id_prefix = 'ISS'  # MMSR-ISS-1931-NNNNNN (spec §3)
    journal = models.ForeignKey(Journal, on_delete=models.CASCADE, related_name='issues')
    title = models.CharField(max_length=255, help_text="e.g. Vol 1, Issue 2")
    volume_number = models.PositiveIntegerField(null=True, blank=True, help_text="Volume number e.g. 1")
    issue_number = models.PositiveIntegerField(null=True, blank=True, help_text="Issue number e.g. 2")
    publication_date = models.DateField()
    price = models.DecimalField(max_digits=10, decimal_places=2, help_text="Base/Digital edition price")
    price_print = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Printed edition price (defaults to base price if null)")
    price_bundle = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Print + Digital bundle price (optional)")
    cover_image = models.ImageField(upload_to='journals/issues/', blank=True, null=True)
    file_digital = models.FileField(upload_to='journals/digital/', storage=protected_storage, blank=True, null=True)
    stock = models.PositiveIntegerField(default=0, help_text="Print stock count available")
    
    def __str__(self):
        return f"{self.journal.title} - {self.title}"

    class Meta:
        verbose_name = 'Journal Issue'
        verbose_name_plural = 'Journal Issues'
        constraints = [
            models.UniqueConstraint(
                fields=['journal', 'volume_number', 'issue_number'],
                condition=models.Q(volume_number__isnull=False, issue_number__isnull=False),
                name='unique_issue_per_journal_volume',
            ),
        ]

    def article_count(self):
        return self.articles.filter(status='published').count()


class JournalArticle(PublicIDTrackable):
    public_id_prefix = 'ART'  # MMSR-ART-1931-NNNNNN (spec §3)

    STATUS_CHOICES = (
        ('draft', 'Draft'),
        ('published', 'Published'),
        ('withdrawn', 'Withdrawn'),
    )

    ACCESS_MODE_CHOICES = (
        ('paid', 'Paid Access'),
        ('open_access', 'Open Access'),
    )

    journal = models.ForeignKey(Journal, on_delete=models.CASCADE, related_name='articles')
    issue = models.ForeignKey(JournalIssue, on_delete=models.CASCADE, related_name='articles', null=True, blank=True)
    title = models.CharField(max_length=500)
    slug = models.SlugField(max_length=255, blank=True)
    abstract = models.TextField(blank=True, default='')
    full_text = models.TextField(blank=True, default='', help_text="Protected full-text body. Never exposed publicly.")
    price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Individual article PDF price (used when access_mode is paid)")
    authors = models.ManyToManyField('ChapterAuthor', related_name='journal_articles', blank=True)
    author_names_raw = models.TextField(blank=True, null=True, help_text="Comma-separated or raw author names (may hold serialized author JSON)")
    institution = models.CharField(max_length=255, blank=True, null=True, help_text="Lead institution / affiliation")
    doi = models.CharField(max_length=200, blank=True, null=True, help_text="Digital Object Identifier")
    publication_date = models.DateField(blank=True, null=True)
    display_order = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='published')
    access_mode = models.CharField(max_length=20, choices=ACCESS_MODE_CHOICES, default='paid')
    file_pdf = models.FileField(upload_to='journals/articles/pdf/', storage=protected_storage, blank=True, null=True)
    page_range = models.CharField(max_length=100, blank=True, null=True, help_text="e.g. pp. 45–60")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Journal Article'
        verbose_name_plural = 'Journal Articles'
        ordering = ['display_order', '-publication_date', 'id']

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)[:255]
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.journal.title} - {self.title}"


class UserJournalAccess(PublicIDTrackable):
    public_id_prefix = 'JAC'  # MMSR-JAC-1931-NNNNNN (spec §3)

    ACCESS_TYPE_CHOICES = (
        ('issue', 'Single Issue Access'),
        ('subscription', 'Annual Journal Subscription'),
        ('manual_grant', 'Manual Admin Grant'),
        ('article', 'Individual Article Purchase'),
    )

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='journal_accesses')
    journal = models.ForeignKey(Journal, on_delete=models.CASCADE, related_name='user_accesses')
    issue = models.ForeignKey(JournalIssue, on_delete=models.CASCADE, related_name='user_accesses', null=True, blank=True, help_text="Populated for single issue purchase")
    article = models.ForeignKey(JournalArticle, on_delete=models.CASCADE, related_name='user_accesses', null=True, blank=True, help_text="Populated for individual article purchase")
    order = models.ForeignKey('orders.Order', on_delete=models.SET_NULL, null=True, blank=True, related_name='journal_accesses', help_text="Linked order for purchase-based entitlement")
    access_type = models.CharField(max_length=30, choices=ACCESS_TYPE_CHOICES, default='issue')
    start_date = models.DateTimeField(default=timezone.now)
    end_date = models.DateTimeField(null=True, blank=True, help_text="Access expiration timestamp. Null indicates lifetime access.")
    is_active = models.BooleanField(default=True)
    granted_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'User Journal Access'
        verbose_name_plural = 'User Journal Accesses'
        ordering = ['-granted_at']
        indexes = [
            models.Index(fields=['user', 'journal', 'is_active']),
            models.Index(fields=['user', 'issue', 'is_active']),
            models.Index(fields=['user', 'article', 'is_active']),
        ]

    def is_valid_now(self):
        now = timezone.now()
        if not self.is_active:
            return False
        if self.start_date > now:
            return False
        if self.end_date and self.end_date < now:
            return False
        return True

    def __str__(self):
        if self.article:
            scope = f"Article: {self.article.title}"
        elif self.issue:
            scope = f"Issue: {self.issue.title}"
        else:
            scope = f"Journal Sub: {self.journal.title}"
        return f"Access for {self.user.email} - {scope} ({'Active' if self.is_valid_now() else 'Inactive'})"


class Testimonial(PublicIDTrackable):
    public_id_prefix = 'TST'  # MMSR-TST-1931-NNNNNN (spec §3)

    REVIEW_SOURCE_CHOICES = (
        ('manual', 'Admin Added'),
        ('book', 'Book Review'),
        ('journal', 'Journal Review'),
    )
    name = models.CharField(max_length=255)
    designation = models.CharField(max_length=255, blank=True, help_text="e.g., Professor at IIT Delhi")
    institution = models.CharField(max_length=255, blank=True, help_text="University / institute")
    country = models.CharField(max_length=255, blank=True)
    email = models.EmailField(blank=True, help_text="Reviewer contact email (user-side submissions)")
    content = models.TextField(help_text="Must be no more than 50 words.")
    rating = models.PositiveIntegerField(default=5, help_text="1 to 5")
    avatar = models.ImageField(upload_to='testimonials/avatars/', null=True, blank=True)
    source = models.CharField(max_length=10, choices=REVIEW_SOURCE_CHOICES, default='manual')
    book = models.ForeignKey(Book, on_delete=models.SET_NULL, null=True, blank=True, related_name='testimonials')
    journal = models.ForeignKey(Journal, on_delete=models.SET_NULL, null=True, blank=True, related_name='testimonials')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def clean(self):
        super().clean()
        if self.content:
            word_count = len(self.content.split())
            if word_count > 50:
                raise ValidationError({'content': f'Testimonial cannot exceed 50 words. Currently it has {word_count} words.'})

    def __str__(self):
        return f"Testimonial from {self.name}"

class SiteMetrics(PublicIDTrackable):
    """Single-row table for dynamic platform metrics shown on landing & home pages."""
    public_id_prefix = 'MET'  # MMSR-MET-1931-NNNNNN (spec §3)
    books_count = models.CharField(max_length=20, default='500+', help_text="e.g. 500+")
    books_label = models.CharField(max_length=100, default='Academic Edited Books')
    books_sub = models.CharField(max_length=100, default='ISBN Registered Volumes')

    journals_count = models.CharField(max_length=20, default='120+', help_text="e.g. 120+")
    journals_label = models.CharField(max_length=100, default='Peer-Reviewed Journals')
    journals_sub = models.CharField(max_length=100, default='ISSN & DOI Indexed')

    authors_count = models.CharField(max_length=20, default='15,000+', help_text="e.g. 15,000+")
    authors_label = models.CharField(max_length=100, default='International Authors')
    authors_sub = models.CharField(max_length=100, default='Across 45+ Countries')

    satisfaction_count = models.CharField(max_length=20, default='98.4%', help_text="e.g. 98.4%")
    satisfaction_label = models.CharField(max_length=100, default='Publication Satisfaction')
    satisfaction_sub = models.CharField(max_length=100, default='Author Approval Rating')

    # Home page trust stats
    partner_unis_count = models.CharField(max_length=20, default='150+', help_text="e.g. 150+")
    partner_unis_label = models.CharField(max_length=100, default='Partner Universities')
    countries_count = models.CharField(max_length=20, default='50+', help_text="e.g. 50+")
    countries_label = models.CharField(max_length=100, default='Countries Reached')
    certificates_count = models.CharField(max_length=20, default='10,000+', help_text="e.g. 10,000+")
    certificates_label = models.CharField(max_length=100, default='Certificates Issued')
    articles_count = models.CharField(max_length=20, default='2,500+', help_text="e.g. 2,500+")
    articles_label = models.CharField(max_length=100, default='Published Articles')

    # Conference Hero Stats
    conf_hosted_count = models.CharField(max_length=20, default='25+', help_text="e.g. 25+")
    conf_domains_count = models.CharField(max_length=20, default='10+', help_text="e.g. 10+")
    conf_papers_count = models.CharField(max_length=20, default='2,000+', help_text="e.g. 2,000+")
    conf_countries_count = models.CharField(max_length=20, default='40+', help_text="e.g. 40+")

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Site Metrics'
        verbose_name_plural = 'Site Metrics'

    def __str__(self):
        return f'Site Metrics (last updated {self.updated_at.strftime("%d %b %Y") if self.updated_at else "never"})'

    def save(self, *args, **kwargs):
        # Enforce singleton — only one row allowed
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get_instance(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class UniversityPartner(PublicIDTrackable):
    public_id_prefix = 'UNI'  # MMSR-UNI-1931-NNNNNN (spec §3)
    name = models.CharField(max_length=255)
    location = models.CharField(max_length=100, default='India')
    partner_type = models.CharField(max_length=150, default='Academic Partner', help_text="e.g. Premier Technical Institute")
    is_active = models.BooleanField(default=True)
    display_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['display_order', 'name']
        verbose_name = 'University Partner'
        verbose_name_plural = 'University Partners'

    def __str__(self):
        return self.name


class NewsletterSubscriber(PublicIDTrackable):
    public_id_prefix = 'NLS'  # MMSR-NLS-1931-NNNNNN (spec §3)
    email = models.EmailField(unique=True)
    subscribed_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True, help_text="Unsubscribed users will be set to False")

    class Meta:
        ordering = ['-subscribed_at']
        verbose_name = 'Newsletter Subscriber'
        verbose_name_plural = 'Newsletter Subscribers'

    def __str__(self):
        return self.email


class NewsletterBroadcast(PublicIDTrackable):
    """Admin-created email broadcasts sent to all active subscribers."""
    public_id_prefix = 'NLB'  # MMSR-NLB-1931-NNNNNN (spec §3)
    subject = models.CharField(max_length=255)
    message = models.TextField(help_text="Email body (plain text)")
    sent_at = models.DateTimeField(null=True, blank=True)
    is_sent = models.BooleanField(default=False)
    recipients_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Newsletter Broadcast'
        verbose_name_plural = 'Newsletter Broadcasts'

    def __str__(self):
        return f"{self.subject} ({'Sent' if self.is_sent else 'Draft'})"


class ContactInquiry(PublicIDTrackable):
    public_id_prefix = 'ENQ'  # MMSR-ENQ-1931-NNNNNN (spec §3)

    INQUIRY_TYPES = (
        ('General Enquiry', 'General Enquiry'),
        ('Editorial Enquiry', 'Editorial Enquiry'),
        ('Author Support', 'Author Support'),
        ('Publishing Enquiry', 'Publishing Enquiry'),
        ('Conference Enquiry', 'Conference Enquiry'),
        ('Technical Support', 'Technical Support'),
        ('Other', 'Other'),
    )

    STATUS_CHOICES = (
        ('New', 'New'),
        ('In Progress', 'In Progress'),
        ('Replied', 'Replied'),
        ('Resolved', 'Resolved'),
    )

    reference_number = models.CharField(max_length=32, blank=True)
    name = models.CharField(max_length=255)
    email = models.EmailField()
    phone = models.CharField(max_length=20, blank=True, validators=[phone_validator])
    organization = models.CharField(max_length=255, blank=True)
    inquiry_type = models.CharField(max_length=50, choices=INQUIRY_TYPES, default='General Enquiry')
    subject = models.CharField(max_length=255)
    message = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='New')
    admin_reply = models.TextField(blank=True)
    admin_notes = models.TextField(blank=True)
    replied_at = models.DateTimeField(null=True, blank=True)
    is_resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Contact Inquiries"
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.get_inquiry_type_display()}] {self.subject} from {self.name}"

    def save(self, *args, **kwargs):
        # Keep the legacy is_resolved flag in sync with the richer status field
        # so any older code/consumers that only read is_resolved stay correct.
        self.is_resolved = self.status == 'Resolved'
        # Allocate the standardized ID before writing so the pre-standardization
        # reference column can carry the same value in this single INSERT
        # (spec §11: the old MMSR-ENQ-{id} generation is replaced, the column
        # stays as a compatibility mirror; historical rows keep their value).
        if not self.public_id:
            self._prepare_public_id(kwargs.get('update_fields'))
        if self.public_id and not self.reference_number:
            self.reference_number = self.public_id
        super().save(*args, **kwargs)


class ChapterAuthor(PublicIDTrackable):
    public_id_prefix = 'CAU'  # MMSR-CAU-1931-NNNNNN (spec §3)
    name = models.CharField(max_length=255)
    affiliation = models.CharField(max_length=500, blank=True, null=True, help_text="e.g. Department of Computer Science, IIT Madras")
    designation = models.CharField(max_length=255, blank=True, null=True, help_text="e.g. Professor & Senior Researcher")
    bio = models.TextField(blank=True, null=True, help_text="Short academic bio")
    photo = models.ImageField(upload_to='authors/photos/', blank=True, null=True)
    orcid = models.CharField(max_length=50, blank=True, null=True, help_text="ORCID iD e.g. 0000-0002-1825-0097")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Chapter Author'
        verbose_name_plural = 'Chapter Authors'
        ordering = ['name']

    def __str__(self):
        return self.name


class BookChapter(PublicIDTrackable):
    public_id_prefix = 'CHP'  # MMSR-CHP-1931-NNNNNN (spec §3)

    STATUS_CHOICES = (
        ('draft', 'Draft'),
        ('published', 'Published'),
        ('archived', 'Archived'),
    )

    ACCESS_MODE_CHOICES = (
        ('paid', 'Paid Content'),
        ('open_access', 'Open Access'),
        ('preview_only', 'Preview Only'),
    )

    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name='chapters')
    chapter_number = models.PositiveIntegerField(default=1)
    title = models.CharField(max_length=500)
    slug = models.SlugField(max_length=255, blank=True)
    description = models.TextField(blank=True, null=True, help_text="Short overview of the chapter")
    authors = models.ManyToManyField(ChapterAuthor, related_name='chapters', blank=True)
    author_names_raw = models.TextField(blank=True, null=True, help_text="Plaintext fallback author attribution (may hold serialized author JSON)")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='published')
    access_mode = models.CharField(max_length=20, choices=ACCESS_MODE_CHOICES, default='paid')
    sample_content = models.TextField(blank=True, null=True, help_text="Approved public sample / preview excerpt")
    # Chapter PDFs are sold per chapter (see the section entitlement check), so
    # the file is protected storage served only through the staff download view.
    file_pdf = models.FileField(upload_to='books/chapters/pdf/', storage=protected_storage, blank=True, null=True)
    doi = models.CharField(max_length=200, blank=True, null=True, help_text="Digital Object Identifier")
    page_range = models.CharField(max_length=100, blank=True, null=True, help_text="e.g. pp. 101–145")
    publication_date = models.DateField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Book Chapter'
        verbose_name_plural = 'Book Chapters'
        ordering = ['chapter_number', 'id']

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)[:255]
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.book.title} - Ch {self.chapter_number}: {self.title}"


class ChapterSection(PublicIDTrackable):
    public_id_prefix = 'SEC'  # MMSR-SEC-1931-NNNNNN (spec §3)

    STATUS_CHOICES = (
        ('draft', 'Draft'),
        ('published', 'Published'),
        ('archived', 'Archived'),
    )

    chapter = models.ForeignKey(BookChapter, on_delete=models.CASCADE, related_name='sections')
    display_order = models.PositiveIntegerField(default=1)
    title = models.CharField(max_length=500)
    full_content = models.TextField(blank=True, help_text="Complete section text / HTML content")
    preview_content = models.TextField(blank=True, null=True, help_text="Permitted public preview snippet")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='published')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Chapter Section'
        verbose_name_plural = 'Chapter Sections'
        ordering = ['display_order', 'id']

    def __str__(self):
        return f"{self.chapter.title} - {self.display_order}. {self.title}"

