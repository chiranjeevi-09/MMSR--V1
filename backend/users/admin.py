from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import Permission
from django import forms
from django.utils.html import format_html, mark_safe
from .models import User
from .roles import ALL_SECTION_KEYS, ROLE_PERMISSION_PRESETS, permissions_for_role


# --- Proxy model for Admin Users ---
class AdminUser(User):
    class Meta:
        proxy = True
        verbose_name = 'Admin'
        verbose_name_plural = 'Admins'


EXCLUDED_APPS = {'admin', 'contenttypes', 'sessions', 'auth'}


def get_permission_groups():
    permissions = Permission.objects.select_related('content_type').order_by(
        'content_type__app_label', 'content_type__model', 'codename'
    )
    groups = {}
    for perm in permissions:
        app = perm.content_type.app_label
        if app in EXCLUDED_APPS:
            continue
        model = perm.content_type.model
        key = (app, model)
        if key not in groups:
            groups[key] = {}
        for action in ['add', 'change', 'delete', 'view']:
            if perm.codename.startswith(action):
                groups[key][action] = perm
                break
    return groups


# --- Custom Widget that renders all grouped permissions in one block ---
class GroupedPermissionsWidget(forms.Widget):
    def render(self, name, value, attrs=None, renderer=None):
        if value is None:
            value = []
        groups = get_permission_groups()
        value_set = set(str(v) for v in value)

        # Group all models by app
        apps = {}
        for (app, model), actions in groups.items():
            if app not in apps:
                apps[app] = []
            apps[app].append((model, actions))

        html = '''
        <style>
            /* Pull the entire permissions field out of admin's right column */
            .field-permissions {
                padding-left: 0 !important;
            }
            .field-permissions > div > label,
            .field-permissions .col-form-label {
                display: none !important;
            }
            .field-permissions > div > div,
            .field-permissions .controls {
                margin-left: 0 !important;
                padding-left: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                flex: 0 0 100% !important;
            }
            /* Inner section styles */
            .perm-section {
                display: flex;
                align-items: flex-start;
                border-bottom: 1px solid #eee;
                padding: 10px 0;
            }
            .perm-section:last-child { border-bottom: none; }
            .perm-section-label {
                flex: 0 0 130px;
                font-size: 13px;
                font-weight: 700;
                color: #495057;
                text-transform: capitalize;
                padding-top: 6px;
            }
            .perm-section-models { flex: 1; }
            .perm-model-row {
                display: flex;
                align-items: center;
                padding: 5px 0;
            }
            .perm-model-name {
                flex: 1;
                font-size: 14px;
                color: #333;
            }
            .perm-model-select select {
                padding: 4px 10px;
                border: 1px solid #ced4da;
                border-radius: 4px;
                font-size: 13px;
                background: #fff;
                min-width: 140px;
                cursor: pointer;
            }
            .perm-model-select select:focus {
                border-color: #80bdff;
                outline: none;
                box-shadow: 0 0 0 2px rgba(0,123,255,.15);
            }
        </style>
        <script>
        document.addEventListener('DOMContentLoaded', function() {
            // Find the field-permissions row and make it span full width from the left
            var fieldRow = document.querySelector('.field-permissions');
            if (fieldRow) {
                var label = fieldRow.querySelector('label');
                if (label) label.style.display = 'none';
                // Target all col-* children and remove offset
                var cols = fieldRow.querySelectorAll('[class*="col-"]');
                cols.forEach(function(col) {
                    col.className = '';
                    col.style.cssText = 'width:100%;padding:0;margin:0;';
                });
                var innerDiv = fieldRow.querySelector('div > div');
                if (innerDiv) {
                    innerDiv.style.cssText = 'width:100%;padding:0;margin:0;';
                }
            }
        });
        </script>
        '''

        for app, models in apps.items():
            models_html = ''
            for model, actions in models:
                model_label = model.replace('_', ' ').title()
                select_name = f'{name}_select_{app}_{model}'
                view_perm = actions.get('view')
                add_perm = actions.get('add')
                current_val = 'no_access'
                if add_perm and str(add_perm.pk) in value_set:
                    current_val = 'can_edit'
                elif view_perm and str(view_perm.pk) in value_set:
                    current_val = 'view_only'

                opt_no   = 'selected' if current_val == 'no_access' else ''
                opt_view = 'selected' if current_val == 'view_only' else ''
                opt_edit = 'selected' if current_val == 'can_edit'  else ''

                models_html += f'''
                <div class="perm-model-row">
                    <div class="perm-model-name">{model_label}</div>
                    <div class="perm-model-select">
                        <select name="{select_name}">
                            <option value="no_access" {opt_no}>— No Access —</option>
                            <option value="view_only" {opt_view}>View only</option>
                            <option value="can_edit"  {opt_edit}>Can Edit</option>
                        </select>
                    </div>
                </div>
                '''

            html += f'''
            <div class="perm-section">
                <div class="perm-section-label">{app.title()}</div>
                <div class="perm-section-models">{models_html}</div>
            </div>
            '''

        return mark_safe(html)

    def value_from_datadict(self, data, files, name):
        groups = get_permission_groups()
        selected_perm_ids = []
        for (app, model), actions in groups.items():
            select_name = f'{name}_select_{app}_{model}'
            val = data.get(select_name, 'no_access')
            if val == 'view_only':
                if 'view' in actions:
                    selected_perm_ids.append(actions['view'].pk)
            elif val == 'can_edit':
                for action in ['add', 'change', 'delete', 'view']:
                    if action in actions:
                        selected_perm_ids.append(actions[action].pk)
        return selected_perm_ids


# --- Custom Permission Field ---
class GroupedPermissionsField(forms.Field):
    widget = GroupedPermissionsWidget

    def clean(self, value):
        if value is None:
            return []
        return value


# --- Custom Add Admin Form ---
class AddAdminForm(forms.ModelForm):
    first_name = forms.CharField(label='First name', required=False)
    last_name = forms.CharField(label='Last name', required=False)
    email = forms.EmailField(
        label='Email address', 
        required=False, 
        widget=forms.EmailInput(attrs={'autocomplete': 'new-password'})
    )
    password = forms.CharField(
        label='Password', 
        required=False, 
        widget=forms.PasswordInput(attrs={'autocomplete': 'new-password'})
    )
    existing_user_email = forms.ModelChoiceField(
        queryset=User.objects.filter(is_staff=False),
        label='',
        empty_label='--- Optional: Select existing user ---',
        required=False,
    )
    # SECURITY-QA-REPORT L-2. The grant map is what the CMS middleware reads,
    # and it is now least-privilege (an unmapped section is denied). Django's
    # own "add staff" path never wrote one, so an admin created here signed in
    # to either a fully locked desk or — under the old fallback — a CMS they
    # owned entirely. Ask for a role, and always store a complete map.
    cms_role = forms.ChoiceField(
        label='CMS role (seeds section access)',
        required=False,
        choices=(
            ('', '— No CMS section access (grant sections later) —'),
        ) + tuple((key, key.replace('_', ' ').title()) for key in ROLE_PERMISSION_PRESETS),
        help_text=(
            'Sets the initial per-section grants for the Publication CMS. '
            'Super Admin status is never granted here — tick it on the change '
            'page deliberately. Fine-tune any section afterwards on '
            '/admin/access.'
        ),
    )
    permissions = GroupedPermissionsField(label='', required=False)

    class Meta:
        model = User
        fields = ('first_name', 'last_name', 'email')

    def clean(self):
        cleaned_data = super().clean()
        email = cleaned_data.get('email')
        password = cleaned_data.get('password')
        existing_user = cleaned_data.get('existing_user_email')
        
        if not existing_user:
            if not email:
                self.add_error('email', 'Email is required if not selecting an existing user.')
            if not password:
                self.add_error('password', 'Password is required if not selecting an existing user.')
        return cleaned_data

    def _seed_section_grants(self, user):
        """Write an explicit, complete per-section grant map (L-2).

        Anything the account already carries is preserved — a super admin
        re-using this form on an existing admin must not silently widen or
        narrow their access. Only missing keys are filled in, from the chosen
        role preset or, when no role was picked, with 'none'.
        """
        role = self.cleaned_data.get('cms_role') or ''
        defaults = (permissions_for_role(role) if role
                    else {key: 'none' for key in ALL_SECTION_KEYS})
        grants = dict(user.admin_permissions or {})
        for key, level in defaults.items():
            grants.setdefault(key, level)
        user.admin_permissions = grants
        if role and not user.admin_role:
            user.admin_role = role

    def save(self, commit=True):
        existing_user = self.cleaned_data.get('existing_user_email')
        if existing_user:
            user = existing_user
            user.is_staff = True
            user.is_active = True
        else:
            user = super().save(commit=False)
            user.is_staff = True
            user.is_active = True
            user.set_password(self.cleaned_data.get('password'))

        self._seed_section_grants(user)

        if commit:
            user.save()
            perm_ids = self.cleaned_data.get('permissions', [])
            user.user_permissions.set(Permission.objects.filter(pk__in=perm_ids))
        return user


# --- Regular User Admin ---
@admin.register(User)
class CustomUserAdmin(UserAdmin):
    ordering = ('email',)
    list_display = ('email', 'first_name', 'last_name', 'is_staff', 'is_author')
    search_fields = ('email', 'first_name', 'last_name')
    list_filter = ()
    actions = ['delete_selected']
    readonly_fields = ('email', 'last_login', 'date_joined')

    fieldsets = (
        ('Personal Info', {'fields': ('email', 'first_name', 'last_name', 'phone_number')}),
        ('Address', {'fields': ('address', 'city', 'country', 'postal_code')}),
        ('Account Status', {'fields': ('is_active', 'is_author')}),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )

    def has_add_permission(self, request):
        # Users register themselves via the website — no manual add from admin
        return False

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if not request.user.is_superuser:
            return qs.filter(pk=request.user.pk)
        return qs

    def has_module_permission(self, request):
        return request.user.is_superuser

    def has_view_permission(self, request, obj=None):
        if not request.user.is_superuser:
            return obj is None or obj.pk == request.user.pk
        return True

    def has_change_permission(self, request, obj=None):
        if not request.user.is_superuser:
            return obj is None or obj.pk == request.user.pk
        return True


# --- Admin User Admin ---
@admin.register(AdminUser)
class AdminUserAdmin(UserAdmin):
    ordering = ('email',)
    list_display = ('email', 'first_name', 'last_name', 'is_staff', 'is_superuser')
    search_fields = ('email', 'first_name', 'last_name')
    list_filter = ('is_staff', 'is_superuser', 'is_active')
    readonly_fields = ('email', 'last_login', 'date_joined', 'display_permissions')

    fieldsets = (
        ('Personal Info', {'fields': ('email', 'first_name', 'last_name')}),
        ('Permissions', {'fields': ('display_permissions',)}),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if not request.user.is_superuser:
            return qs.filter(pk=request.user.pk)
        return qs

    def has_module_permission(self, request):
        return request.user.is_superuser

    def has_view_permission(self, request, obj=None):
        if not request.user.is_superuser:
            return obj is None or obj.pk == request.user.pk
        return True

    def has_change_permission(self, request, obj=None):
        if not request.user.is_superuser:
            return obj is None or obj.pk == request.user.pk
        return True

    def get_urls(self):
        from django.urls import path
        urls = super().get_urls()
        custom_urls = [
            path('my-profile/', self.admin_site.admin_view(self.my_profile_redirect), name='users_adminuser_my_profile'),
        ]
        return custom_urls + urls

    def my_profile_redirect(self, request):
        from django.shortcuts import redirect
        from django.urls import reverse
        return redirect(reverse('admin:users_user_change', args=[request.user.pk]))

    def display_permissions(self, obj):
        """Read-only grouped permission display for the change/edit page."""
        groups = get_permission_groups()
        user_perm_ids = set(obj.user_permissions.values_list('pk', flat=True))

        # Pre-group by app
        apps = {}
        for (app, model), actions in groups.items():
            if app not in apps:
                apps[app] = []
            apps[app].append((model, actions))

        BADGE = {
            'no_access': ('<span style="background:#e9ecef;color:#6c757d;padding:3px 10px;'
                          'border-radius:12px;font-size:12px;">No Access</span>'),
            'view_only': ('<span style="background:#cfe2ff;color:#084298;padding:3px 10px;'
                          'border-radius:12px;font-size:12px;">View only</span>'),
            'can_edit':  ('<span style="background:#d1e7dd;color:#0a3622;padding:3px 10px;'
                          'border-radius:12px;font-size:12px;">Can Edit</span>'),
        }

        html = '''
        <style>
            .ro-perm-section {
                display: flex;
                align-items: flex-start;
                border-bottom: 1px solid #eee;
                padding: 10px 0;
            }
            .ro-perm-section:last-child { border-bottom: none; }
            .ro-perm-app {
                flex: 0 0 130px;
                font-size: 13px;
                font-weight: 700;
                color: #495057;
                padding-top: 6px;
            }
            .ro-perm-models { flex: 1; }
            .ro-perm-row {
                display: flex;
                align-items: center;
                padding: 5px 0;
            }
            .ro-perm-name {
                flex: 1;
                font-size: 14px;
                color: #333;
            }
        </style>
        '''

        for app, models in apps.items():
            rows_html = ''
            for model, actions in models:
                model_label = model.replace('_', ' ').title()
                add_perm  = actions.get('add')
                view_perm = actions.get('view')
                if add_perm and add_perm.pk in user_perm_ids:
                    badge = BADGE['can_edit']
                elif view_perm and view_perm.pk in user_perm_ids:
                    badge = BADGE['view_only']
                else:
                    badge = BADGE['no_access']
                rows_html += (
                    f'<div class="ro-perm-row">'
                    f'<div class="ro-perm-name">{model_label}</div>'
                    f'<div>{badge}</div>'
                    f'</div>'
                )
            html += (
                f'<div class="ro-perm-section">'
                f'<div class="ro-perm-app">{app.title()}</div>'
                f'<div class="ro-perm-models">{rows_html}</div>'
                f'</div>'
            )

        return mark_safe(html)

    display_permissions.short_description = 'Module Access'

    def get_form(self, request, obj=None, **kwargs):
        if obj is None:
            return AddAdminForm
        return super().get_form(request, obj, **kwargs)

    def get_fieldsets(self, request, obj=None):
        if obj is None:
            return (
                ('Create Admin', {
                    'classes': ('admin-step-1',),
                    'fields': ('first_name', 'last_name', 'email', 'password'),
                    'description': 'Create a new admin user by providing basic details and a default password.',
                }),
                ('Role Access & Permissions', {
                    'classes': ('admin-step-2',),
                    'fields': ('existing_user_email', 'cms_role', 'permissions'),
                }),
            )
        return super().get_fieldsets(request, obj)

    def check(self, **kwargs):
        errors = []
        for error in super().check(**kwargs):
            if 'permissions' not in str(error) and 'perm_' not in str(error):
                errors.append(error)
        return errors

    def get_queryset(self, request):
        return super().get_queryset(request).filter(is_staff=True)

