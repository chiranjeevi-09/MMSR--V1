from django.core.management.base import BaseCommand
from django.utils import timezone

from policies.models import Policy, PolicyVersion
from policies.seed_content import SEED_POLICIES


class Command(BaseCommand):
    help = (
        "Seed the three canonical MMSR policies (Terms, Privacy, Publication Policies "
        "and Ethics) as version 1.0 drafts. Idempotent: never duplicates policies or "
        "overwrites existing content. Use --publish to also publish the newly created "
        "initial versions (only appropriate once the content and placeholders are "
        "confirmed)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--publish',
            action='store_true',
            help='Publish the initial version when it is created (default: leave as draft).',
        )

    def handle(self, *args, **options):
        do_publish = options['publish']
        created_any = False

        for policy_type, title, content in SEED_POLICIES:
            policy, policy_created = Policy.objects.get_or_create(
                policy_type=policy_type,
                defaults={'title': title},
            )
            if policy_created:
                self.stdout.write(self.style.SUCCESS(f"Created policy: {title}"))

            has_versions = policy.versions.exists()
            if has_versions:
                self.stdout.write(f"  Skipped versioning for {title}: versions already exist.")
                continue

            version = PolicyVersion.objects.create(
                policy=policy,
                version='1.0',
                title=title,
                content=content,
                status='draft',
                effective_date=timezone.now().date(),
                change_summary='Initial seeded replacement content.',
            )
            created_any = True
            self.stdout.write(f"  Seeded draft version 1.0 for {title}.")

            if do_publish:
                version.status = 'published'
                version.published_at = timezone.now()
                version.save()
                self.stdout.write(self.style.SUCCESS(f"  Published version 1.0 for {title}."))
            else:
                self.stdout.write(
                    f"  Left as draft. Review/complete placeholders, then publish from the "
                    f"admin or re-run with --publish."
                )

        if created_any:
            self.stdout.write(self.style.SUCCESS("Policy seeding complete."))
        else:
            self.stdout.write("No new policy versions were created (already seeded).")
