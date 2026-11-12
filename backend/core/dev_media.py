"""Development-only public media route with a fail-closed allowlist.

Finding C-1 (SECURITY-QA-REPORT.md): ``config/urls.py`` mounted
``static(MEDIA_URL, document_root=MEDIA_ROOT)`` whenever ``DEBUG`` was on, so
every file under ``media/`` — including 482 invoice PDFs, 24 author
certificates and 70 unpublished manuscripts named after the author's own
upload — was downloadable by an anonymous visitor. ``/media/**`` being served
statically is also the layout ``DEPLOYMENT.md`` describes for nginx, so the
same exposure was one deploy away from being production.

Customer documents now live in ``PROTECTED_MEDIA_ROOT`` (see
``core.storages.ProtectedStorage``) and are served exclusively through
authorised views. This module is the second line of defence: even a file that
is accidentally written into the public tree is served only when its prefix is
explicitly listed as marketing/public imagery.
"""
from django.conf import settings
from django.http import Http404
from django.views.static import serve

# Only these prefixes of MEDIA_ROOT are ever served without an authorisation
# check: cover art and sample excerpts a shop window is meant to show.
# Anything else 404s — invoices, manuscripts, certificates, submission
# uploads, and any new directory added later (fail-closed by design, so a
# future FileField cannot silently become public).
DEFAULT_PUBLIC_MEDIA_PREFIXES = (
    'books/covers/',
    'books/samples/',
    'journals/covers/',
    'journals/issues/',
    'conferences/covers/',
    'conferences/banners/',
    'slider/',
    'testimonials/avatars/',
    'profile_pics/',
    'volumes/covers/',
    'authors/photos/',
    'categories/',
)


def _public_prefixes():
    return tuple(getattr(settings, 'PUBLIC_MEDIA_PREFIXES', DEFAULT_PUBLIC_MEDIA_PREFIXES))


def serve_public_media(request, path):
    """Serve a public marketing asset out of MEDIA_ROOT, nothing else.

    ``django.views.static.serve`` already blocks ``..`` traversal with
    ``safe_join``; the prefix test here is about *classification*, not
    traversal — it is what keeps ``invoices/invoice_order_1.pdf`` (a real,
    guessable name) out of reach.
    """
    cleaned = (path or '').replace('\\', '/').lstrip('/')
    parts = [segment for segment in cleaned.split('/') if segment]
    if '..' in parts or '.' in parts or not parts:
        raise Http404('This file is not publicly served.')

    normalised = '/'.join(parts) + '/'
    if not normalised.startswith(_public_prefixes()):
        # Not a listed public prefix: refuse rather than explain what exists.
        raise Http404('This file is not publicly served.')

    return serve(request, '/'.join(parts), document_root=str(settings.MEDIA_ROOT))
