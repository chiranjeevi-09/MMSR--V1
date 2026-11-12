from django.contrib import admin
from django.db import models
from django import forms
from .models import (
    Category, Book, Journal, JournalIssue, Testimonial, ContactInquiry,
    SiteMetrics, UniversityPartner, NewsletterSubscriber, NewsletterBroadcast,
    ChapterAuthor, BookChapter, ChapterSection, JournalArticle, UserJournalAccess
)


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}


@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = ('title', 'author', 'price', 'stock', 'is_featured', 'published_date')
    list_filter = ('category', 'is_featured', 'published_date')
    search_fields = ('title', 'author', 'isbn')
    prepopulated_fields = {'slug': ('title',)}


class JournalArticleInline(admin.StackedInline):
    model = JournalArticle
    extra = 1


class JournalIssueInline(admin.StackedInline):
    model = JournalIssue
    extra = 1


@admin.register(Journal)
class JournalAdmin(admin.ModelAdmin):
    list_display = ('title', 'issn', 'subscription_price_annual', 'access_type', 'is_featured')
    list_filter = ('category', 'is_featured', 'access_type')
    prepopulated_fields = {'slug': ('title',)}
    inlines = [JournalIssueInline]


@admin.register(JournalIssue)
class JournalIssueAdmin(admin.ModelAdmin):
    list_display = ('journal', 'title', 'volume_number', 'issue_number', 'publication_date', 'price', 'stock')
    list_filter = ('journal', 'publication_date')
    search_fields = ('title',)
    inlines = [JournalArticleInline]


@admin.register(JournalArticle)
class JournalArticleAdmin(admin.ModelAdmin):
    list_display = ('title', 'journal', 'issue', 'access_mode', 'price', 'status', 'doi', 'publication_date')
    list_filter = ('journal', 'status', 'access_mode', 'publication_date')
    search_fields = ('title', 'abstract', 'doi', 'author_names_raw')
    prepopulated_fields = {'slug': ('title',)}
    fieldsets = (
        ('Core Metadata (Public)', {
            'fields': ('journal', 'issue', 'title', 'slug', 'author_names_raw', 'authors', 'institution', 'doi', 'publication_date', 'display_order', 'page_range'),
        }),
        ('Access Control', {
            'fields': ('status', 'access_mode', 'price', 'file_pdf'),
            'description': 'Open Access grants free full-text/PDF to everyone. Paid articles require an article purchase, issue purchase, or active subscription.',
        }),
        ('Public Abstract', {
            'fields': ('abstract',),
            'classes': ('collapse',),
        }),
        ('Protected Full Text (Never Public)', {
            'fields': ('full_text',),
            'description': 'Rendered on the article page only for authorized readers via the protected fulltext endpoint.',
        }),
    )
    formfield_overrides = {
        models.TextField: {'widget': forms.Textarea(attrs={'rows': 8})},
    }


@admin.register(UserJournalAccess)
class UserJournalAccessAdmin(admin.ModelAdmin):
    list_display = ('user', 'journal', 'issue', 'article', 'access_type', 'start_date', 'end_date', 'is_active', 'granted_at')
    list_filter = ('access_type', 'is_active', 'journal')
    search_fields = ('user__email', 'journal__title', 'issue__title', 'article__title')
    readonly_fields = ('granted_at', 'updated_at')


@admin.register(Testimonial)
class TestimonialAdmin(admin.ModelAdmin):
    list_display = ('name', 'designation', 'rating', 'is_active', 'created_at')
    list_filter = ('is_active', 'rating', 'created_at')
    search_fields = ('name', 'content')

    class Media:
        js = ('js/testimonial_word_limit.js',)

@admin.register(ContactInquiry)
class ContactInquiryAdmin(admin.ModelAdmin):
    list_display = ('name', 'email', 'inquiry_type', 'subject', 'is_resolved', 'created_at')
    list_filter = ('inquiry_type', 'is_resolved', 'created_at')
    search_fields = ('name', 'email', 'subject', 'message')
    readonly_fields = ('created_at',)

@admin.register(SiteMetrics)
class SiteMetricsAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'updated_at')

    def has_add_permission(self, request):
        # Only one row allowed
        return not SiteMetrics.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False

@admin.register(UniversityPartner)
class UniversityPartnerAdmin(admin.ModelAdmin):
    list_display = ('name', 'location', 'partner_type', 'is_active', 'display_order')
    list_filter = ('is_active', 'location')
    search_fields = ('name', 'location')
    list_editable = ('is_active', 'display_order')
    ordering = ('display_order', 'name')

@admin.register(NewsletterSubscriber)
class NewsletterSubscriberAdmin(admin.ModelAdmin):
    list_display = ('email', 'subscribed_at', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('email',)
    readonly_fields = ('subscribed_at',)

@admin.register(NewsletterBroadcast)
class NewsletterBroadcastAdmin(admin.ModelAdmin):
    list_display = ('subject', 'is_sent', 'recipients_count', 'sent_at', 'created_at')
    list_filter = ('is_sent',)
    readonly_fields = ('is_sent', 'sent_at', 'recipients_count', 'created_at')


@admin.register(ChapterAuthor)
class ChapterAuthorAdmin(admin.ModelAdmin):
    list_display = ('name', 'designation', 'affiliation', 'created_at')
    search_fields = ('name', 'affiliation', 'designation')


class ChapterSectionInline(admin.StackedInline):
    model = ChapterSection
    extra = 1


@admin.register(BookChapter)
class BookChapterAdmin(admin.ModelAdmin):
    list_display = ('book', 'chapter_number', 'title', 'status', 'access_mode', 'created_at')
    list_filter = ('status', 'access_mode', 'book')
    search_fields = ('title', 'description', 'author_names_raw')
    prepopulated_fields = {'slug': ('title',)}
    inlines = [ChapterSectionInline]


@admin.register(ChapterSection)
class ChapterSectionAdmin(admin.ModelAdmin):
    list_display = ('chapter', 'display_order', 'title', 'status', 'created_at')
    list_filter = ('status', 'chapter__book')
    search_fields = ('title', 'full_content')

