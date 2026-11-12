"""Phase 5 — Global Public ID Standardization test suite (spec §12).

Covers the mandated categories:
  * generation          — format rules, per-prefix sequences, overflow, corruption
  * concurrency safety  — the UNIQUE-collision re-allocation belt
  * migration behaviour — deterministic ascending-PK backfill ordering
  * API lookup          — PublicIDLookupMixin / helper resolution + 404 semantics
  * payment regression  — orders keep Razorpay + legacy references untouched while
                          carrying a standardized MMSR-ORD id

These run on the same database the rest of the suite uses. On SQLite the row
lock in ``allocate_next`` is a no-op and writes serialize at the DB level; the
tests therefore assert the guarantees that hold on every engine (uniqueness,
baseline, immutability, overflow) rather than thread interleavings the dev
engine cannot exercise. PostgreSQL staging/production adds the real row lock.
"""

from importlib import import_module

from django.apps import apps as global_apps
from django.core.exceptions import ImproperlyConfigured, ValidationError
from django.test import TestCase
from rest_framework.test import APIClient

from core.models import (
    MAX_SEQUENCE,
    MIN_SEQUENCE,
    PublicIDCounter,
    PublicIDOverflow,
    format_public_id,
)
from core.services import allocate_next, ensure_admin_profile, is_public_id_conflict
from core.api import find_by_public_id, is_valid_public_id
from publications.models import Category, Journal
from orders.models import Order
from users.models import User

# Deterministic-ordering helper used by the backfill data migration. The module
# name starts with a digit, so it can only be loaded through import machinery.
backfill = import_module('core.migrations.0002_backfill_public_ids')


class PublicIDFormatTests(TestCase):
    """§1: exact ``MMSR-XXX-1931-NNNNNN`` rendering + validation guards."""

    def test_renders_approved_format(self):
        self.assertEqual(format_public_id('ORD', 101), 'MMSR-ORD-1931-000101')
        self.assertEqual(format_public_id('USR', 123456), 'MMSR-USR-1931-123456')

    def test_year_is_fixed_not_calendar(self):
        # 1931 is a constant, never derived from the clock (spec §1).
        self.assertTrue(format_public_id('BOK', 101).split('-')[2] == '1931')

    def test_rejects_unapproved_prefix(self):
        with self.assertRaises(ValueError):
            format_public_id('ZZZ', 101)
        # Documented-inactive prefixes must never be handed out.
        for prefix in ('AUT', 'INV', 'PAY'):
            with self.assertRaises(ValueError):
                format_public_id(prefix, 101)

    def test_rejects_below_baseline(self):
        with self.assertRaises(ValueError):
            format_public_id('CAT', MIN_SEQUENCE - 1)

    def test_raises_overflow_past_six_digits(self):
        with self.assertRaises(PublicIDOverflow):
            format_public_id('CAT', MAX_SEQUENCE + 1)


class AllocateNextTests(TestCase):
    """§5: one allocation path, per-prefix sequence starting at 000101."""

    def setUp(self):
        # CAT is seeded by the migration on an empty DB; force a clean baseline
        # so assertions on the first value are independent of migration output.
        PublicIDCounter.objects.filter(pk='CAT').delete()

    def test_fresh_prefix_starts_at_baseline(self):
        self.assertEqual(allocate_next('CAT'), 'MMSR-CAT-1931-000101')

    def test_sequence_increments_monotonically(self):
        first = allocate_next('CAT')
        second = allocate_next('CAT')
        self.assertEqual(first, 'MMSR-CAT-1931-000101')
        self.assertEqual(second, 'MMSR-CAT-1931-000102')
        counter = PublicIDCounter.objects.get(pk='CAT')
        self.assertEqual(counter.next_sequence, 103)

    def test_counters_are_independent_per_prefix(self):
        PublicIDCounter.objects.filter(pk='BOK').delete()
        self.assertEqual(allocate_next('CAT'), 'MMSR-CAT-1931-000101')
        self.assertEqual(allocate_next('BOK'), 'MMSR-BOK-1931-000101')

    def test_unapproved_prefix_rejected(self):
        with self.assertRaises(ValueError):
            allocate_next('ZZZ')

    def test_corrupted_counter_below_baseline_is_refused(self):
        PublicIDCounter.objects.update_or_create(
            pk='CAT', defaults={'next_sequence': MIN_SEQUENCE - 1})
        with self.assertRaises(ValueError):
            allocate_next('CAT')

    def test_overflow_raises_instead_of_emitting_invalid_id(self):
        PublicIDCounter.objects.update_or_create(
            pk='CAT', defaults={'next_sequence': MAX_SEQUENCE + 1})
        with self.assertRaises(PublicIDOverflow):
            allocate_next('CAT')


class TrackableModelTests(TestCase):
    """§1/§5: model-level auto-assignment, immutability and the collision belt."""

    def _cat(self, name):
        return Category.objects.create(name=name, category_type='journal')

    def test_create_auto_assigns_sequential_public_ids(self):
        a = self._cat('Alpha')
        b = self._cat('Beta')
        self.assertIsNotNone(a.public_id)
        self.assertTrue(is_valid_public_id(a.public_id))
        self.assertNotEqual(a.public_id, b.public_id)

    def test_missing_prefix_config_is_rejected(self):
        # A tracked instance with no configured entity prefix must fail loudly
        # rather than fabricate an ID (spec §5 requirement 14).
        unsaved = Category(name='Bad one', category_type='journal')
        unsaved.public_id = None
        unsaved.public_id_prefix = None
        with self.assertRaises(ImproperlyConfigured):
            unsaved.save()

    def test_public_id_is_immutable_after_assignment(self):
        a = self._cat('Immutable')
        original = a.public_id
        a.public_id = 'MMSR-CAT-1931-999999'
        with self.assertRaises(ValidationError):
            a.save()
        # A no-op re-save keeps the original value.
        a.refresh_from_db()
        self.assertEqual(a.public_id, original)

    def test_unique_collision_is_re_allocated(self):
        """Forcing a duplicate hand-out must retry, never crash or persist a dup.

        We create one row (000101), then rewind the counter so the next
        allocation returns the same value. ``save()`` must catch the resulting
        UNIQUE clash and re-allocate a fresh, higher value (§5 closing belt).
        """
        a = self._cat('Taken')
        taken = a.public_id
        PublicIDCounter.objects.filter(pk='CAT').update(next_sequence=MIN_SEQUENCE)

        b = self._cat('Colliding')

        self.assertNotEqual(b.public_id, taken)
        self.assertTrue(is_valid_public_id(b.public_id))
        # Second row must be strictly greater than the collision it avoided.
        self.assertGreater(int(b.public_id[-6:]), int(taken[-6:]))

    def test_is_public_id_conflict_matches_only_public_id(self):
        class _E(Exception):
            pass

        self.assertTrue(is_public_id_conflict(
            _E('UNIQUE constraint failed: publications_category.public_id')))
        self.assertTrue(is_public_id_conflict(
            _E('duplicate key value violates unique constraint "pub_public_id_key"')))
        # A PK / unrelated integrity error must NOT be retried away.
        self.assertFalse(is_public_id_conflict(
            _E('UNIQUE constraint failed: orders_order.id')))
        self.assertFalse(is_public_id_conflict(_E('NOT NULL constraint failed')))


class MigrationBackfillTests(TestCase):
    """§6: the backfill assigns in deterministic ascending-primary-key order."""

    def test_assign_missing_orders_by_ascending_pk(self):
        created = [self._cat(n) for n in ('First', 'Second', 'Third')]
        # Simulate legacy rows that pre-date standardization: strip IDs and the
        # counter, exactly what the migration must reconcile.
        Category.objects.all().update(public_id=None)
        PublicIDCounter.objects.filter(pk='CAT').delete()

        highest = backfill.assign_missing(
            global_apps, ('publications', 'Category'), 'CAT',
            Category.objects.all(),
        )

        ordered = list(Category.objects.order_by('pk'))
        for offset, cat in enumerate(ordered):
            self.assertEqual(cat.public_id, f'MMSR-CAT-1931-{MIN_SEQUENCE + offset:06d}')
        self.assertEqual(highest, MIN_SEQUENCE + len(ordered) - 1)

    def test_assign_missing_preserves_existing_and_jumps_past_them(self):
        kept = self._cat('Kept')            # auto-assigned 000101
        kept_id = kept.public_id
        other = self._cat('Other')          # auto-assigned 000102
        # Make 'Other' look like a legacy unassigned row; 'Kept' keeps its ID.
        Category.objects.filter(pk=other.pk).update(public_id=None)

        backfill.assign_missing(
            global_apps, ('publications', 'Category'), 'CAT',
            Category.objects.all(),
        )

        kept.refresh_from_db()
        self.assertEqual(kept.public_id, kept_id)          # never overwritten
        other.refresh_from_db()
        self.assertTrue(is_valid_public_id(other.public_id))
        # The reassigned row must jump past the preserved neighbour.
        self.assertGreater(int(other.public_id[-6:]), int(kept_id[-6:]))

    def test_migration_render_matches_service_format(self):
        self.assertEqual(backfill.render('CAT', 101), format_public_id('CAT', 101))
        with self.assertRaises(RuntimeError):
            backfill.render('CAT', MIN_SEQUENCE - 1)

    def _cat(self, name):
        return Category.objects.create(name=name, category_type='journal')


class AdminProfileTests(TestCase):
    """§2: admin identity lives on a profile of the existing account."""

    def test_staff_gets_adm_profile_on_demand(self):
        staff = User.objects.create(email='adm1@test.local', is_staff=True)
        profile = ensure_admin_profile(staff)
        self.assertTrue(is_valid_public_id(profile.public_id))
        self.assertTrue(profile.public_id.startswith('MMSR-ADM-1931-'))

    def test_two_admins_get_distinct_adm_ids(self):
        u1 = User.objects.create(email='adm2@test.local', is_staff=True)
        u2 = User.objects.create(email='adm3@test.local', is_staff=True)
        p1 = ensure_admin_profile(u1)
        p2 = ensure_admin_profile(u2)
        self.assertNotEqual(p1.public_id, p2.public_id)

    def test_profile_is_idempotent(self):
        u = User.objects.create(email='adm4@test.local', is_staff=True)
        first = ensure_admin_profile(u).public_id
        again = ensure_admin_profile(u)
        self.assertEqual(again.public_id, first)


class ApiHelperTests(TestCase):
    """§7: the additive public-ID lookup resolves, delegates, and 404s."""

    def test_is_valid_public_id(self):
        self.assertTrue(is_valid_public_id('MMSR-ORD-1931-000101'))
        for bad in (None, '', '12', 'mmsr-ord-1931-000101',
                    'MMSR-ORD-2024-000101', 'MMSR-ORD-1931-00010'):
            self.assertFalse(is_valid_public_id(bad))

    def test_find_by_public_id(self):
        cat = Category.objects.create(name='Lookup', category_type='journal')
        self.assertEqual(
            find_by_public_id(Category.objects.all(), cat.public_id), cat)
        # Well-formed but unknown → None (never a silent wrong row).
        self.assertIsNone(
            find_by_public_id(Category.objects.all(), 'MMSR-CAT-1931-999999'))
        # Malformed → never reaches the column.
        self.assertIsNone(find_by_public_id(Category.objects.all(), cat.pk))


class PublicIDEndpointTests(TestCase):
    """§7: a detail route accepts the public ID as well as the existing lookup."""

    def setUp(self):
        self.client = APIClient()
        self.cat = Category.objects.create(name='Endpoint', category_type='journal')
        self.journal = Journal.objects.create(
            title='Endpoint Journal',
            slug='endpoint-journal',
            issn='1000-9999',
            category=self.cat,
            description='Endpoint test journal',
            subscription_price_annual='999.00',
        )

    def test_slug_lookup_still_works(self):
        res = self.client.get('/api/publications/journals/endpoint-journal/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['id'], self.journal.pk)

    def test_public_id_lookup_resolves_same_record(self):
        res = self.client.get(
            f'/api/publications/journals/{self.journal.public_id}/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['id'], self.journal.pk)

    def test_unknown_wellformed_public_id_is_404(self):
        res = self.client.get('/api/publications/journals/MMSR-JRN-1931-999999/')
        self.assertEqual(res.status_code, 404)


class OrderPaymentRegressionTests(TestCase):
    """§9/§10: standardization never disturbs payments or legacy references."""

    def setUp(self):
        self.user = User.objects.create(email='buyer@test.local')

    def _new_order(self, **extra):
        return Order.objects.create(user=self.user, total_amount='149.00', **extra)

    def test_new_order_carries_standard_ord_id(self):
        order = self._new_order()
        self.assertTrue(order.public_id.startswith('MMSR-ORD-1931-'))
        self.assertTrue(is_valid_public_id(order.public_id))

    def test_public_id_is_mirrored_into_legacy_reference(self):
        # New orders surface the standard ID through the legacy column too.
        order = self._new_order()
        self.assertEqual(order.custom_order_id, order.public_id)
        self.assertEqual(order.generate_custom_id(), order.public_id)

    def test_razorpay_fields_untouched(self):
        order = self._new_order(
            razorpay_order_id='order_ABC123',
            razorpay_payment_id='pay_XYZ789',
            razorpay_signature='sig_deadbeef',
            transaction_id='txn_999',
        )
        order.status = 'paid'
        order.save()
        order.refresh_from_db()
        # External identifiers are stored verbatim — never rewritten (spec §10).
        self.assertEqual(order.razorpay_order_id, 'order_ABC123')
        self.assertEqual(order.razorpay_payment_id, 'pay_XYZ789')
        self.assertEqual(order.razorpay_signature, 'sig_deadbeef')
        self.assertEqual(order.transaction_id, 'txn_999')
        # ...and remain distinct from the internal MMSR reference.
        self.assertNotEqual(order.public_id, order.razorpay_order_id)

    def test_historical_legacy_reference_is_preserved(self):
        legacy = 'MMSR-SCI-1234-5678'   # old category-based format
        order = Order(user=self.user, total_amount='10.00', custom_order_id=legacy)
        order.save()
        order.refresh_from_db()
        # Legacy row keeps its original business reference untouched...
        self.assertEqual(order.custom_order_id, legacy)
        # ...while still gaining a well-formed standard public ID.
        self.assertTrue(is_valid_public_id(order.public_id))
        self.assertNotEqual(order.public_id, legacy)


class HealthCheckEndpointTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_health_check_returns_ok(self):
        response = self.client.get('/api/health/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_health_check_returns_503_on_failure(self):
        from unittest.mock import patch
        with patch('django.db.connection.cursor', side_effect=Exception('DB connection failed')):
            response = self.client.get('/api/health/')
            self.assertEqual(response.status_code, 503)
            self.assertEqual(response.json(), {"status": "unhealthy"})
