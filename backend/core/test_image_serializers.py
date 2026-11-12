"""Integration tests for serializer-level image validation and WebP variant generation."""
import io
from PIL import Image
from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.exceptions import ValidationError

from publications.serializers import BookSerializer, JournalSerializer, JournalIssueSerializer
from slider.serializers import SliderImageSerializer
from conferences.serializers import ConferenceSerializer
from core.image_processing import validate_public_image_upload, get_variant_url


def create_test_image(format='JPEG', size=(100, 100), color=(255, 0, 0)):
    buf = io.BytesIO()
    img = Image.new('RGB', size, color=color)
    img.save(buf, format=format)
    buf.seek(0)
    ext = 'jpg' if format == 'JPEG' else format.lower()
    return SimpleUploadedFile(f'test.{ext}', buf.read(), content_type=f'image/{ext}')


class SerializerImageValidationTests(TestCase):
    def test_book_serializer_rejects_svg(self):
        svg_file = SimpleUploadedFile('malicious.svg', b'<svg><script>alert(1)</script></svg>', content_type='image/svg+xml')
        serializer = BookSerializer()
        with self.assertRaises(ValidationError) as ctx:
            serializer.validate_cover_image(svg_file)
        self.assertIn('SVG image uploads are not permitted', str(ctx.exception))

    def test_book_serializer_rejects_corrupt_image(self):
        corrupt_file = SimpleUploadedFile('corrupt.jpg', b'not a real jpeg content header', content_type='image/jpeg')
        serializer = BookSerializer()
        with self.assertRaises(ValidationError) as ctx:
            serializer.validate_cover_image(corrupt_file)
        self.assertIn('not a valid or readable image', str(ctx.exception))

    def test_book_serializer_accepts_valid_jpeg(self):
        valid_img = create_test_image(format='JPEG', size=(200, 200))
        serializer = BookSerializer()
        validated = serializer.validate_cover_image(valid_img)
        self.assertEqual(validated, valid_img)

    def test_journal_serializer_rejects_svg(self):
        svg_file = SimpleUploadedFile('logo.svg', b'<svg></svg>', content_type='image/svg+xml')
        serializer = JournalSerializer()
        with self.assertRaises(ValidationError):
            serializer.validate_cover_image(svg_file)

    def test_slider_serializer_rejects_svg(self):
        svg_file = SimpleUploadedFile('slide.svg', b'<svg></svg>', content_type='image/svg+xml')
        serializer = SliderImageSerializer()
        with self.assertRaises(ValidationError):
            serializer.validate_image(svg_file)

    def test_conference_serializer_rejects_oversized_dimensions(self):
        huge_img = create_test_image(format='JPEG', size=(4500, 100))
        serializer = ConferenceSerializer()
        with self.assertRaises(ValidationError) as ctx:
            serializer.validate_cover_image(huge_img)
        self.assertIn('exceed maximum permitted', str(ctx.exception))

    def test_get_variant_url_fallback(self):
        """When variant does not exist on disk, get_variant_url falls back to original."""
        class MockField:
            name = 'books/covers/test.jpg'
            url = '/media/books/covers/test.jpg'
            class storage:
                @staticmethod
                def exists(path):
                    return False
        mock_field = MockField()
        url = get_variant_url(mock_field, variant='webp')
        self.assertEqual(url, '/media/books/covers/test.jpg')

from unittest.mock import patch, MagicMock
from publications.serializers import ChapterAuthorSerializer
from submissions.serializers import PublishedVolumeSerializer
from publications.models import Book, Category, ChapterAuthor
from core.image_signals import _handle_image_field, track_image_changes_pre_save


class ExtendedImageSerializerAndSignalTests(TestCase):
    def test_chapter_author_photo_validation(self):
        """ChapterAuthorSerializer validate_photo rejects SVG and accepts valid image."""
        svg_file = SimpleUploadedFile('hacker.svg', b'<svg><script>alert(1)</script></svg>', content_type='image/svg+xml')
        serializer = ChapterAuthorSerializer()
        with self.assertRaises(ValidationError) as ctx:
            serializer.validate_photo(svg_file)
        self.assertIn('SVG image uploads are not permitted', str(ctx.exception))

        valid_img = create_test_image(format='PNG', size=(150, 150))
        validated = serializer.validate_photo(valid_img)
        self.assertEqual(validated, valid_img)

    def test_published_volume_cover_image_validation(self):
        """PublishedVolumeSerializer validate_cover_image rejects SVG and accepts valid image."""
        svg_file = SimpleUploadedFile('hacker.svg', b'<svg></svg>', content_type='image/svg+xml')
        serializer = PublishedVolumeSerializer()
        with self.assertRaises(ValidationError) as ctx:
            serializer.validate_cover_image(svg_file)
        self.assertIn('SVG image uploads are not permitted', str(ctx.exception))

        valid_img = create_test_image(format='JPEG', size=(250, 250))
        validated = serializer.validate_cover_image(valid_img)
        self.assertEqual(validated, valid_img)

    def test_get_variant_url_when_variant_exists(self):
        """When variant exists in storage, get_variant_url returns the variant URL."""
        class MockStorage:
            @staticmethod
            def exists(path):
                return path == 'books/covers/test.webp'
            @staticmethod
            def url(path):
                return f'/media/{path}'

        class MockField:
            name = 'books/covers/test.jpg'
            url = '/media/books/covers/test.jpg'
            storage = MockStorage()

        mock_field = MockField()
        url = get_variant_url(mock_field, variant='webp')
        self.assertEqual(url, '/media/books/covers/test.webp')

    @patch('core.image_signals._generate_variants_async')
    def test_signal_lifecycle_skips_when_image_unchanged_and_variants_exist(self, mock_async):
        """Unrelated save on existing instance does not spawn variant generation if variants exist."""
        import tempfile
        from pathlib import Path
        from unittest.mock import MagicMock

        with tempfile.TemporaryDirectory() as tmpdir:
            img_path = Path(tmpdir) / 'test.jpg'
            img_path.write_bytes(b'fake-image-bytes')
            webp_path = Path(tmpdir) / 'test.webp'
            webp_path.write_bytes(b'fake-webp-bytes')
            thumb_path = Path(tmpdir) / 'test_thumb.webp'
            thumb_path.write_bytes(b'fake-thumb-bytes')

            mock_field = MagicMock()
            mock_field.path = str(img_path)
            mock_field.name = 'covers/test.jpg'

            instance = MagicMock()
            instance.cover_image = mock_field
            instance._old_image_names = {'cover_image': 'covers/test.jpg'}

            # created=False: existing instance save
            _handle_image_field(instance, 'cover_image', created=False)
            mock_async.assert_not_called()

    @patch('core.image_signals._generate_variants_async')
    def test_signal_lifecycle_triggers_on_new_image(self, mock_async):
        """Instance created with image triggers variant generation."""
        import tempfile
        from pathlib import Path
        from unittest.mock import MagicMock

        with tempfile.TemporaryDirectory() as tmpdir:
            img_path = Path(tmpdir) / 'new.jpg'
            img_path.write_bytes(b'fake-image-bytes')

            mock_field = MagicMock()
            mock_field.path = str(img_path)
            mock_field.name = 'covers/new.jpg'

            instance = MagicMock()
            instance.cover_image = mock_field

            # created=True: new upload
            _handle_image_field(instance, 'cover_image', created=True)
            mock_async.assert_called_once_with(str(img_path))
