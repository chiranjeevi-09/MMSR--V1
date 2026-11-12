from django.contrib import admin
from .models import Submission, PublishedVolume


@admin.register(PublishedVolume)
class PublishedVolumeAdmin(admin.ModelAdmin):
    list_display = ('title', 'subject_area', 'year', 'is_accepting_chapters', 'deadline', 'price_indian', 'price_international')
    list_filter = ('is_accepting_chapters', 'year')
    search_fields = ('title', 'subject_area')
    list_editable = ('is_accepting_chapters',)


@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = (
        'title', 'get_author', 'submission_type', 'volume', 'status',
        'pricing_tier', 'certificate_issued', 'submitted_at'
    )
    
    class Media:
        css = {
            'all': ('submissions/css/admin_fix.css',)
        }

    def get_author(self, obj):
        full_name = obj.author.get_full_name()
        if full_name:
            return f"{full_name} ({obj.author.email})"
        return obj.author.email
    get_author.short_description = 'Author'

    sortable_by = ()
    list_filter = ('status', 'submission_type', 'pricing_tier', 'certificate_issued', 'country')
    search_fields = ('title', 'author__email', 'author__first_name', 'category', 'keywords')
    readonly_fields = ('submitted_at', 'updated_at')
    list_editable = ('status', 'certificate_issued')

    def get_readonly_fields(self, request, obj=None):
        if obj is None:  # Creating a new submission
            return ('submitted_at', 'updated_at')
        return ('submitted_at', 'updated_at', 'author')
    fieldsets = (
        ('Author Information', {
            'fields': ('author', 'author_affiliation', 'corresponding_email', 'phone_number', 'country', 'whatsapp_consent')
        }),
        ('Submission Details', {
            'fields': ('submission_type', 'volume', 'title', 'abstract', 'keywords', 'co_authors', 'category')
        }),
        ('Files', {
            'fields': ('manuscript_file', 'cover_letter', 'certificate_file')
        }),
        ('Status & Admin', {
            'fields': ('status', 'pricing_tier', 'certificate_issued', 'admin_notes')
        }),
        ('Timestamps', {
            'fields': ('submitted_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
