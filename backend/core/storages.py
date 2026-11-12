"""Project-wide file storage backends.

Added while remediating the Security & QA report (SECURITY-QA-REPORT.md);
each class below exists because of a specific finding:

* C-1 / H-2  customer documents (invoices, certificates, manuscripts) were
  written into the publicly served ``MEDIA_ROOT``;
* L-1        ``FileSystemStorage`` hands out a ``/media/…`` URL for files that
  must never have one;
* M-3        passing ``location=`` in ``models.py`` baked the developing
  machine's absolute Windows path into the migration graph.
"""
from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.utils.functional import cached_property


class ProtectedStorage(FileSystemStorage):
    """Store for files that may only ever reach a browser through a view.

    Three deliberate differences from a plain ``FileSystemStorage``:

    1. **No constructor arguments.** ``location`` is resolved lazily from
       ``settings.PROTECTED_MEDIA_ROOT`` instead of being passed to
       ``__init__``. The migrations writer serialises an instance with the
       arguments it was built with, so a no-argument storage is recorded as
       ``core.storages.ProtectedStorage()`` — portable to every machine and
       every OS (finding M-3).
    2. **No base URL.** Django's ``FileSystemStorage.base_url`` silently falls
       back to ``settings.MEDIA_URL`` when none is given, which produces a
       public ``/media/...`` link for a private file (finding L-1). Pinning it
       to ``None`` — and returning ``None`` from ``url()`` — means a stray
       ``fields = '__all__'`` serializer publishes nothing: DRF omits a field
       whose URL is falsy, so the protected path can never reach a browser.
    3. **An explicit name.** Reading ``storage=protected_storage`` next to a
       FileField now says out loud that the file is not public.
    """

    @cached_property
    def base_location(self):
        # Not read at import time and never passed to __init__: see (1).
        return getattr(
            settings, 'PROTECTED_MEDIA_ROOT',
            str(settings.BASE_DIR / 'protected_media'),
        )

    @cached_property
    def base_url(self):
        # See (2): protected files have no URL. Downloads go through a view.
        return None

    def url(self, name):
        """Always ``None``: a protected file has no public URL, by design.

        ``FileSystemStorage.url()`` would raise ``ValueError`` here, and every
        DRF ``fields = '__all__'`` serializer that touches such a field calls
        ``.url`` while rendering — one accidental inclusion used to be a 500 on
        an entire list endpoint. Returning ``None`` instead lets DRF's
        ``FileField.to_representation()`` do the safe thing on its own: it
        treats a falsy URL as ``None`` and simply omits the link, so protected
        content can never be published by accident, and the serializers that
        *do* have an authorised endpoint (orders, submissions, articles) set the
        value explicitly themselves.
        """
        return None


# The single shared instance every protected FileField must use. Keeping it
# module-level (not inline in models) also means ``deconstruct()`` always
# serialises the same no-argument path.
protected_storage = ProtectedStorage()
