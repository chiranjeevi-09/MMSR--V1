"""Move customer documents out of the publicly served media tree.

SECURITY-QA-REPORT C-1 / L-8: customer PDFs (invoices, author certificates,
unpublished manuscripts) sat inside ``MEDIA_ROOT``, the directory that
``DEPLOYMENT.md`` tells an operator to alias as ``/media/`` in nginx. The
storage migrations relocated the files every database row still referenced;
this command deals with what is left behind — documents whose row was deleted,
plus anything a stale upload or a half-finished migration left in the public
tree.

Behaviour is deliberately fail-closed: a file is kept in ``MEDIA_ROOT`` only
when its prefix is on the public allow-list (cover art, samples, slider images,
avatars). Everything else is moved to ``PROTECTED_MEDIA_ROOT`` under the *same*
relative path, so a row whose ``FileField`` was already switched to
``protected_storage`` starts resolving the file again instead of 404-ing.

Usage::

    python manage.py quarantine_public_media --dry-run
    python manage.py quarantine_public_media
    python manage.py quarantine_public_media --check   # exit 1 if leftovers
"""
import shutil
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from core.dev_media import DEFAULT_PUBLIC_MEDIA_PREFIXES


class Command(BaseCommand):
    help = (
        'Relocate any file in MEDIA_ROOT that is not an allow-listed public '
        'marketing asset into PROTECTED_MEDIA_ROOT (served only by authorised views).'
    )

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true',
                            help='List what would move without touching the filesystem.')
        parser.add_argument('--check', action='store_true',
                            help='Exit with status 1 when anything is left in the public tree.')

    def _public_prefixes(self):
        return tuple(getattr(settings, 'PUBLIC_MEDIA_PREFIXES', DEFAULT_PUBLIC_MEDIA_PREFIXES))

    def _is_public(self, rel_posix, prefixes):
        return any(rel_posix.startswith(prefix) for prefix in prefixes)

    def handle(self, *args, **options):
        media_root = Path(str(settings.MEDIA_ROOT)).resolve()
        protected_root = Path(str(settings.PROTECTED_MEDIA_ROOT)).resolve()
        prefixes = self._public_prefixes()

        if not media_root.is_dir():
            self.stdout.write(self.style.WARNING(f'MEDIA_ROOT does not exist: {media_root}'))
            return

        candidates, collisions = [], []
        for path in sorted(media_root.rglob('*')):
            if not path.is_file():
                continue
            rel = path.relative_to(media_root).as_posix()
            if self._is_public(rel, prefixes):
                continue
            destination = protected_root / rel
            if destination.exists():
                collisions.append((rel, destination))
                continue
            candidates.append((path, destination))

        if options['check']:
            if candidates or collisions:
                self.stdout.write(self.style.ERROR(
                    f'{len(candidates)} file(s) still sit in the public media tree'
                    + (f', {len(collisions)} collide with protected copies' if collisions else '')
                    + '. Run `manage.py quarantine_public_media`.'
                ))
                raise SystemExit(1)
            self.stdout.write(self.style.SUCCESS('No non-public files remain in MEDIA_ROOT.'))
            return

        if options['dry_run']:
            self.stdout.write(f'DRY RUN — {len(candidates)} file(s) would move to {protected_root}:')
            for source, destination in candidates:
                self.stdout.write(f'  {source.relative_to(media_root).as_posix()}')
            for rel, destination in collisions:
                self.stdout.write(
                    self.style.WARNING(f'  SKIP (already protected): {rel} -> {destination}')
                )
            return

        moved = 0
        failures = []
        for source, destination in candidates:
            try:
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(source), str(destination))
                moved += 1
            except OSError as exc:
                failures.append(f'{source}: {exc}')

        self.stdout.write(self.style.SUCCESS(
            f'Moved {moved} file(s) from the public media tree into protected storage.'
        ))
        if collisions:
            self.stdout.write(self.style.WARNING(
                f'Left {len(collisions)} file(s) in place because a protected copy already exists:'
            ))
            for rel, _ in collisions[:20]:
                self.stdout.write(f'  {rel}')
        for failure in failures:
            self.stdout.write(self.style.ERROR(f'FAILED to move {failure}'))
        if failures:
            raise SystemExit(1)
