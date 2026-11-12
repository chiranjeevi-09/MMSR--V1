from django.contrib import admin
from django.utils.html import format_html

from .models import Conference, ConferenceSubmission, ConferenceSubmissionAuthor


@admin.register(Conference)
class ConferenceAdmin(admin.ModelAdmin):
    list_display = ('title', 'acronym', 'start_date', 'submission_deadline', 'submission_fee', 'status', 'mode', 'is_accepting_submissions')
    list_filter = ('status', 'mode', 'is_accepting_submissions', 'domain')
    search_fields = ('title', 'acronym', 'venue', 'country')
    list_editable = ('is_accepting_submissions',)
    prepopulated_fields = {'slug': ('title',)}
    readonly_fields = ('created_at',)
    fieldsets = (
        ('Basics', {'fields': ('title', 'slug', 'acronym', 'status', 'domain', 'mode')}),
        ('Dates', {'fields': ('start_date', 'end_date', 'submission_deadline', 'registration_deadline')}),
        ('Venue & Organizer', {'fields': ('venue', 'country', 'organizer')}),
        ('Submission Control', {'fields': ('is_accepting_submissions', 'registration_open', 'submission_fee')}),
        ('Content', {'fields': ('description', 'full_description', 'submission_guidelines', 'call_for_papers')}),
        ('Tracks & Dates (JSON)', {'fields': ('tracks', 'important_dates'), 'classes': ('collapse',)}),
        ('Identifiers', {'fields': ('doi_prefix', 'isbn_proceedings')}),
        ('Media', {'fields': ('cover_image', 'banner_image')}),
        ('Timestamps', {'fields': ('created_at',), 'classes': ('collapse',)}),
    )


class ConferenceSubmissionAuthorInline(admin.TabularInline):
    model = ConferenceSubmissionAuthor
    extra = 0
    readonly_fields = ('order', 'is_corresponding')


@admin.register(ConferenceSubmission)
class ConferenceSubmissionAdmin(admin.ModelAdmin):
    list_display = ('reference_number', 'title', 'conference', 'author_full_name', 'author_email', 'status', 'submission_fee', 'submitted_at')
    list_filter = ('status', 'conference', 'paper_type')
    search_fields = ('reference_number', 'title', 'author_full_name', 'author_email', 'client_reference')
    readonly_fields = ('reference_number', 'client_reference', 'submitted_at', 'updated_at', 'manuscript_link', 'declarations', 'razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature')
    autocomplete_fields = ('conference',)
    inlines = [ConferenceSubmissionAuthorInline]
    list_editable = ('status',)
    sortable_by = ('submitted_at', 'reference_number')

    fieldsets = (
        ('Reference', {'fields': ('reference_number', 'conference', 'submitted_by', 'status', 'client_reference')}),
        ('Paper', {'fields': ('title', 'subtitle', 'abstract', 'keywords', 'paper_type', 'research_domain', 'language', 'selected_track')}),
        ('Presentation & Registration', {'fields': ('presentation_mode', 'session_preference', 'registration_category', 'proceedings_preference', 'gst_invoice_required')}),
        ('Corresponding Author', {'fields': ('author_full_name', 'author_email', 'author_phone', 'institution', 'department', 'designation', 'country')}),
        ('Files', {'fields': ('manuscript_file', 'manuscript_link', 'supplementary_file', 'invoice_pdf')}),
        ('Payment', {'fields': ('submission_fee', 'razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature')}),
        ('Declarations', {'fields': ('declarations',), 'classes': ('collapse',)}),
        ('Review', {'fields': ('admin_notes', 'decision_notes')}),
        ('Timestamps', {'fields': ('submitted_at', 'updated_at'), 'classes': ('collapse',)}),
    )

    @admin.display(description='Download manuscript')
    def manuscript_link(self, obj):
        if obj.manuscript_file:
            return format_html(
                '<a href="/api/conference-submissions/{id}/manuscript/" target="_blank">Open manuscript file</a>',
                id=obj.id,
            )
        return '—'
