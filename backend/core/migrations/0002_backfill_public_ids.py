"""Phase 5 — backfill standardized public IDs onto every existing record.

Order of operations (spec §6):

1. The existing Super Admin is identified by the project's real role
   configuration (``is_superuser``/``is_staff`` — never a hardcoded email) and
   receives the permanently reserved ``MMSR-ADM-1931-000101``.
2. Remaining staff/admin accounts continue the ADM sequence from 000102.
3. Every other entity type is assigned independently, starting at 000101, in
   deterministic ascending-primary-key order (never arbitrary query order).
4. Rows that already carry a valid public ID are preserved; the sequence jumps
   past them so nothing collides.
5. The centralized counters are seeded to the next free value per prefix.

The migration writes through the historical model classes only (no runtime
model imports), touches nothing but the new ``public_id`` column and the new
``core`` tables, and is reversible: reverting clears the assigned IDs, removes
the ADM profiles and deletes the counter rows. No pre-existing column, PK,
foreign key or legacy reference (custom_order_id / reference_number) is
modified, so historical business references survive intact.
"""

import re

from django.db import migrations

ORG_PREFIX = 'MMSR'
FIXED_YEAR = '1931'
MIN_SEQUENCE = 101
MAX_SEQUENCE = 999999
PUBLIC_ID_RE = re.compile(r'^MMSR-([A-Z]{3})-1931-(\d{6})$')

# app label, model name, approved prefix (spec §3). AUT/INV/PAY are absent by
# design: this project has no independent Author, Invoice or Payment Record
# model (documented in the completion report).
ENTITY_MODELS = [
    ('users', 'User', 'USR'),
    ('users', 'AdminInvitation', 'AIN'),
    ('users', 'AdminAuditEvent', 'AUD'),
    ('publications', 'Category', 'CAT'),
    ('publications', 'Book', 'BOK'),
    ('publications', 'Journal', 'JRN'),
    ('publications', 'JournalIssue', 'ISS'),
    ('publications', 'JournalArticle', 'ART'),
    ('publications', 'UserJournalAccess', 'JAC'),
    ('publications', 'ChapterAuthor', 'CAU'),
    ('publications', 'BookChapter', 'CHP'),
    ('publications', 'ChapterSection', 'SEC'),
    ('publications', 'Testimonial', 'TST'),
    ('publications', 'UniversityPartner', 'UNI'),
    ('publications', 'SiteMetrics', 'MET'),
    ('slider', 'SliderImage', 'SLD'),
    ('publications', 'NewsletterSubscriber', 'NLS'),
    ('publications', 'NewsletterBroadcast', 'NLB'),
    ('publications', 'ContactInquiry', 'ENQ'),
    ('orders', 'Order', 'ORD'),
    ('orders', 'OrderItem', 'ORI'),
    ('submissions', 'Submission', 'SUB'),
    ('submissions', 'PublishedVolume', 'VOL'),
    ('conferences', 'Conference', 'CON'),
    ('conferences', 'ConferenceSubmission', 'CPS'),
    ('conferences', 'ConferenceSubmissionAuthor', 'CSA'),
    ('policies', 'Policy', 'POL'),
    ('policies', 'PolicyVersion', 'PLV'),
    ('policies', 'PolicyAcceptance', 'PLA'),
]


def render(prefix, sequence):
    if sequence < MIN_SEQUENCE or sequence > MAX_SEQUENCE:
        raise RuntimeError(
            f'Refusing to render {prefix} sequence {sequence}: outside the '
            f'approved {MIN_SEQUENCE:06d}-{MAX_SEQUENCE:06d} range.'
        )
    return f'{ORG_PREFIX}-{prefix}-{FIXED_YEAR}-{sequence:06d}'


def sequence_of(public_id):
    match = PUBLIC_ID_RE.match(public_id or '')
    return int(match.group(2)) if match else None


def assign_missing(apps, model_label, prefix, queryset):
    """Give every row without a valid ID the next sequence value.

    Returns the highest sequence used (0 when nothing was assigned), so the
    caller can seed the counter. Ascending PK ordering is explicit: no
    arbitrary database ordering is relied upon.
    """
    model = apps.get_model(*model_label)
    sequence = MIN_SEQUENCE
    highest = 0
    for obj in queryset.order_by('pk').iterator():
        existing = sequence_of(obj.public_id)
        if existing:
            # Preserve an already-valid ID (spec §6.9) and move past it.
            sequence = max(sequence, existing + 1)
            highest = max(highest, existing)
            continue
        public_id = render(prefix, sequence)
        model.objects.filter(pk=obj.pk).update(public_id=public_id)
        highest = sequence
        sequence += 1
    return highest


def seed_counter(apps, prefix, highest_used, verbosity):
    Counter = apps.get_model('core', 'PublicIDCounter')
    next_value = (highest_used + 1) if highest_used else MIN_SEQUENCE
    Counter.objects.filter(pk=prefix).update(next_sequence=next_value)
    if not Counter.objects.filter(pk=prefix).exists():
        Counter.objects.create(pk=prefix, next_sequence=next_value)
    if verbosity >= 1:
        verbosity_note = f'{prefix}: next sequence {next_value:06d}'
        print(f'    counter {verbosity_note}')


def backfill_public_ids(apps, schema_editor):
    verbosity = getattr(schema_editor, 'verbosity', 0)
    User = apps.get_model('users', 'User')
    AdminProfile = apps.get_model('core', 'AdminProfile')

    # ── 1–2. Admin identifiers: Super Admin first, permanently reserved ──
    # Role detection uses the real flags the project enforces (see
    # users.User / UserManager.create_superuser and ADMIN_ROLE_CHOICES).
    superusers = list(User.objects.filter(is_superuser=True).order_by('pk'))
    staff = list(User.objects.filter(is_staff=True, is_superuser=False).order_by('pk'))
    admin_count = 0
    for user in superusers + staff:
        admin_count += 1
        seq = MIN_SEQUENCE + (admin_count - 1)   # 000101, 000102, 000103 …
        public_id = render('ADM', seq)
        profile = AdminProfile.objects.filter(user_id=user.pk).first()
        if profile:
            if not sequence_of(profile.public_id):
                AdminProfile.objects.filter(pk=profile.pk).update(public_id=public_id)
            continue
        AdminProfile.objects.create(user_id=user.pk, public_id=public_id)
        if verbosity >= 1:
            print(f'    ADM {public_id} → user pk {user.pk} '
                  f'(superuser={user.is_superuser})')
    # Read the highest assigned ADM value back from the table, so a pre-existing
    # profile (or a preserved ID) can never be handed out again.
    assigned_adm = [
        sequence_of(pid) or 0
        for pid in AdminProfile.objects.values_list('public_id', flat=True)
    ]
    highest_adm = max(assigned_adm) if assigned_adm else 0

    # ── 3–4. Every other entity type ──
    counters = {'ADM': highest_adm}
    for app_label, model_name, prefix in ENTITY_MODELS:
        model = apps.get_model(app_label, model_name)
        highest = assign_missing(apps, (app_label, model_name), prefix,
                                 model.objects.all())
        counters[prefix] = max(counters.get(prefix, 0), highest)
        if verbosity >= 1 and highest:
            print(f'    {prefix}: {model.objects.count()} row(s), '
                  f'last sequence {highest:06d}')

    # ── 5. Counters to the next free value ──
    for prefix in counters:
        seed_counter(apps, prefix, counters[prefix], verbosity)


def clear_public_ids(apps, schema_editor):
    """Undo this migration: drop assigned IDs, profiles and counters."""
    AdminProfile = apps.get_model('core', 'AdminProfile')
    AdminProfile.objects.all().delete()
    for app_label, model_name, _prefix in ENTITY_MODELS:
        model = apps.get_model(app_label, model_name)
        model.objects.filter(public_id__isnull=False).update(public_id=None)
    apps.get_model('core', 'PublicIDCounter').objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
        ('users', '0008_public_id_fields'),
        ('publications', '0024_book_public_id_bookchapter_public_id_and_more'),
        ('orders', '0014_order_public_id_orderitem_public_id'),
        ('submissions', '0011_publishedvolume_public_id_submission_public_id'),
        ('slider', '0003_sliderimage_public_id'),
        ('conferences', '0004_conference_public_id_conferencesubmission_public_id_and_more'),
        ('policies', '0002_policy_public_id_policyacceptance_public_id_and_more'),
    ]

    operations = [
        migrations.RunPython(backfill_public_ids, clear_public_ids),
    ]
