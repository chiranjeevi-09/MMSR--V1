"""
Central CMS section-access enforcement.

A super admin grants each staff user a per-section access level
("none" | "read" | "edit") from the /admin/access page; the grants are
stored on ``User.admin_permissions``. This middleware is the single
server-authoritative chokepoint that enforces them on every /api/ request:

  * Anonymous / non-staff requests are untouched — public and customer
    flows keep working exactly as before.
  * Superusers bypass all checks.
  * A staff user's access to a section is decided ONLY by what is written in
    their grant map; a section with no entry is denied (SECURITY-QA-REPORT
    L-2). The old "no entry ⇒ full staff access" fallback meant any account
    created straight in the Django admin — a path that never seeded
    permissions — silently owned the entire CMS. Existing accounts were
    brought up to date with an explicit map by
    ``users/migrations/0009_seed_staff_admin_permissions.py``.
  * Safe methods (GET/HEAD/OPTIONS) require at least "read"; every other
    method (POST/PUT/PATCH/DELETE) requires "edit".
"""
from django.http import JsonResponse

# API path prefixes → CMS section key. First matching prefix wins; keep
# more specific prefixes above their generic counterparts.
SECTION_ROUTES = (
    ('/api/users/auth/', None),        # login/register — never gated
    ('/api/users/profile/', None),     # own profile — never gated
    ('/api/users/invitations/', None), # admin invitations — view-level IsSuperAdmin guards these
    ('/api/users/', 'users'),
    ('/api/publications/books/', 'books'),
    ('/api/publications/chapters/', 'books'),
    ('/api/publications/chapter-authors/', 'books'),
    ('/api/publications/admin/chapters/', 'books'),
    ('/api/publications/categories/', 'categories'),
    ('/api/publications/journals/', 'journals'),
    ('/api/publications/issues/', 'journals'),
    ('/api/publications/articles/', 'journals'),
    ('/api/publications/user-access/', 'journals'),
    ('/api/submissions/', 'submissions'),
    ('/api/conferences/', 'conferences'),
    ('/api/conference-submissions/', 'conferences'),
    ('/api/commerce/', 'orders'),      # orders, payments and fulfillment
    ('/api/slider/', 'hero_slider'),
    ('/api/policies/', 'policies'),
    ('/api/publications/testimonials/', 'testimonials'),
    ('/api/publications/admin/testimonials/', 'testimonials'),
    ('/api/publications/contact-inquiries/', 'enquiries'),  # + departments
    ('/api/publications/newsletter-subscribers/', 'subscribers'),
    ('/api/publications/newsletter-broadcasts/', 'subscribers'),
    ('/api/publications/site-metrics/', 'site_content'),    # + services/faqs
    ('/api/publications/university-partners/', 'site_content'),
)

SAFE_METHODS = ('GET', 'HEAD', 'OPTIONS')


def _match_section(path):
    for prefix, section in SECTION_ROUTES:
        if path.startswith(prefix):
            return section
    return None


class AdminSectionAccessMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith('/api/') and self._denied(request):
            section = _match_section(request.path)
            return JsonResponse(
                {
                    'detail': (
                        'You do not have permission for this part of the CMS. '
                        'Ask a Super Admin to adjust your access on the '
                        'Admin Access page.'
                    ),
                    'section': section,
                },
                status=403,
            )
        return self.get_response(request)

    def _denied(self, request):
        path = request.path
        if path.startswith('/api/users/auth/') or path.startswith('/api/users/profile/'):
            return False
        section = _match_section(path)
        if section is None:
            return False

        user = self._resolve_user(request)
        if user is None or not user.is_staff or user.is_superuser:
            return False

        level = (user.admin_permissions or {}).get(section)
        if level is None:
            # Least privilege by default: nothing in the map means no access.
            return True

        if request.method in SAFE_METHODS:
            return level not in ('read', 'edit')
        return level != 'edit'

    @staticmethod
    def _resolve_user(request):
        """Session user if available, else decode the JWT bearer header."""
        user = getattr(request, 'user', None)
        if user is not None and getattr(user, 'is_authenticated', False):
            return user
        try:
            from rest_framework_simplejwt.authentication import JWTAuthentication
            result = JWTAuthentication().authenticate(request)
            return result[0] if result else None
        except Exception:
            # Invalid/expired tokens are handled by the view layer; here we
            # simply skip the section check.
            return None
