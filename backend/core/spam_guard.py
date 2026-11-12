"""Bot defences for the public (``AllowAny``) write endpoints.

SECURITY-QA-REPORT M-4: the contact form, the testimonial form and the
newsletter signup were unauthenticated, unthrottled and unguarded — 40 requests
from one script produced 40 rows and 80 outbound emails, and because the
"thank you" mail is addressed from the request body, the site becomes a mailbox
for any third party an attacker chooses to spam, at the publisher's cost and
domain reputation.

Two cheap layers, both of which stay useful behind nginx rate-limiting:

* a per-IP throttle (a ``ScopedRateThrottle`` subclass with its own ``scope``,
  so each form gets an independent budget without touching view code), and
* a honeypot field: a text input the real forms render invisible to humans.
  Bots fill every field they find, so a non-empty value is proof of automation —
  the request is accepted and dropped, which teaches the bot nothing.
"""
from rest_framework.throttling import SimpleRateThrottle

# Name of the hidden form input. Keep in sync with the frontend forms
# (lib/utils/spamGuard.ts + components/ui/HoneypotField.tsx, used by
# app/contact, components/reviews/ReviewSection.tsx and the newsletter signup).
HONEYPOT_FIELD = 'website'


def is_automated(request):
    """True when the honeypot carries a value.

    Anything non-empty counts, including a list of values (``a[]=x`` style
    payloads), because a legitimate browser sends the field empty or not at all.
    """
    try:
        data = request.data
    except Exception:
        return False
    value = data.get(HONEYPOT_FIELD) if hasattr(data, 'get') else None
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    return bool(value)


class PublicFormThrottle(SimpleRateThrottle):
    """Per-IP write budget for one public form.

    Subclasses declare a class-level ``scope`` and the view attaches them via
    ``throttle_classes`` (no ``throttle_scope`` on the view). Extending
    ``SimpleRateThrottle`` — not ``ScopedRateThrottle`` — is deliberate:
    ``ScopedRateThrottle.allow_request`` re-reads ``self.scope`` from
    ``view.throttle_scope`` and, finding none, returns ``True`` and disables
    throttling entirely. ``SimpleRateThrottle`` resolves the rate once from the
    class ``scope`` in ``__init__`` and leaves it alone, so the budget below is
    actually enforced. The three budgets stay independent — flooding the
    newsletter signup cannot exhaust the contact form's allowance.
    """

    def get_cache_key(self, request, view):
        ident = self.get_ident(request)
        return self.cache_format % {'scope': self.scope, 'ident': ident}


class ContactFormThrottle(PublicFormThrottle):
    scope = 'contact-form'


class TestimonialFormThrottle(PublicFormThrottle):
    scope = 'testimonial-form'


class NewsletterFormThrottle(PublicFormThrottle):
    scope = 'newsletter'


class ThrottleWritesOnlyMixin:
    """Throttle the public write action, never the staff-facing queue.

    ``throttle_classes`` on a ModelViewSet would otherwise also apply to the
    admin list/retrieve that shares the same viewset, so an editor working the
    enquiry desk would start seeing 429s. Non-create actions are exempt.
    """

    throttled_actions = {'create'}

    def get_throttles(self):
        if getattr(self, 'action', None) not in self.throttled_actions:
            return []
        return super().get_throttles()
