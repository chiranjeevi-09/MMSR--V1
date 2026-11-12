"""Image upload validation, decompression-bomb protection, and optimization pipeline.

Phase 11C Implementation:
- Validates real image content (magic bytes + Pillow verify).
- Rejects dangerous / scriptable formats (SVG, TIFF, executables).
- Protects against decompression-bomb attacks via bounded MAX_IMAGE_PIXELS.
- Enforces strict pixel dimension ceilings (max 4000x4000).
- Preserves the original uploaded file verbatim as the recovery master.
- Automatically produces optimized WebP display variants and thumbnails on save.
- Cleans up temporary buffers and avoids redundant re-processing.
"""
import io
import os
import logging
from pathlib import Path
from PIL import Image, ImageOps

from django.core.files.base import ContentFile
from rest_framework import serializers

logger = logging.getLogger(__name__)

# Max pixel bounds: 25 megapixels (~5000x5000) prevents decompression bomb exhaustion
Image.MAX_IMAGE_PIXELS = 25_000_000

# Allowed raster image formats for public media
ALLOWED_IMAGE_FORMATS = {'JPEG', 'PNG', 'WEBP'}
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}

# Maximum permitted pixel dimensions for uploaded public images
MAX_DIMENSION_WIDTH = 4000
MAX_DIMENSION_HEIGHT = 4000
MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def validate_public_image_upload(file_obj, *, max_width=MAX_DIMENSION_WIDTH, max_height=MAX_DIMENSION_HEIGHT, max_size=MAX_IMAGE_FILE_SIZE):
    """Validate uploaded public image file for content integrity, size, and dimensions.

    Protects against:
    - SVGs (rejects XML-based SVG uploads to eliminate stored XSS)
    - Spoofed file extensions (executable disguised as .jpg)
    - Decompression bombs (excessive pixel counts)
    - Corrupted / truncated image files
    - Overly large pixel dimensions
    """
    if not file_obj:
        return file_obj

    # 1. File size check
    size = getattr(file_obj, 'size', 0)
    if size > max_size:
        actual_mb = size / (1024 * 1024)
        limit_mb = max_size / (1024 * 1024)
        raise serializers.ValidationError(
            f"Image file size ({actual_mb:.1f} MB) exceeds maximum limit of {limit_mb:.0f} MB."
        )

    # 2. File extension check & SVG rejection
    filename = getattr(file_obj, 'name', '') or ''
    ext = os.path.splitext(filename)[1].lower()
    if ext == '.svg':
        raise serializers.ValidationError(
            "SVG image uploads are not permitted for security reasons. Please upload JPEG, PNG, or WebP."
        )
    if ext not in ALLOWED_EXTENSIONS:
        allowed_str = ', '.join(sorted(ALLOWED_EXTENSIONS))
        raise serializers.ValidationError(
            f"Unsupported image extension. Allowed formats: {allowed_str}."
        )

    # 3. Content and format verification using Pillow
    pos = file_obj.tell() if hasattr(file_obj, 'tell') else 0
    try:
        # First pass: Pillow verify
        img = Image.open(file_obj)
        img_format = (img.format or '').upper()
        if img_format not in ALLOWED_IMAGE_FORMATS:
            raise serializers.ValidationError(
                f"Unsupported image format: {img_format}. Allowed: JPEG, PNG, WebP."
            )
        img.verify()

        # Reset pointer for second pass: read metadata/dimensions
        if hasattr(file_obj, 'seek'):
            file_obj.seek(pos)

        img_read = Image.open(file_obj)
        width, height = img_read.size

        if width > max_width or height > max_height:
            raise serializers.ValidationError(
                f"Image dimensions ({width}x{height}px) exceed maximum permitted ({max_width}x{max_height}px)."
            )

        if width < 10 or height < 10:
            raise serializers.ValidationError("Image dimensions are too small (minimum 10x10px required).")

    except (serializers.ValidationError, Image.DecompressionBombError) as e:
        if isinstance(e, Image.DecompressionBombError):
            raise serializers.ValidationError("Image pixel count is too large (decompression bomb protection).")
        raise
    except Exception as exc:
        logger.warning("Image verification failed for %s: %s", filename, exc)
        raise serializers.ValidationError("Uploaded file is not a valid or readable image.")
    finally:
        if hasattr(file_obj, 'seek'):
            file_obj.seek(pos)

    return file_obj


def generate_optimized_image_variants(file_path_on_disk, *, thumb_size=(320, 320), webp_quality=85):
    """Generate optimized WebP display variant and thumbnail for a saved public image.

    - Leaves original file untouched.
    - Creates '<path>.webp' (compressed WebP display version).
    - Creates '<path>_thumb.webp' (scaled-down thumbnail).
    - Preserves aspect ratio with high-quality resampling (Lanczos).
    """
    path = Path(file_path_on_disk)
    if not path.is_file():
        logger.warning("Cannot optimize image: file not found at %s", file_path_on_disk)
        return False

    base_stem = path.parent / path.stem

    try:
        with Image.open(path) as img:
            # Transpose according to EXIF orientation tag if present
            img = ImageOps.exif_transpose(img)

            # Convert RGBA/P to RGB for WebP if not transparency-preserving
            if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
                save_mode = 'RGBA'
            else:
                save_mode = 'RGB'

            converted = img.convert(save_mode)

            # 1. Full-size optimized WebP
            webp_path = path.with_suffix('.webp')
            if not webp_path.exists():
                converted.save(str(webp_path), 'WEBP', quality=webp_quality, method=6)
                logger.info("Generated WebP display variant: %s", webp_path.name)

            # 2. Thumbnail WebP
            thumb_path = path.parent / f"{path.stem}_thumb.webp"
            if not thumb_path.exists():
                thumb_img = converted.copy()
                thumb_img.thumbnail(thumb_size, Image.Resampling.LANCZOS)
                thumb_img.save(str(thumb_path), 'WEBP', quality=webp_quality, method=6)
                logger.info("Generated WebP thumbnail variant: %s", thumb_path.name)

        return True
    except Exception as exc:
        logger.error("Failed to generate optimized variants for %s: %s", file_path_on_disk, exc)
        return False



def get_variant_url(image_field, variant='webp', request=None):
    """Return URL of an image variant (webp or thumb) with fallback to original.

    :param image_field: the model ImageField / FieldFile instance.
    :param variant: 'webp' (display) or 'thumb' (thumbnail).
    :param request: optional request for building absolute URIs.
    :return: URL string or None.
    """
    if not image_field:
        return None
    try:
        orig_url = image_field.url
    except Exception:
        return None

    try:
        storage = image_field.storage
        orig_name = image_field.name
        if orig_name:
            base_stem, _ = os.path.splitext(orig_name)
            if variant == 'thumb':
                variant_name = f"{base_stem}_thumb.webp"
            else:
                variant_name = f"{base_stem}.webp"

            if storage.exists(variant_name):
                variant_url = storage.url(variant_name)
                if request:
                    return request.build_absolute_uri(variant_url)
                return variant_url
    except Exception:
        pass

    if request:
        try:
            return request.build_absolute_uri(orig_url)
        except Exception:
            pass
    return orig_url
