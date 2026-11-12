"""Post-save and pre-save signals to generate optimized WebP image variants after upload.

Phase 11G Hardening:
- Pre-save tracks the current database image filename.
- Post-save only triggers WebP variant generation if:
  a) The record is newly created with an image, OR
  b) The image field filename has changed, OR
  c) The WebP variants are missing from disk.
- Unrelated updates (e.g. price change, status change) NEVER spawn variant generation threads.
- Comprehensive model coverage:
  * Book — cover_image
  * Journal — cover_image
  * JournalIssue — cover_image
  * ChapterAuthor — photo
  * PublishedVolume — cover_image
  * SliderImage — image
  * Conference — cover_image, banner_image
  * Testimonial — avatar
"""
import logging
import threading
from pathlib import Path

from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)

# Model label -> list of ImageField names to monitor
MONITORED_IMAGE_FIELDS = {
    'publications.Book': ['cover_image'],
    'publications.Journal': ['cover_image'],
    'publications.JournalIssue': ['cover_image'],
    'publications.ChapterAuthor': ['photo'],
    'submissions.PublishedVolume': ['cover_image'],
    'slider.SliderImage': ['image'],
    'conferences.Conference': ['cover_image', 'banner_image'],
    'publications.Testimonial': ['avatar'],
}


def _generate_variants_async(file_path):
    """Launch variant generation in a daemon thread to avoid blocking the save."""
    from core.image_processing import generate_optimized_image_variants

    def _worker():
        try:
            generate_optimized_image_variants(file_path)
        except Exception as exc:
            logger.error('WebP variant generation failed for %s: %s', file_path, exc)

    t = threading.Thread(target=_worker, daemon=True, name='webp-variant')
    t.start()


def _safe_file_path(field_file):
    """Return the absolute on-disk path for a FieldFile, or None if unavailable."""
    if not field_file:
        return None
    try:
        return field_file.path
    except (ValueError, NotImplementedError):
        # S3 / remote storages raise NotImplementedError for .path; skip silently.
        return None


def _handle_image_field(instance, field_name, created):
    """Generate variants for the given image field if the file exists and is new or changed."""
    field = getattr(instance, field_name, None)
    if not field:
        return
    path_str = _safe_file_path(field)
    if not path_str:
        return

    path = Path(path_str)
    if not path.is_file():
        return

    # Check if instance is an update (not newly created)
    if not created:
        old_image_names = getattr(instance, '_old_image_names', None)
        if old_image_names is not None:
            old_name = old_image_names.get(field_name)
            current_name = getattr(field, 'name', None)
            if old_name == current_name:
                # The image file was NOT replaced.
                # Check if WebP display variant and thumbnail already exist on disk.
                webp_path = path.with_suffix('.webp')
                thumb_path = path.parent / f"{path.stem}_thumb.webp"
                if webp_path.is_file() and thumb_path.is_file():
                    # Both variants already exist on disk and image didn't change.
                    # Skip variant generation completely (no thread spawned).
                    return

    logger.info(
        'Scheduling WebP variant generation for %s.%s: %s',
        instance.__class__.__name__, field_name, path_str,
    )
    _generate_variants_async(path_str)


# ── Generic pre_save tracker ──────────────────────────────────────────
@receiver(pre_save)
def track_image_changes_pre_save(sender, instance, **kwargs):
    """Record current on-disk image file names before save to detect real modifications."""
    sender_label = getattr(instance._meta, 'label', '')
    fields = MONITORED_IMAGE_FIELDS.get(sender_label)
    if not fields or not instance.pk:
        return
    try:
        old = sender.objects.filter(pk=instance.pk).values(*fields).first()
        if old:
            instance._old_image_names = old
    except Exception:
        pass


# ── Post-save Signal Handlers ─────────────────────────────────────────
@receiver(post_save, sender='publications.Book')
def book_post_save(sender, instance, created, **kwargs):
    _handle_image_field(instance, 'cover_image', created)


@receiver(post_save, sender='publications.Journal')
def journal_post_save(sender, instance, created, **kwargs):
    _handle_image_field(instance, 'cover_image', created)


@receiver(post_save, sender='publications.JournalIssue')
def journal_issue_post_save(sender, instance, created, **kwargs):
    _handle_image_field(instance, 'cover_image', created)


@receiver(post_save, sender='publications.ChapterAuthor')
def chapter_author_post_save(sender, instance, created, **kwargs):
    _handle_image_field(instance, 'photo', created)


@receiver(post_save, sender='submissions.PublishedVolume')
def published_volume_post_save(sender, instance, created, **kwargs):
    _handle_image_field(instance, 'cover_image', created)


@receiver(post_save, sender='slider.SliderImage')
def slider_image_post_save(sender, instance, created, **kwargs):
    _handle_image_field(instance, 'image', created)


@receiver(post_save, sender='conferences.Conference')
def conference_post_save(sender, instance, created, **kwargs):
    _handle_image_field(instance, 'cover_image', created)
    _handle_image_field(instance, 'banner_image', created)


@receiver(post_save, sender='publications.Testimonial')
def testimonial_post_save(sender, instance, created, **kwargs):
    _handle_image_field(instance, 'avatar', created)
