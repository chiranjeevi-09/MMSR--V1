"""Unit tests for Phase 11C: Public Image Upload Validation and Optimization."""
import io
import os
import tempfile
from pathlib import Path
from PIL import Image

from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import serializers

from core.image_processing import (
    validate_public_image_upload,
    generate_optimized_image_variants,
    ALLOWED_IMAGE_FORMATS
)


class PublicImageProcessingTests(TestCase):
    """Test image validation, format restrictions, dimension ceilings, and variants."""

    def _create_image_buffer(self, format='JPEG', size=(200, 200), color=(184, 134, 11)):
        buf = io.BytesIO()
        img = Image.new('RGB', size, color=color)
        img.save(buf, format=format)
        buf.seek(0)
        return buf

    def test_valid_jpeg_upload(self):
        """Standard valid JPEG upload passes validation."""
        buf = self._create_image_buffer('JPEG', (400, 400))
        uploaded = SimpleUploadedFile('cover.jpg', buf.getvalue(), content_type='image/jpeg')
        result = validate_public_image_upload(uploaded)
        self.assertIsNotNone(result)

    def test_valid_png_and_webp_upload(self):
        """PNG and WebP uploads pass validation."""
        buf_png = self._create_image_buffer('PNG', (300, 300))
        uploaded_png = SimpleUploadedFile('avatar.png', buf_png.getvalue(), content_type='image/png')
        self.assertIsNotNone(validate_public_image_upload(uploaded_png))

        buf_webp = self._create_image_buffer('WEBP', (500, 500))
        uploaded_webp = SimpleUploadedFile('banner.webp', buf_webp.getvalue(), content_type='image/webp')
        self.assertIsNotNone(validate_public_image_upload(uploaded_webp))

    def test_svg_upload_rejected(self):
        """SVG files are explicitly rejected to eliminate stored XSS risks."""
        svg_content = b'<svg><script>alert("xss")</script></svg>'
        uploaded = SimpleUploadedFile('malicious.svg', svg_content, content_type='image/svg+xml')
        with self.assertRaises(serializers.ValidationError) as ctx:
            validate_public_image_upload(uploaded)
        self.assertIn('SVG image uploads are not permitted', str(ctx.exception))

    def test_spoofed_file_rejected(self):
        """Non-image file with .jpg extension is rejected by Pillow verify."""
        fake_content = b'MZ\x90\x00\x03\x00\x00\x00executable content'
        uploaded = SimpleUploadedFile('malware.jpg', fake_content, content_type='image/jpeg')
        with self.assertRaises(serializers.ValidationError) as ctx:
            validate_public_image_upload(uploaded)
        self.assertIn('not a valid or readable image', str(ctx.exception))

    def test_excessive_dimensions_rejected(self):
        """Images exceeding 4000x4000 are rejected."""
        buf = self._create_image_buffer('JPEG', (4500, 100))
        uploaded = SimpleUploadedFile('huge_width.jpg', buf.getvalue(), content_type='image/jpeg')
        with self.assertRaises(serializers.ValidationError) as ctx:
            validate_public_image_upload(uploaded)
        self.assertIn('exceed maximum permitted', str(ctx.exception))

    def test_generate_optimized_variants_preserves_original(self):
        """Optimized variants (WebP + thumbnail) are generated without altering the original."""
        with tempfile.TemporaryDirectory() as temp_dir:
            orig_path = Path(temp_dir) / 'book_cover.jpg'
            buf = self._create_image_buffer('JPEG', (800, 1200))
            orig_path.write_bytes(buf.getvalue())
            initial_bytes = orig_path.read_bytes()

            # Run optimization
            success = generate_optimized_image_variants(str(orig_path), thumb_size=(200, 300))
            self.assertTrue(success)

            # 1. Original file is preserved verbatim
            self.assertEqual(orig_path.read_bytes(), initial_bytes)

            # 2. WebP variant exists
            webp_path = orig_path.with_suffix('.webp')
            self.assertTrue(webp_path.exists())
            with Image.open(webp_path) as w_img:
                self.assertEqual(w_img.format, 'WEBP')
                self.assertEqual(w_img.size, (800, 1200))

            # 3. WebP thumbnail exists with correct bounded size
            thumb_path = orig_path.parent / f"{orig_path.stem}_thumb.webp"
            self.assertTrue(thumb_path.exists())
            with Image.open(thumb_path) as t_img:
                self.assertEqual(t_img.format, 'WEBP')
                self.assertLessEqual(t_img.size[0], 200)
                self.assertLessEqual(t_img.size[1], 300)

