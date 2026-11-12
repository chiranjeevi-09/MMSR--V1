"""API helpers for the MMSR public ID standard (Phase 5 spec §7).

Public IDs are an *additional* way to address a record over HTTP. Internal
primary keys and foreign keys keep working exactly as before; nothing here
replaces them, and nothing here is used for authorization — the resolved
object always comes out of ``get_queryset()``, which is where ownership and
staff scoping already live.
"""

from django.http import Http404

from core.models import PUBLIC_ID_PATTERN


def is_valid_public_id(value):
    """True only for a well-formed ``MMSR-XXX-1931-NNNNNN`` string."""
    return bool(value) and bool(PUBLIC_ID_PATTERN.match(str(value)))


def find_by_public_id(queryset, value):
    """Return the row whose ``public_id`` equals ``value``, or None.

    A malformed value never reaches the column: the query would be pointless
    and (for a slug lookup) could mask a genuine record.
    """
    if not is_valid_public_id(value):
        return None
    return queryset.filter(public_id=str(value)).first()


class PublicIDLookupMixin:
    """Let a detail route accept the public ID as well as the existing lookup.

    Drop-in for ModelViewSet / ReadOnlyModelViewSet subclasses, including the
    ones whose ``lookup_field`` is ``slug``:

      * a validly formatted public ID resolves through ``public_id`` and an
        unknown one is a 404 (never a silent fall-through to another row);
      * anything else (numeric pk, slug) is delegated untouched to the
        standard DRF resolution, so every existing URL keeps working.
    """

    def _public_id_lookup_value(self):
        for key in (self.lookup_field, 'pk', 'slug'):
            value = self.kwargs.get(key)
            if value is not None and is_valid_public_id(value):
                return str(value)
        return None

    def get_object(self):
        wanted = self._public_id_lookup_value()
        if wanted is None:
            return super().get_object()
        obj = find_by_public_id(self.filter_queryset(self.get_queryset()), wanted)
        if obj is None:
            raise Http404(f'{wanted} not found.')
        self.check_object_permissions(self.request, obj)
        return obj
