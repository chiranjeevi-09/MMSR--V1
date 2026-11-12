"""Streaming responses for files kept in ``PROTECTED_MEDIA_ROOT``.

SECURITY-QA-REPORT C-1 / H-2 moved customer and author documents out of the
publicly served ``MEDIA_ROOT``. Every place that hands one of those files to a
browser now has to do the same three things: re-check authorization (in the
view, before calling here), open the key stored on the row, and name the
download after a *public* identifier so the storage path — which can carry an
original upload filename — never leaves the server.

Phase 11C adds production Nginx X-Accel-Redirect offloading:
When ``settings.USE_X_ACCEL_REDIRECT=True``, Django performs auth & permission checks,
validates path traversal, and returns an empty response with ``X-Accel-Redirect``.
Nginx then streams the file via sendfile, freeing Gunicorn workers immediately.
When ``settings.USE_X_ACCEL_REDIRECT=False`` (local dev), standard ``FileResponse`` is used.
"""
import logging
import os
import re
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, HttpResponse, Http404

logger = logging.getLogger(__name__)

# Extension of the stored upload -> media type. The extension comes from a
# filename that was, at some point, supplied by an end user, so anything
# unlisted is served as an opaque octet-stream instead of being echoed back as
# a type the browser might act on.
CONTENT_TYPES = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt': 'text/plain; charset=utf-8',
    '.csv': 'text/csv; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.epub': 'application/epub+zip',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

# Characters that are legal in an RFC 6266 quoted filename. Anything else in the
# name we were handed is replaced rather than quoted-escaped: these names are
# built from public IDs, so a stray character means something unexpected.
_SAFE_NAME_RE = re.compile(r'[^A-Za-z0-9._-]')


def protected_file_response(file_field, *, download_name, disposition='attachment',
                            content_type=None):
    """Return an authorized download response for a protected ``FieldFile``.

    In production with Nginx (``settings.USE_X_ACCEL_REDIRECT=True``):
        Returns an empty response with ``X-Accel-Redirect`` header pointing to the
        internal Nginx location. Nginx offloads file transmission via sendfile,
        freeing the Gunicorn worker process in milliseconds.

    In local development / fallback (``settings.USE_X_ACCEL_REDIRECT=False``):
        Returns a Django ``FileResponse`` streaming directly from the filesystem.

    :param file_field: the ``FieldFile`` (``instance.some_file``) to stream.
    :param download_name: filename shown to the user. Built by the caller from
        public identifiers only — never ``file_field.name``.
    :param disposition: ``'attachment'`` (save to disk) or ``'inline'`` (render).
    :param content_type: override the extension-derived media type.
    :raises Http404: no file attached, missing on disk, or path traversal detected.
    """
    if not file_field:
        raise Http404('This file is not available.')

    field_name = str(getattr(file_field, 'name', '') or '').strip()
    if not field_name:
        raise Http404('This file is not available.')

    # Path traversal protection: normalize and prevent parent/root escapes
    clean_name = os.path.normpath(field_name).replace('\\', '/')
    if clean_name.startswith('../') or '/../' in clean_name or clean_name.startswith('/'):
        logger.error('Path traversal attempt rejected for file key %r', field_name)
        raise Http404('File could not be found.')

    root_raw = getattr(settings, 'PROTECTED_MEDIA_ROOT', None) or (settings.BASE_DIR / 'protected_media')
    root_path = Path(root_raw).resolve()
    target_path = (root_path / clean_name).resolve()

    try:
        if not target_path.is_relative_to(root_path):
            logger.error('File key %r resolves outside protected root: %r', field_name, str(target_path))
            raise Http404('File could not be found.')
    except AttributeError:
        # Python < 3.9 fallback
        if not str(target_path).startswith(str(root_path)):
            logger.error('File key %r resolves outside protected root: %r', field_name, str(target_path))
            raise Http404('File could not be found.')

    if not target_path.is_file():
        logger.error('Missing protected file on disk for key %r at %r', field_name, str(target_path))
        raise Http404('File could not be found.')

    extension = os.path.splitext(clean_name)[1].lower()
    media_type = content_type or CONTENT_TYPES.get(extension, 'application/octet-stream')

    # Callers name the download from public IDs; the stored extension is tacked
    # on so the file opens with the right handler without ever exposing the key
    # or the author's original upload filename.
    safe_name = _SAFE_NAME_RE.sub('_', str(download_name or 'document'))
    if extension and not safe_name.lower().endswith(extension):
        safe_name = f'{safe_name}{extension}'

    use_x_accel = getattr(settings, 'USE_X_ACCEL_REDIRECT', False)
    if use_x_accel:
        prefix = getattr(settings, 'X_ACCEL_PREFIX', '/protected_media_internal/').rstrip('/') + '/'
        x_accel_path = f"{prefix}{clean_name}"
        response = HttpResponse('', content_type=media_type)
        response['X-Accel-Redirect'] = x_accel_path
    else:
        try:
            handle = file_field.open('rb')
        except (FileNotFoundError, ValueError):
            logger.error('Missing protected file handle for key %r', field_name)
            raise Http404('File could not be found.')
        response = FileResponse(handle, content_type=media_type)

    response['Content-Disposition'] = f'{disposition}; filename="{safe_name}"'
    # A per-user document must never land in a shared cache: proxies keyed on
    # the URL would then serve it to the next requester.
    response['Cache-Control'] = 'private, no-store'
    response['Vary'] = 'Authorization, Cookie'
    return response
