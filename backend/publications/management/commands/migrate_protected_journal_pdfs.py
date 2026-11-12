import os
import shutil
from django.core.management.base import BaseCommand
from django.conf import settings

class Command(BaseCommand):
    help = "Safely migrates existing journal PDF files from public MEDIA_ROOT to PROTECTED_MEDIA_ROOT."

    def handle(self, *args, **options):
        media_root = getattr(settings, 'MEDIA_ROOT')
        protected_root = getattr(settings, 'PROTECTED_MEDIA_ROOT', settings.BASE_DIR / 'protected_media')

        subdirs = [
            os.path.join('journals', 'digital'),
            os.path.join('journals', 'articles', 'pdf'),
        ]

        total_migrated = 0
        total_errors = 0

        for subdir in subdirs:
            src_dir = os.path.join(media_root, subdir)
            dst_dir = os.path.join(protected_root, subdir)

            if not os.path.exists(src_dir):
                self.stdout.write(f"Source directory does not exist: {src_dir}")
                continue

            os.makedirs(dst_dir, exist_ok=True)

            for filename in os.listdir(src_dir):
                src_path = os.path.join(src_dir, filename)
                if not os.path.isfile(src_path):
                    continue

                dst_path = os.path.join(dst_dir, filename)
                try:
                    # Copy file to protected storage
                    shutil.copy2(src_path, dst_path)

                    # Verify copy succeeded and sizes match
                    src_size = os.path.getsize(src_path)
                    dst_size = os.path.getsize(dst_path)

                    if src_size == dst_size:
                        os.remove(src_path)
                        total_migrated += 1
                        self.stdout.write(self.style.SUCCESS(f"Migrated & Secured: {subdir}/{filename}"))
                    else:
                        total_errors += 1
                        self.stderr.write(self.style.ERROR(f"Size mismatch for {filename}: {src_size} vs {dst_size}"))
                except Exception as e:
                    total_errors += 1
                    self.stderr.write(self.style.ERROR(f"Error migrating {filename}: {str(e)}"))

        self.stdout.write(self.style.SUCCESS(f"Protected PDF Migration Complete: {total_migrated} files migrated, {total_errors} errors."))
