"""Reusable cache-security response mixins.

These centralise the "private response headers" pattern that Phase 2 first
applied inline on ``orders.OrderViewSet.finalize_response``: every response
from a per-user or staff-only endpoint must declare ``Cache-Control: no-store``
plus a ``Vary`` on the credentials, so a misconfigured shared cache / CDN in
front of the API can never store one customer's data and serve it to another.

Kept free of any app/model imports so it can be mixed into views in any app
without circular-import risk.
"""


class AlwaysPrivateResponseHeadersMixin:
    """Force ``Cache-Control: no-store`` (+ ``Vary``) on EVERY response.

    Apply ONLY to viewsets/views whose every action returns per-user or
    staff-only data (own submissions, own orders, entitlements, profile, admin
    listings). Do NOT apply to mixed public/private catalog viewsets — those
    keep their public list/retrieve cacheable and mark just the private actions
    via ``publications.views.PrivateResponseHeadersMixin``.

    Works for both ``APIView`` subclasses and ``ViewSet`` subclasses because
    ``finalize_response`` is defined on ``rest_framework.views.APIView`` and we
    never reference ``self.action``.
    """

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response["Cache-Control"] = "no-store"
        response["Vary"] = "Authorization, Cookie"
        return response
