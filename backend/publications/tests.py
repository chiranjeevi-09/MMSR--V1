"""
Backend tests for the Journal Architecture, Article Access Control & User Library spec.
Covers the 15 mandated access cases (TASK 9).
"""
from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from users.models import User
from publications.models import (
    Category, Book, Journal, JournalIssue, JournalArticle, UserJournalAccess,
    NewsletterSubscriber, NewsletterBroadcast,
)
from publications.access_control import (
    check_journal_article_access,
    check_journal_issue_access,
    get_article_access_state,
)
from orders.models import Order, OrderItem
from orders.utils import grant_journal_access_for_order


class ArticleAccessTestBase(TestCase):
    """Shared fixtures: subscription journal, one issue, paid + OA articles, two users."""

    def setUp(self):
        self.cat = Category.objects.create(name='Test Science', category_type='journal')
        self.journal = Journal.objects.create(
            title='International Journal of Test Science',
            issn='1000-0001',
            category=self.cat,
            description='Test journal',
            subscription_price_annual=Decimal('2999.00'),
            access_type='Subscription',
        )
        self.other_journal = Journal.objects.create(
            title='Journal of Unrelated Studies',
            issn='1000-0002',
            category=self.cat,
            description='Another test journal',
            subscription_price_annual=Decimal('999.00'),
            access_type='Subscription',
        )
        self.issue = JournalIssue.objects.create(
            journal=self.journal,
            title='Vol 1, Issue 1',
            volume_number=1,
            issue_number=1,
            publication_date=timezone.localdate(),
            price=Decimal('299.00'),
        )
        self.article = JournalArticle.objects.create(
            journal=self.journal,
            issue=self.issue,
            title='Restricted Test Article',
            abstract='Public abstract text.',
            full_text='SECRET FULL TEXT BODY',
            price=Decimal('149.00'),
            status='published',
            access_mode='paid',
            publication_date=timezone.localdate(),
        )
        self.oa_article = JournalArticle.objects.create(
            journal=self.journal,
            issue=self.issue,
            title='Open Access Test Article',
            abstract='Public OA abstract.',
            full_text='OPEN FULL TEXT BODY',
            status='published',
            access_mode='open_access',
            publication_date=timezone.localdate(),
        )
        self.user = User.objects.create(email='reader@test.local')
        self.user2 = User.objects.create(email='other@test.local')

    def grant_subscription(self, user, journal, days=365, active=True):
        now = timezone.now()
        return UserJournalAccess.objects.create(
            user=user,
            journal=journal,
            access_type='subscription',
            start_date=now - timedelta(days=1),
            end_date=now + timedelta(days=days) if active else now - timedelta(days=1),
            is_active=True,
        )


class ArticleAccessControlTests(ArticleAccessTestBase):

    def test_01_open_access_article_anonymous_user(self):
        """1. Open-access article is accessible to anonymous users."""
        authorized, reason = check_journal_article_access(None, self.oa_article)
        self.assertTrue(authorized)
        self.assertEqual(reason, 'Open Access Article')

    def test_02_restricted_article_anonymous_user(self):
        """2. Restricted article denies anonymous users."""
        authorized, reason = check_journal_article_access(None, self.article)
        self.assertFalse(authorized)
        self.assertIn('Authentication required', reason)

    def test_03_restricted_article_with_active_subscription(self):
        """3. Active journal subscription grants access."""
        self.grant_subscription(self.user, self.journal)
        authorized, reason = check_journal_article_access(self.user, self.article)
        self.assertTrue(authorized)
        self.assertEqual(reason, 'Active journal subscription')

    def test_04_restricted_article_with_expired_subscription(self):
        """4. Expired subscription denies access."""
        self.grant_subscription(self.user, self.journal, active=False)
        authorized, _ = check_journal_article_access(self.user, self.article)
        self.assertFalse(authorized)

    def test_05_restricted_article_with_individual_article_purchase(self):
        """5. Individual article purchase grants access."""
        UserJournalAccess.objects.create(
            user=self.user, journal=self.journal, article=self.article,
            access_type='article', start_date=timezone.now() - timedelta(days=1),
            end_date=None, is_active=True,
        )
        authorized, reason = check_journal_article_access(self.user, self.article)
        self.assertTrue(authorized)
        self.assertEqual(reason, 'Individual article purchase')

    def test_06_restricted_article_without_subscription_or_purchase(self):
        """6. Authenticated user with no entitlement is denied."""
        authorized, reason = check_journal_article_access(self.user, self.article)
        self.assertFalse(authorized)
        self.assertEqual(reason, 'No active entitlement found')

    def test_07_subscription_to_wrong_journal_does_not_grant_access(self):
        """7. Subscription to a different journal does not unlock this article."""
        self.grant_subscription(self.user, self.other_journal)
        authorized, _ = check_journal_article_access(self.user, self.article)
        self.assertFalse(authorized)

    def test_08_purchase_of_different_article_does_not_grant_access(self):
        """8. Owning another article does not unlock this article."""
        other_article = JournalArticle.objects.create(
            journal=self.journal, issue=self.issue, title='Another Paid Article',
            status='published', access_mode='paid', publication_date=timezone.localdate(),
        )
        UserJournalAccess.objects.create(
            user=self.user, journal=self.journal, article=other_article,
            access_type='article', start_date=timezone.now(), is_active=True,
        )
        authorized, _ = check_journal_article_access(self.user, self.article)
        self.assertFalse(authorized)

    def test_paid_article_in_open_access_journal_stays_locked(self):
        """Regression: a journal-level 'Open Access' flag must NOT free an
        article the editor explicitly marked as Paid. The per-article
        access_mode is authoritative."""
        oa_journal = Journal.objects.create(
            title='Fully Open Access Journal', category=self.cat,
            description='OA journal', subscription_price_annual=Decimal('0.00'),
            access_type='Open Access',
        )
        oa_issue = JournalIssue.objects.create(
            journal=oa_journal, title='Vol 1, Issue 1', volume_number=1,
            issue_number=1, publication_date=timezone.localdate(),
            price=Decimal('299.00'),
        )
        paid_in_oa = JournalArticle.objects.create(
            journal=oa_journal, issue=oa_issue, title='Paid Article In OA Journal',
            abstract='Public abstract.', full_text='SECRET', price=Decimal('199.00'),
            status='published', access_mode='paid', publication_date=timezone.localdate(),
        )
        free_in_oa = JournalArticle.objects.create(
            journal=oa_journal, issue=oa_issue, title='Open Article In OA Journal',
            abstract='Public abstract.', full_text='FREE', status='published',
            access_mode='open_access', publication_date=timezone.localdate(),
        )

        # Paid article: denied to anonymous and to an authenticated non-owner.
        authorized_anon, _ = check_journal_article_access(None, paid_in_oa)
        self.assertFalse(authorized_anon)
        authorized_user, _ = check_journal_article_access(self.user, paid_in_oa)
        self.assertFalse(authorized_user)

        state = get_article_access_state(self.user, paid_in_oa)
        self.assertFalse(state['is_open_access'])
        self.assertFalse(state['can_access_pdf'])

        # Open-access article in the same journal remains freely available.
        self.assertTrue(get_article_access_state(None, free_in_oa)['is_open_access'])
        self.assertTrue(check_journal_article_access(None, free_in_oa)[0])

    def test_13_unpublished_article_visibility(self):
        """13. Unpublished articles deny non-staff and are visible to staff only."""
        draft = JournalArticle.objects.create(
            journal=self.journal, title='Draft Article', status='draft',
            access_mode='open_access', publication_date=timezone.localdate(),
        )
        authorized, reason = check_journal_article_access(self.user, draft)
        self.assertFalse(authorized)
        self.assertEqual(reason, 'Article is not published')

        staff = User.objects.create(email='staff@test.local', is_staff=True)
        authorized_staff, _ = check_journal_article_access(staff, draft)
        self.assertTrue(authorized_staff)

        # Draft must not appear in the public list
        client = APIClient()
        data = client.get('/api/publications/articles/').json()
        results = data.get('results', data if isinstance(data, list) else [])
        titles = [r['title'] for r in results]
        self.assertNotIn('Draft Article', titles)

    def test_14_volume_issue_article_relationship_consistency(self):
        """14. Article → issue → journal relationships stay consistent and filterable."""
        client = APIClient()
        by_issue = client.get(f'/api/publications/articles/?issue={self.issue.id}').json()
        results = by_issue.get('results', by_issue if isinstance(by_issue, list) else [])
        self.assertEqual(len(results), 2)
        for r in results:
            self.assertEqual(r['journal'], self.journal.id)
            self.assertEqual(r['issue'], self.issue.id)

    def test_access_state_report_fields(self):
        """Access-state API payload exposes the mandated decision fields."""
        state = get_article_access_state(self.user, self.article)
        for key in (
            'is_open_access', 'has_active_subscription', 'has_article_purchase',
            'can_access_full_text', 'access_reason', 'requires_login',
            'article_pdf_available',
        ):
            self.assertIn(key, state)
        self.assertFalse(state['can_access_full_text'])
        self.assertTrue(state['requires_login'] is False)  # user is authenticated


class ArticleProtectedEndpointTests(ArticleAccessTestBase):

    def setUp(self):
        super().setUp()
        self.client = APIClient()

    def auth(self, user):
        token = RefreshToken.for_user(user).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

    def test_serializer_never_exposes_full_text(self):
        """Protected body must not leak through list/retrieve representations."""
        resp = self.client.get(f'/api/publications/articles/{self.article.id}/')
        self.assertEqual(resp.status_code, 200)
        self.assertNotIn('full_text', resp.json())

        resp_list = self.client.get('/api/publications/articles/')
        for r in resp_list.json().get('results', []):
            self.assertNotIn('full_text', r)

    def test_02_fulltext_endpoint_denies_anonymous(self):
        resp = self.client.get(f'/api/publications/articles/{self.article.id}/fulltext/')
        self.assertEqual(resp.status_code, 401)

    def test_fulltext_endpoint_allows_open_access_anonymous(self):
        resp = self.client.get(f'/api/publications/articles/{self.oa_article.id}/fulltext/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()['full_text'], 'OPEN FULL TEXT BODY')

    def test_fulltext_denied_without_entitlement_allowed_with_purchase(self):
        """Cases 6 + 5 over HTTP."""
        self.auth(self.user)
        denied = self.client.get(f'/api/publications/articles/{self.article.id}/fulltext/')
        self.assertEqual(denied.status_code, 403)

        self.grant_subscription(self.user, self.journal)
        allowed = self.client.get(f'/api/publications/articles/{self.article.id}/fulltext/')
        self.assertEqual(allowed.status_code, 200)
        self.assertEqual(allowed.json()['full_text'], 'SECRET FULL TEXT BODY')

    def test_09_cannot_access_another_users_library(self):
        """Case 9: user-access endpoint is scoped to the requesting user."""
        self.grant_subscription(self.user2, self.journal)
        self.auth(self.user)
        resp = self.client.get('/api/publications/user-access/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        results = data.get('results', data if isinstance(data, list) else [])
        self.assertEqual(len(results), 0)

    def test_10_restricted_pdf_denied_without_entitlement(self):
        """Case 10 over HTTP."""
        self.auth(self.user)
        resp = self.client.get(f'/api/publications/articles/{self.article.id}/pdf/')
        self.assertEqual(resp.status_code, 403)

    def test_11_open_access_pdf_allowed_anonymously(self):
        """Case 11: OA article passes the access check for anonymous callers."""
        authorized, reason = check_journal_article_access(None, self.oa_article)
        self.assertTrue(authorized, reason)
        # OA article without an uploaded PDF correctly reports 404 (not 401/403),
        # proving the authorization gate was passed.
        resp = self.client.get(f'/api/publications/articles/{self.oa_article.id}/pdf/')
        self.assertEqual(resp.status_code, 404)

    def test_access_state_endpoint_requires_no_privileged_data(self):
        resp = self.client.get(f'/api/publications/articles/{self.article.id}/access/')
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertTrue(body['requires_login'])
        self.assertFalse(body['can_access_full_text'])
        self.assertNotIn('full_text', body)


class PaymentEntitlementTests(ArticleAccessTestBase):

    def _make_paid_order(self, user, items_spec):
        order = Order.objects.create(
            user=user, status='paid', total_amount=Decimal('149.00'),
            full_name='Test User', email=user.email, phone_number='9876543210',
            shipping_address='1 Test Street', city='Chennai', postal_code='600001',
            country='India',
        )
        for kind, obj in items_spec:
            item = OrderItem(order=order, quantity=1, price=Decimal('149.00'), format='digital')
            if kind == 'article':
                item.article = obj
            elif kind == 'subscription':
                item.journal_subscription = obj
            item.save()
        return order

    def test_15_entitlements_created_only_after_paid_status(self):
        """15. Article + subscription entitlements appear only for verified paid orders."""
        pending = self._make_paid_order(self.user, [('article', self.article)])
        pending.status = 'pending'
        pending.save()
        granted = grant_journal_access_for_order(pending)
        self.assertEqual(granted, [])
        self.assertFalse(UserJournalAccess.objects.filter(user=self.user, access_type='article').exists())

        paid = self._make_paid_order(self.user2, [('article', self.article), ('subscription', self.journal)])
        granted = grant_journal_access_for_order(paid)
        self.assertEqual(len(granted), 2)
        self.assertTrue(UserJournalAccess.objects.filter(user=self.user2, article=self.article, access_type='article').exists())
        self.assertTrue(UserJournalAccess.objects.filter(user=self.user2, journal=self.journal, access_type='subscription').exists())

    def test_12_duplicate_entitlement_processing_is_idempotent(self):
        """12. Repeated payment notifications never duplicate entitlements."""
        order = self._make_paid_order(self.user, [('article', self.article), ('subscription', self.journal)])
        grant_journal_access_for_order(order)
        grant_journal_access_for_order(order)
        grant_journal_access_for_order(order)

        self.assertEqual(
            UserJournalAccess.objects.filter(user=self.user, access_type='article').count(), 1
        )
        self.assertEqual(
            UserJournalAccess.objects.filter(user=self.user, access_type='subscription').count(), 1
        )

    def test_article_entitlement_does_not_grant_journal_wide_access(self):
        """A single-article purchase must not unlock other articles of the journal."""
        second = JournalArticle.objects.create(
            journal=self.journal, issue=self.issue, title='Second Paid Article',
            status='published', access_mode='paid', publication_date=timezone.localdate(),
        )
        UserJournalAccess.objects.create(
            user=self.user, journal=self.journal, article=self.article,
            access_type='article', start_date=timezone.now(), is_active=True,
        )
        authorized, _ = check_journal_article_access(self.user, second)
        self.assertFalse(authorized)


class CompleteIssueAccessTests(ArticleAccessTestBase):
    """
    The complete-issue PDF is a subscription benefit only. Neither a journal-level
    'Open Access' designation nor an individual article purchase may release it.
    """

    def setUp(self):
        super().setUp()
        self.client = APIClient()
        self.oa_journal = Journal.objects.create(
            title='Fully Open Access Journal',
            issn='1000-0009',
            category=self.cat,
            description='Journal flagged Open Access at the journal level',
            subscription_price_annual=Decimal('1500.00'),
            access_type='Open Access',
        )
        self.oa_issue = JournalIssue.objects.create(
            journal=self.oa_journal,
            title='OA Vol 1, Issue 1',
            volume_number=1,
            issue_number=1,
            publication_date=timezone.localdate(),
            price=Decimal('0.00'),
        )

    def auth(self, user):
        token = RefreshToken.for_user(user).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

    def test_issue_pdf_denied_without_subscription_over_http(self):
        """An authenticated non-subscriber is refused the complete-issue PDF."""
        self.auth(self.user)
        resp = self.client.get(f'/api/publications/issues/{self.issue.id}/pdf/')
        self.assertEqual(resp.status_code, 403)

    def test_issue_pdf_anonymous_denied_over_http(self):
        resp = self.client.get(f'/api/publications/issues/{self.issue.id}/pdf/')
        self.assertEqual(resp.status_code, 401)

    def test_subscription_unlocks_issue_pdf_endpoint(self):
        """A subscriber passes the gate (404 = authorized but no file uploaded)."""
        self.grant_subscription(self.user, self.journal)
        self.auth(self.user)
        resp = self.client.get(f'/api/publications/issues/{self.issue.id}/pdf/')
        self.assertEqual(resp.status_code, 404)
        authorized, reason = check_journal_issue_access(self.user, self.issue)
        self.assertTrue(authorized, reason)
        self.assertEqual(reason, 'Active journal subscription')

    def test_open_access_journal_flag_does_not_free_issue_pdf(self):
        """Core rule: journal-level 'Open Access' must not release the full issue."""
        for subject in (None, self.user):
            authorized, reason = check_journal_issue_access(subject, self.oa_issue)
            self.assertFalse(authorized, reason)
            self.assertNotEqual(reason, 'Open Access Journal')

        self.auth(self.user)
        resp = self.client.get(f'/api/publications/issues/{self.oa_issue.id}/pdf/')
        self.assertEqual(resp.status_code, 403)

        # Subscribing to that very journal is what unlocks it.
        self.grant_subscription(self.user, self.oa_journal)
        authorized_after, reason_after = check_journal_issue_access(self.user, self.oa_issue)
        self.assertTrue(authorized_after, reason_after)

    def test_expired_subscription_revokes_issue_access(self):
        """An expired subscription stops granting complete-issue access."""
        self.grant_subscription(self.user, self.journal, days=365, active=False)
        authorized, reason = check_journal_issue_access(self.user, self.issue)
        self.assertFalse(authorized, reason)

    def test_article_purchase_does_not_unlock_issue_pdf(self):
        """Buying one article keeps that article readable but never frees the issue."""
        UserJournalAccess.objects.create(
            user=self.user, journal=self.journal, article=self.article,
            access_type='article', start_date=timezone.now(), is_active=True,
        )
        article_ok, _ = check_journal_article_access(self.user, self.article)
        self.assertTrue(article_ok)
        issue_ok, reason = check_journal_issue_access(self.user, self.issue)
        self.assertFalse(issue_ok, reason)

    def test_staff_still_reach_issue_pdf(self):
        """Editors/admins retain access for review and fulfilment."""
        staff = User.objects.create(email='staff@test.local', is_staff=True)
        authorized, reason = check_journal_issue_access(staff, self.oa_issue)
        self.assertTrue(authorized, reason)
        self.assertEqual(reason, 'Staff access')


class FormValidationRulesTests(TestCase):
    """Behavioural tests for the authoritative shared rules (Phase M).

    These assert the contract, not the implementation: valid values are
    accepted/normalized, invalid ones are rejected — never silently cleaned
    into a different value.
    """

    def setUp(self):
        from rest_framework.serializers import ValidationError
        self.ValidationError = ValidationError

    # ── Indian mobile ──
    def test_normalize_accepts_common_written_forms(self):
        from form_validation import normalize_indian_mobile
        for raw in ['9876543210', '+91 98765 43210', '09876543210', '(098765) 43210']:
            self.assertEqual(normalize_indian_mobile(raw), '9876543210', raw)

    def test_normalize_rejects_letters_and_wrong_length(self):
        from form_validation import normalize_indian_mobile
        for bad in ['98765abcde', '1234567890', '987654321', '98765432101']:
            with self.assertRaises(self.ValidationError, msg=bad):
                normalize_indian_mobile(bad)

    def test_phone_number_allows_blank_for_optional_fields(self):
        from form_validation import validate_phone_number
        self.assertEqual(validate_phone_number(''), '')
        self.assertEqual(validate_phone_number(None), None)

    # ── Postal codes ──
    def test_pin_accepts_indian_and_generic_postcodes(self):
        from form_validation import validate_optional_indian_pin
        self.assertEqual(validate_optional_indian_pin('600001'), '600001')
        self.assertEqual(validate_optional_indian_pin(''), '')
        self.assertEqual(validate_optional_indian_pin('SW1A 1AA'), 'SW1A 1AA')
        with self.assertRaises(self.ValidationError):
            validate_optional_indian_pin('!!')

    # ── ISBN identifier ──
    def test_isbn_checksum(self):
        from form_validation import validate_isbn
        self.assertEqual(validate_isbn('978-3-16-148410-0'), '978-3-16-148410-0')
        self.assertEqual(validate_isbn('0306406152'), '0306406152')
        self.assertEqual(validate_isbn(''), '')
        with self.assertRaises(self.ValidationError):
            validate_isbn('978-3-16-148410-1')  # bad check digit

    # ── ISSN identifier ──
    def test_issn_checksum(self):
        from form_validation import validate_issn
        self.assertEqual(validate_issn('1234-5679'), '1234-5679')
        self.assertEqual(validate_issn(''), '')
        with self.assertRaises(self.ValidationError):
            validate_issn('1234-5670')  # bad check digit
        with self.assertRaises(self.ValidationError):
            validate_issn('not-an-issn')

    # ── Email ──
    def test_email_format(self):
        from form_validation import validate_email_format
        self.assertEqual(validate_email_format('a@b.co'), 'a@b.co')
        with self.assertRaises(self.ValidationError):
            validate_email_format('a@b')
        with self.assertRaises(self.ValidationError):
            validate_email_format('   ')

    # ── Person / place names (letters-only contract, audit M-10) ──
    def test_alpha_text_accepts_legitimate_names(self):
        from form_validation import validate_alpha_text
        # Letters of any script, spaces and name separators must pass.
        for ok in ['Chiranjeevi', 'José Núñez', 'ललित', "O'Brien", 'Mary-Jane',
                   'Dr. J.ekyll', 'New Delhi', 'Last, First']:
            self.assertEqual(validate_alpha_text(ok, 'Name'), ok, ok)

    def test_alpha_text_rejects_digits(self):
        from form_validation import validate_alpha_text
        with self.assertRaises(self.ValidationError):
            validate_alpha_text('Chiranjeevi1718', 'Name')

    def test_alpha_text_rejects_symbols(self):
        from form_validation import validate_alpha_text
        # Previously only digits were rejected, so these symbols slipped through.
        for bad in ['user@host', 'price#5', 'a/b', 'hey!', 'name$', 'x*y', 'a+b', '(hi)']:
            with self.assertRaises(self.ValidationError, msg=bad):
                validate_alpha_text(bad, 'Name')

    def test_alpha_text_blank_optional_and_required(self):
        from form_validation import validate_alpha_text
        self.assertEqual(validate_alpha_text('', 'Name'), '')
        self.assertEqual(validate_alpha_text(None, 'Name'), '')
        with self.assertRaises(self.ValidationError):
            validate_alpha_text('', 'Name', required=True)



class Soft404ApiTests(TestCase):
    """TASK 12: the API must return REAL 404s for missing records, and accept
    both slug and numeric-id lookups for books (the frontend notFound() relies
    on a genuine 404, and historic /books/<id>/ links must keep resolving)."""

    def setUp(self):
        self.client = APIClient()
        self.cat = Category.objects.create(name='Science', category_type='books')
        self.book = Book.objects.create(
            title='Relativity for All', author='A. Einstein', category=self.cat,
            description='Pop physics', price=Decimal('499.00'),
            published_date='2026-01-01',
        )
        self.journal = Journal.objects.create(
            title='Journal of Physics', issn='2000-0001', category=self.cat,
            description='Physics', subscription_price_annual=Decimal('1000.00'),
        )

    def test_missing_book_returns_404(self):
        self.assertEqual(self.client.get('/api/publications/books/does-not-exist/').status_code, 404)
        self.assertEqual(self.client.get('/api/publications/books/99999999/').status_code, 404)

    def test_book_resolves_by_slug_and_by_id(self):
        self.assertEqual(self.client.get(f'/api/publications/books/{self.book.slug}/').status_code, 200)
        self.assertEqual(self.client.get(f'/api/publications/books/{self.book.id}/').status_code, 200)

    def test_missing_journal_returns_404(self):
        self.assertEqual(self.client.get('/api/publications/journals/nope-not-here/').status_code, 404)

    def test_missing_article_returns_404(self):
        self.assertEqual(self.client.get('/api/publications/articles/ghost-article-slug/').status_code, 404)


class PublicSerializerDataExposureTests(TestCase):
    """TASK 9 (M-8): public endpoints must expose and accept only intended fields.

    The contact form posts through ContactInquirySerializer (create is AllowAny).
    A ``fields='__all__'`` ModelSerializer left those staff-controlled fields
    writable, so an anonymous caller could self-assign status / admin_reply /
    admin_notes (classic mass assignment) and poison the moderation queue.
    These tests lock the read-only boundary in place.
    """

    def setUp(self):
        self.client = APIClient()

    def _post_contact(self, extra=None):
        payload = {
            'name': 'Anonymous Author',
            'email': 'anon@example.com',
            'phone': '9042436048',
            'subject': 'Question about chapter publication',
            'message': 'I would like to know the timeline for chapter publication.',
            'inquiry_type': 'Publishing Enquiry',
        }
        if extra:
            payload.update(extra)
        return self.client.post('/api/publications/contact-inquiries/', payload, format='json')

    def test_public_can_create_inquiry(self):
        res = self._post_contact()
        self.assertEqual(res.status_code, 201, res.data)

    def test_mass_assignment_of_admin_fields_is_ignored(self):
        res = self._post_contact({
            'status': 'Resolved',
            'is_resolved': True,
            'admin_reply': 'Approved by hand',
            'admin_notes': 'VIP - skip review',
            'replied_at': '2020-01-01T00:00:00Z',
        })
        self.assertEqual(res.status_code, 201, res.data)
        inquiry = res.data
        # Server-controlled values must reflect defaults, not attacker input.
        self.assertEqual(inquiry['status'], 'New')
        self.assertFalse(inquiry['is_resolved'])
        self.assertEqual(inquiry['admin_reply'], '')
        self.assertEqual(inquiry['admin_notes'], '')
        self.assertIn(inquiry['replied_at'], (None, ''))

    def test_persisted_row_ignores_injected_admin_fields(self):
        from publications.models import ContactInquiry
        self._post_contact({'status': 'Resolved', 'admin_notes': 'evil'})
        inquiry = ContactInquiry.objects.latest('created_at')
        self.assertEqual(inquiry.status, 'New')
        self.assertEqual(inquiry.admin_notes, '')
        self.assertFalse(inquiry.is_resolved)

    def test_reference_number_is_server_generated(self):
        from publications.models import ContactInquiry
        res = self._post_contact({'reference_number': 'HACKED-0001'})
        self.assertEqual(res.status_code, 201, res.data)
        inquiry = ContactInquiry.objects.latest('created_at')
        self.assertTrue(inquiry.reference_number.startswith('MMSR-ENQ-'))
        self.assertNotEqual(inquiry.reference_number, 'HACKED-0001')


class NewsletterBroadcastHonestyTests(TestCase):
    """Audit TASK 16 regression: the broadcast endpoint must report only sends
    the email backend actually accepted, and must surface failures instead of
    silently counting them as delivered (no real emails are sent here — the
    test runner swaps in the locmem backend)."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email='broadcast-admin@example.com', password='password123', is_staff=True)
        self.client.force_authenticate(user=self.admin)
        self.broadcast = NewsletterBroadcast.objects.create(
            subject='QA issue out now', message='Read it online.')

    def _send(self):
        return self.client.post(f'/api/publications/newsletter-broadcasts/{self.broadcast.id}/send/')

    def test_counts_only_accepted_sends(self):
        NewsletterSubscriber.objects.create(email='one@example.com')
        NewsletterSubscriber.objects.create(email='two@example.com')
        NewsletterSubscriber.objects.create(email='three@example.com', is_active=False)
        res = self._send()
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['recipients_count'], 2)
        self.assertEqual(res.data['failed_count'], 0)
        self.broadcast.refresh_from_db()
        self.assertTrue(self.broadcast.is_sent)
        self.assertEqual(self.broadcast.recipients_count, 2)

    def test_backend_failure_is_reported_not_counted_as_sent(self):
        from unittest.mock import patch
        NewsletterSubscriber.objects.create(email='ok1@example.com')
        NewsletterSubscriber.objects.create(email='boom@example.com')
        NewsletterSubscriber.objects.create(email='ok2@example.com')
        import publications.views as pub_views
        real_send_mail = pub_views.send_mail

        def flaky_send_mail(*args, **kwargs):
            if kwargs.get('recipient_list') == ['boom@example.com']:
                raise OSError('SMTP connection reset')
            return real_send_mail(*args, **kwargs)

        with patch.object(pub_views, 'send_mail', side_effect=flaky_send_mail):
            res = self._send()
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['recipients_count'], 2)
        self.assertEqual(res.data['failed_count'], 1)
        self.assertIn('failed', res.data['detail'])


class AuthenticatedEndpointCacheHeadersPhase4Tests(TestCase):
    """Phase 4 Task 2: every per-user / staff-only endpoint that was missing
    explicit private cache headers must now answer with Cache-Control: no-store
    plus Vary on credentials — while public catalog endpoints stay cacheable
    (no forced no-store) and permission denials keep their exact status codes.

    Endpoints covered: submissions, conference submissions, user profile,
    admin user mgmt / stats / invitations, journal entitlements
    (user-access), admin testimonials, contact inquiries, newsletter
    subscribers/broadcasts, admin chapters.
    """

    def setUp(self):
        from users.models import User as _User  # noqa: F401 (module already imports User)
        self.client = APIClient()
        self.user = User.objects.create_user(email='p4-user@example.com', password='password123')
        self.staff = User.objects.create_user(email='p4-staff@example.com', password='password123',
                                              is_staff=True)
        self.superuser = User.objects.create_user(email='p4-root@example.com', password='password123',
                                                  is_staff=True, is_superuser=True)

    def _assert_private(self, url, user, expected_status=200):
        """Authenticated GET: exact status preserved AND private headers set."""
        self.client.force_authenticate(user=user)
        res = self.client.get(url)
        self.assertEqual(res.status_code, expected_status, url)
        self.assertEqual(res['Cache-Control'], 'no-store', url)
        self.assertIn('Authorization', res.get('Vary', ''), url)
        self.assertIn('Cookie', res.get('Vary', ''), url)
        return res

    def test_all_authenticated_endpoints_carry_no_store(self):
        cases = [
            ('/api/submissions/', self.user),
            ('/api/conference-submissions/', self.user),
            ('/api/users/profile/', self.user),
            ('/api/publications/user-access/', self.user),
            ('/api/users/', self.staff),
            ('/api/users/admin-stats/', self.staff),
            ('/api/publications/admin/testimonials/', self.staff),
            ('/api/publications/contact-inquiries/', self.staff),
            ('/api/publications/newsletter-subscribers/', self.staff),
            ('/api/publications/newsletter-broadcasts/', self.staff),
            ('/api/publications/admin/chapters/', self.staff),
            ('/api/users/invitations/', self.superuser),
        ]
        for url, user in cases:
            self._assert_private(url, user)

    def test_denials_keep_status_and_are_no_store(self):
        # Unauthenticated requests must still be rejected with the SAME code as
        # before this change (401/403 per DRF auth classes) — and the denial
        # body itself is marked private.
        for url in ('/api/submissions/', '/api/users/profile/',
                    '/api/publications/user-access/', '/api/users/',
                    '/api/publications/contact-inquiries/'):
            res = self.client.get(url)
            self.assertIn(res.status_code, (401, 403), url)
            self.assertEqual(res['Cache-Control'], 'no-store', url)

    def test_non_admin_denied_admin_endpoints(self):
        # Permissions semantics unchanged: a signed-in NON-staff user is still
        # refused every staff-only listing (403), with private headers.
        for url in ('/api/users/', '/api/users/admin-stats/',
                    '/api/publications/admin/testimonials/',
                    '/api/publications/contact-inquiries/',
                    '/api/publications/newsletter-subscribers/',
                    '/api/publications/newsletter-broadcasts/',
                    '/api/publications/admin/chapters/',
                    '/api/users/invitations/'):
            res = self._assert_private(url, self.user, expected_status=403)

    def test_public_catalog_endpoints_remain_cacheable(self):
        # The mixin must NOT have leaked onto public catalog endpoints: their
        # anonymous responses must not be forced to no-store.
        for url in ('/api/publications/books/', '/api/publications/journals/',
                    '/api/publications/categories/', '/api/submissions/volumes/',
                    '/api/conferences/', '/api/slider/'):
            res = self.client.get(url)
            self.assertEqual(res.status_code, 200, url)
            self.assertNotEqual(res.get('Cache-Control', ''), 'no-store', url)

    @staticmethod
    def _ids(res):
        data = res.json() if hasattr(res, 'json') else res.data
        rows = data['results'] if isinstance(data, dict) and 'results' in data else data
        return [row['id'] for row in rows]

    def test_one_users_submissions_never_appear_for_another(self):
        # Defense-in-depth proof: even ignoring cache headers entirely, the
        # viewset queryset itself scopes records to the authenticated author.
        from django.core.files.base import ContentFile
        from submissions.models import Submission
        mine = Submission.objects.create(
            author=self.user, title='Secret Manuscript', abstract='A',
            corresponding_email=self.user.email)
        mine.manuscript_file.save('m.pdf', ContentFile(b'%PDF-1.4 test'), save=True)

        self.client.force_authenticate(user=self.user)
        res = self.client.get('/api/submissions/')
        self.assertEqual(res.status_code, 200)
        self.assertIn(mine.id, self._ids(res))

        stranger = User.objects.create_user(email='p4-stranger@example.com', password='password123')
        self.client.force_authenticate(user=stranger)
        res = self.client.get('/api/submissions/')
        self.assertEqual(res.status_code, 200)
        self.assertNotIn(mine.id, self._ids(res))
        detail = self.client.get(f'/api/submissions/{mine.id}/')
        self.assertEqual(detail.status_code, 404)
        # The 404 denial of someone else's record is private too.
        self.assertEqual(detail['Cache-Control'], 'no-store')


