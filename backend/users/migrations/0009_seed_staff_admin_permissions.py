"""SECURITY-QA-REPORT L-2 — write down the CMS grants that were implied.

``AdminSectionAccessMiddleware`` used to treat any section *missing* from
``User.admin_permissions`` as "no override ⇒ full staff access", so a staff
account created through the Django admin (which never seeded the map) could
read and write every section of the CMS. The middleware now defaults to deny,
and that only stays non-breaking if every existing account has an explicit,
complete grant map.

This migration converts the old implicit ``edit`` into a recorded one: keys that
are absent get ``"edit"`` (exactly what the account could do before), keys that
are already present are left untouched. Deliberately forward-only — the previous
state was "nothing stored", which carries no information to restore.
"""
from django.db import migrations

# Copy of users.roles.ALL_SECTION_KEYS. Migrations must not import application
# code, so the list is duplicated here on purpose; the test
# ``SeedAdminPermissionsTests.test_migration_covers_every_section`` fails if the
# two ever drift apart.
SECTION_KEYS = (
    'users', 'books', 'journals', 'submissions', 'conferences', 'orders',
    'categories', 'testimonials', 'enquiries', 'subscribers', 'hero_slider',
    'site_content', 'policies',
)


def seed_explicit_grants(apps, schema_editor):
    User = apps.get_model('users', 'User')
    for user in User.objects.filter(is_staff=True, is_superuser=False):
        grants = dict(user.admin_permissions or {})
        if all(key in grants for key in SECTION_KEYS):
            continue
        for key in SECTION_KEYS:
            grants.setdefault(key, 'edit')
        user.admin_permissions = grants
        user.save(update_fields=['admin_permissions'])


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0008_public_id_fields'),
    ]

    operations = [
        migrations.RunPython(seed_explicit_grants, migrations.RunPython.noop),
    ]
