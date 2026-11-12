"""Reusable data-migration helper for moving files between storage roots.

SECURITY-QA-REPORT C-1 / H-2 moved several ``FileField``s from the publicly
served ``MEDIA_ROOT`` onto ``protected_storage`` (``PROTECTED_MEDIA_ROOT``).
Changing the storage only changes *where Django looks for the key*; every
existing row keeps the same ``<field>.name`` value, so the physical file has to
be moved next to it or every stored document 404s.

The helper is deliberately tolerant: a missing file is reported, never raised,
because these migrations run on machines (CI, the test runner, a fresh clone)
where the media tree simply is not present.
"""
import os
import shutil


def _roots():
    from django.conf import settings

    media = str(getattr(settings, 'MEDIA_ROOT', ''))
    protected = str(getattr(settings, 'PROTECTED_MEDIA_ROOT', ''))
    return media, protected


def _move_one(name, src_root, dst_root, stats):
    """Copy ``name`` from src_root to dst_root and delete the source copy.

    Verified before deleting: the destination must exist with an identical
    size. Anything uncertain is left in place and counted, so a partial run
    never destroys the only copy of a document.
    """
    src = os.path.join(src_root, name.replace('/', os.sep))
    dst = os.path.join(dst_root, name.replace('/', os.sep))

    if not os.path.isfile(src):
        stats['missing_source'] += 1
        return

    os.makedirs(os.path.dirname(dst), exist_ok=True)

    if os.path.exists(dst):
        if os.path.getsize(dst) == os.path.getsize(src):
            # Already relocated by an earlier (possibly interrupted) run.
            os.remove(src)
            stats['deduplicated'] += 1
        else:
            stats['conflicts'] += 1
        return

    shutil.copy2(src, dst)
    if os.path.getsize(dst) != os.path.getsize(src):
        os.remove(dst)
        stats['failed'] += 1
        return
    os.remove(src)
    stats['moved'] += 1


def relocate_field_files(apps, model_label, field_names, *, to_protected=True):
    """Move every file of ``field_names`` between the two storage roots.

    :param apps: the ``apps`` argument handed to ``RunPython``.
    :param model_label: ``'<app_label>.<ModelName>'``.
    :param field_names: iterable of FileField names on that model.
    :param to_protected: ``True`` = MEDIA_ROOT -> PROTECTED_MEDIA_ROOT,
        ``False`` = the reverse (used by the migration's backwards function).
    :returns: stats dict, for logging by the caller.
    """
    media_root, protected_root = _roots()
    if not media_root or not protected_root:
        return {'moved': 0, 'missing_source': 0, 'deduplicated': 0,
                'conflicts': 0, 'failed': 0, 'skipped_no_roots': True}

    src_root, dst_root = (media_root, protected_root) if to_protected \
        else (protected_root, media_root)

    model = apps.get_model(model_label)
    stats = {'moved': 0, 'missing_source': 0, 'deduplicated': 0,
             'conflicts': 0, 'failed': 0}

    for field in field_names:
        # ``exclude('')`` and ``exclude(None)`` both matter: a blank FileField
        # has historically been written as either, depending on how the row was
        # saved. Only the key column is selected — the files are moved without
        # ever instantiating the (protected) storage of the historical model.
        rows = model.objects.exclude(**{field: ''}).exclude(**{field: None})
        for _pk, name in rows.values_list('pk', field):
            if not name:
                continue
            _move_one(str(name), src_root, dst_root, stats)

    return stats
