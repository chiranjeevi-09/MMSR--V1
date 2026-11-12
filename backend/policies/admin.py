from django.contrib import admin
from .models import Policy, PolicyVersion, PolicyAcceptance


class PolicyVersionInline(admin.TabularInline):
    model = PolicyVersion
    extra = 0
    fields = ('version', 'title', 'status', 'effective_date', 'published_at', 'created_at')
    readonly_fields = ('created_at',)


@admin.register(Policy)
class PolicyAdmin(admin.ModelAdmin):
    list_display = ('title', 'policy_type', 'is_archived', 'created_at', 'updated_at')
    list_filter = ('policy_type', 'is_archived')
    search_fields = ('title',)
    inlines = [PolicyVersionInline]


@admin.register(PolicyVersion)
class PolicyVersionAdmin(admin.ModelAdmin):
    list_display = ('policy', 'version', 'status', 'effective_date', 'published_at', 'created_by')
    list_filter = ('status', 'policy')
    search_fields = ('title', 'version')
    readonly_fields = ('created_at', 'updated_at', 'published_at')


@admin.register(PolicyAcceptance)
class PolicyAcceptanceAdmin(admin.ModelAdmin):
    list_display = ('user', 'policy_type', 'version_number', 'submission', 'accepted_at')
    list_filter = ('policy_type',)
    search_fields = ('user__email', 'version_number')
    readonly_fields = [f.name for f in PolicyAcceptance._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        # Acceptance records are immutable audit history.
        return False
