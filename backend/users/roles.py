"""Default per-section CMS grants for each invitable admin role.

Keys are the section identifiers enforced by
``config.middleware.AdminSectionAccessMiddleware`` (see SECTION_ROUTES).
A role seeds ``User.admin_permissions`` on activation; a Super Admin can
then fine-tune any section from /admin/access. Any section not listed
explicitly becomes "none" — invited admins get least privilege by default.
"""

ALL_SECTION_KEYS = (
    'users', 'books', 'journals', 'submissions', 'conferences', 'orders',
    'categories', 'testimonials', 'enquiries', 'subscribers', 'hero_slider',
    'site_content', 'policies',
)

ROLE_PERMISSION_PRESETS = {
    'publication_admin': {
        'books': 'edit',
        'journals': 'edit',
        'categories': 'edit',
        'policies': 'edit',
        'submissions': 'read',
        'conferences': 'read',
        'site_content': 'read',
        'orders': 'read',
    },
    'editorial_admin': {
        'submissions': 'edit',
        'journals': 'edit',
        'conferences': 'edit',
        'books': 'read',
        'categories': 'read',
        'policies': 'read',
        'testimonials': 'read',
    },
    'finance_admin': {
        'orders': 'edit',
        'submissions': 'read',
        'conferences': 'read',
        'books': 'read',
        'journals': 'read',
    },
    'support_admin': {
        'enquiries': 'edit',
        'subscribers': 'edit',
        'testimonials': 'edit',
        'site_content': 'read',
        'books': 'read',
        'journals': 'read',
        'conferences': 'read',
        'policies': 'read',
        'orders': 'read',
    },
}


def permissions_for_role(role):
    """Full 13-section grant map for a role.

    ``super_admin`` bypasses section checks entirely (is_superuser), so it
    receives an all-edit map purely for display consistency.
    """
    if role == 'super_admin':
        return {key: 'edit' for key in ALL_SECTION_KEYS}
    preset = ROLE_PERMISSION_PRESETS.get(role, {})
    return {key: preset.get(key, 'none') for key in ALL_SECTION_KEYS}
