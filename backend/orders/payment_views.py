"""Payment result landing pages — legacy entry points (audit finding C-1).

These Django-rendered pages predate the authenticated Next.js checkout flow
(app/payment/success|failed|processing/<id>), which fetches order data from
the authorization-checked commerce API and reveals it only to the order
owner or staff.

Historically these views looked an order up by a client-supplied ?order_id=
and rendered the customer's name, email, transaction id and amount to ANY
anonymous requester — an IDOR over sequential order ids. They are now inert
redirect stubs: they never query, render or confirm order information and
simply hand the browser back to the equivalent protected frontend route.
The legacy templates under templates/payment/ are no longer rendered by any
view and are kept only as historical reference.
"""
from django.conf import settings
from django.http import HttpResponseRedirect


def _frontend_redirect(request, path):
    """Send the browser to the authenticated frontend route.

    The target URL carries only the (client-known) order id; every byte of
    order data behind it is gated by the API's ownership checks. The base
    origin comes from settings.FRONTEND_URL, never from request headers,
    so this can't be turned into an open redirect.
    """
    base = settings.FRONTEND_URL.rstrip('/')
    return HttpResponseRedirect(f"{base}{path}")


def _safe_order_id(request):
    """Return the requested order id only if it is a plain positive integer.

    Existence is deliberately NOT checked here — confirming or denying an id
    would itself be an enumeration oracle.
    """
    order_id = (request.GET.get('order_id') or '').strip()
    if order_id.isdigit() and 0 < int(order_id) < 10 ** 12:
        return order_id
    return ''


def payment_success(request):
    order_id = _safe_order_id(request)
    if order_id:
        return _frontend_redirect(request, f"/payment/success/{order_id}")
    return _frontend_redirect(request, "/dashboard/orders")


def payment_failed(request):
    # The old view also echoed the client-supplied ?reason= string straight
    # into HTML; arbitrary text is now dropped entirely. The frontend failed
    # payment page derives its own message from server-verified state.
    order_id = _safe_order_id(request)
    if order_id:
        return _frontend_redirect(request, f"/payment/failed/{order_id}")
    return _frontend_redirect(request, "/dashboard/orders")


def payment_pending(request):
    order_id = _safe_order_id(request)
    if order_id:
        # The frontend processing page re-verifies the payment server-side.
        return _frontend_redirect(request, f"/payment/processing/{order_id}")
    return _frontend_redirect(request, "/dashboard/orders")
