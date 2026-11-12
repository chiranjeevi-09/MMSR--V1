import unittest
from unittest.mock import patch, MagicMock
from decimal import Decimal
import datetime
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from orders.models import Order, OrderItem
from orders.job_models import InvoiceJob
from orders.utils import grant_journal_access_for_order
from publications.models import Category, Book, Journal, JournalIssue, JournalArticle, UserJournalAccess
from publications.access_control import check_journal_issue_access, check_journal_article_access

User = get_user_model()


class OrderJournalAccessPhase3Tests(TestCase):

    def setUp(self):
        self.client = APIClient()

        # Users
        self.user1 = User.objects.create_user(email='user1@example.com', password='password123')
        self.user2 = User.objects.create_user(email='user2@example.com', password='password123')
        self.staff_user = User.objects.create_user(email='staff@example.com', password='password123', is_staff=True)

        # Categories
        self.book_category = Category.objects.create(name='Academic Books', slug='academic-books', category_type='books')
        self.journal_category = Category.objects.create(name='Tech Journals', slug='tech-journals', category_type='journals')

        # Book
        self.book = Book.objects.create(
            title='Quantum Mechanics 101',
            slug='quantum-mechanics-101',
            author='Dr. Fermi',
            category=self.book_category,
            description='Intro to Quantum Mechanics',
            price=Decimal('500.00'),
            published_date=datetime.date(2026, 1, 1)
        )

        # Journal 1 (Subscription based)
        self.journal1 = Journal.objects.create(
            title='Journal of Quantum Research',
            slug='journal-quantum-research',
            issn='1111-2222',
            category=self.journal_category,
            description='Quantum journal',
            subscription_price_annual=Decimal('1200.00'),
            access_type='Subscription'
        )

        # Journal 2 (Subscription based)
        self.journal2 = Journal.objects.create(
            title='Journal of Robotics',
            slug='journal-robotics',
            issn='3333-4444',
            category=self.journal_category,
            description='Robotics journal',
            subscription_price_annual=Decimal('800.00'),
            access_type='Subscription'
        )

        # Journal Issues
        self.issue1 = JournalIssue.objects.create(
            journal=self.journal1,
            title='Vol 1, Issue 1',
            volume_number=1,
            issue_number=1,
            publication_date=datetime.date(2026, 1, 1),
            price=Decimal('200.00')
        )
        self.issue2 = JournalIssue.objects.create(
            journal=self.journal1,
            title='Vol 1, Issue 2',
            volume_number=1,
            issue_number=2,
            publication_date=datetime.date(2026, 2, 1),
            price=Decimal('200.00')
        )

    def test_issue_purchase_no_longer_grants_access(self):
        """1. Issue-level purchasing is removed: a paid issue order grants no entitlement."""
        order = Order.objects.create(
            user=self.user1,
            full_name='User One',
            email='user1@example.com',
            total_amount=Decimal('200.00'),
            status='paid',
            custom_order_id='MMSR-TECH-0001-00001'
        )
        OrderItem.objects.create(order=order, journal_issue=self.issue1, quantity=1, price=Decimal('200.00'))

        # No UserJournalAccess row is created for an issue item, in any format.
        access_list = grant_journal_access_for_order(order)
        self.assertEqual(len(access_list), 0)
        self.assertFalse(UserJournalAccess.objects.filter(user=self.user1).exists())

        # A legacy per-issue entitlement therefore cannot unlock the complete issue PDF.
        has_access_issue1, reason = check_journal_issue_access(self.user1, self.issue1)
        has_access_issue2, _ = check_journal_issue_access(self.user1, self.issue2)
        self.assertFalse(has_access_issue1)
        self.assertFalse(has_access_issue2)
        self.assertEqual(reason, 'No active journal subscription')

        # An active journal subscription is what grants access to every issue of that journal.
        sub_order = Order.objects.create(
            user=self.user1,
            full_name='User One',
            email='user1@example.com',
            total_amount=Decimal('1200.00'),
            status='paid'
        )
        OrderItem.objects.create(order=sub_order, journal_subscription=self.journal1, quantity=1, price=Decimal('1200.00'))
        grant_journal_access_for_order(sub_order)

        self.assertTrue(check_journal_issue_access(self.user1, self.issue1)[0])
        self.assertTrue(check_journal_issue_access(self.user1, self.issue2)[0])

    def test_issue_level_order_creation_is_rejected(self):
        """1b. Checkout refuses to build an order that contains a journal issue item."""
        self.client.force_authenticate(user=self.user1)
        payload = {
            'full_name': 'User One',
            'email': 'user1@example.com',
            'phone': '9876543210',
            'shipping_address': '123 Academic Way',
            'city': 'Delhi',
            'state': 'Delhi',
            'postal_code': '110001',
            'country': 'India',
            'payment_method': 'razorpay',
            'items': [
                {'journal_issue': self.issue1.id, 'format': 'digital', 'quantity': 1},
            ],
        }
        res = self.client.post('/api/commerce/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('no longer offered', str(res.data).lower())
        # The rejected order must not be left behind
        self.assertFalse(Order.objects.filter(user=self.user1).exists())

    def test_annual_subscription_purchase_activation(self):
        """2. Verified annual subscription grants access for 1 year period."""
        order = Order.objects.create(
            user=self.user1,
            full_name='User One',
            email='user1@example.com',
            total_amount=Decimal('1200.00'),
            status='paid'
        )
        OrderItem.objects.create(order=order, journal_subscription=self.journal1, quantity=1, price=Decimal('1200.00'))

        access_list = grant_journal_access_for_order(order)
        self.assertEqual(len(access_list), 1)

        sub_access = access_list[0]
        self.assertEqual(sub_access.user, self.user1)
        self.assertEqual(sub_access.journal, self.journal1)
        self.assertIsNone(sub_access.issue)
        self.assertEqual(sub_access.access_type, 'subscription')
        self.assertTrue(sub_access.is_valid_now())

        # Check subscription grants access to ALL issues of journal 1
        has_access_issue1, _ = check_journal_issue_access(self.user1, self.issue1)
        has_access_issue2, _ = check_journal_issue_access(self.user1, self.issue2)
        self.assertTrue(has_access_issue1)
        self.assertTrue(has_access_issue2)

    def test_unpaid_or_failed_order_grants_no_access(self):
        """3 & 4. Unpaid or pending order grants zero access."""
        order = Order.objects.create(
            user=self.user1,
            full_name='User One',
            email='user1@example.com',
            total_amount=Decimal('1200.00'),
            status='pending'
        )
        OrderItem.objects.create(order=order, journal_subscription=self.journal1, quantity=1, price=Decimal('1200.00'))

        access_list = grant_journal_access_for_order(order)
        self.assertEqual(len(access_list), 0)
        self.assertFalse(UserJournalAccess.objects.filter(user=self.user1).exists())

    def test_idempotency_and_duplicate_prevention(self):
        """5. Repeated activation on same order does not create duplicate grants."""
        order = Order.objects.create(
            user=self.user1,
            full_name='User One',
            email='user1@example.com',
            total_amount=Decimal('1200.00'),
            status='paid'
        )
        OrderItem.objects.create(order=order, journal_subscription=self.journal1, quantity=1, price=Decimal('1200.00'))

        grant_journal_access_for_order(order)
        initial_count = UserJournalAccess.objects.filter(user=self.user1, journal=self.journal1).count()
        self.assertEqual(initial_count, 1)

        # Re-run grant on same order
        grant_journal_access_for_order(order)
        repeated_count = UserJournalAccess.objects.filter(user=self.user1, journal=self.journal1).count()
        self.assertEqual(repeated_count, 1)

    def test_multiple_journal_items_in_order(self):
        """6. Multiple subscription items in one order receive independent entitlements."""
        order = Order.objects.create(
            user=self.user1,
            full_name='User One',
            email='user1@example.com',
            total_amount=Decimal('2000.00'),
            status='paid'
        )
        OrderItem.objects.create(order=order, journal_subscription=self.journal1, quantity=1, price=Decimal('1200.00'))
        OrderItem.objects.create(order=order, journal_subscription=self.journal2, quantity=1, price=Decimal('800.00'))

        access_list = grant_journal_access_for_order(order)
        self.assertEqual(len(access_list), 2)

        self.assertTrue(UserJournalAccess.objects.filter(user=self.user1, journal=self.journal1, access_type='subscription').exists())
        self.assertTrue(UserJournalAccess.objects.filter(user=self.user1, journal=self.journal2, access_type='subscription').exists())

        # Each subscription unlocks its own journal's issues
        self.assertTrue(check_journal_issue_access(self.user1, self.issue1)[0])
        self.assertTrue(check_journal_issue_access(self.user1, self.issue2)[0])

    def test_mixed_order_book_and_journal(self):
        """7. Mixed order handles books without error while granting journal entitlements."""
        order = Order.objects.create(
            user=self.user1,
            full_name='User One',
            email='user1@example.com',
            total_amount=Decimal('1700.00'),
            status='paid'
        )
        OrderItem.objects.create(order=order, book=self.book, quantity=1, price=Decimal('500.00'))
        OrderItem.objects.create(order=order, journal_subscription=self.journal1, quantity=1, price=Decimal('1200.00'))

        access_list = grant_journal_access_for_order(order)
        self.assertEqual(len(access_list), 1)
        self.assertEqual(access_list[0].journal, self.journal1)
        self.assertIsNone(access_list[0].issue)

    def test_user_isolation(self):
        """8. User cannot receive entitlements from another user's order."""
        order = Order.objects.create(
            user=self.user1,
            full_name='User One',
            email='user1@example.com',
            total_amount=Decimal('1200.00'),
            status='paid'
        )
        OrderItem.objects.create(order=order, journal_subscription=self.journal1, quantity=1, price=Decimal('1200.00'))

        grant_journal_access_for_order(order)
        has_user1_access, _ = check_journal_issue_access(self.user1, self.issue1)
        has_user2_access, _ = check_journal_issue_access(self.user2, self.issue1)

        self.assertTrue(has_user1_access)
        self.assertFalse(has_user2_access)

    @patch('orders.views.razorpay.Client')
    def test_razorpay_verification_flow(self, mock_razorpay_client):
        """10. Verify Razorpay signature & amount check triggering subscription entitlement."""
        mock_instance = MagicMock()
        mock_razorpay_client.return_value = mock_instance
        mock_instance.utility.verify_payment_signature.return_value = True
        mock_instance.payment.fetch.return_value = {'amount': 120000, 'currency': 'INR', 'status': 'captured'}

        order = Order.objects.create(
            user=self.user1,
            full_name='User One',
            email='user1@example.com',
            total_amount=Decimal('1200.00'),
            status='pending'
        )
        OrderItem.objects.create(order=order, journal_subscription=self.journal1, quantity=1, price=Decimal('1200.00'))

        self.client.force_authenticate(user=self.user1)

        with patch('orders.views.generate_invoice'):
            res = self.client.post(
                f'/api/commerce/{order.id}/verify_razorpay/',
                {
                    'razorpay_order_id': 'order_123',
                    'razorpay_payment_id': 'pay_123',
                    'razorpay_signature': 'sig_123'
                }
            )

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        order.refresh_from_db()
        self.assertEqual(order.status, 'paid')
        self.assertTrue(UserJournalAccess.objects.filter(user=self.user1, journal=self.journal1, access_type='subscription').exists())
        self.assertTrue(check_journal_issue_access(self.user1, self.issue1)[0])

    @patch('orders.views.razorpay.Client')
    def test_razorpay_verification_of_issue_order_grants_no_access(self, mock_razorpay_client):
        """10b. Razorpay verification still completes payment, but an issue item grants no access."""
        mock_instance = MagicMock()
        mock_razorpay_client.return_value = mock_instance
        mock_instance.utility.verify_payment_signature.return_value = True
        mock_instance.payment.fetch.return_value = {'amount': 20000, 'currency': 'INR', 'status': 'captured'}

        order = Order.objects.create(
            user=self.user1,
            full_name='User One',
            email='user1@example.com',
            total_amount=Decimal('200.00'),
            status='pending'
        )
        OrderItem.objects.create(order=order, journal_issue=self.issue1, quantity=1, price=Decimal('200.00'))

        self.client.force_authenticate(user=self.user1)

        with patch('orders.views.generate_invoice'):
            res = self.client.post(
                f'/api/commerce/{order.id}/verify_razorpay/',
                {
                    'razorpay_order_id': 'order_123',
                    'razorpay_payment_id': 'pay_123',
                    'razorpay_signature': 'sig_123'
                }
            )

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        order.refresh_from_db()
        self.assertEqual(order.status, 'paid')
        # Payment is recorded, but no issue-level entitlement is created
        self.assertFalse(UserJournalAccess.objects.filter(user=self.user1).exists())
        self.assertFalse(check_journal_issue_access(self.user1, self.issue1)[0])

    def test_subscription_renewal_extends_active_period(self):
        """9. Renewing / purchasing during active subscription extends end_date by 1 year without losing remaining time."""
        order1 = Order.objects.create(
            user=self.user1,
            full_name='User One',
            email='user1@example.com',
            total_amount=Decimal('1200.00'),
            status='paid'
        )
        OrderItem.objects.create(order=order1, journal_subscription=self.journal1, quantity=1, price=Decimal('1200.00'))
        grant_journal_access_for_order(order1)

        sub1 = UserJournalAccess.objects.get(user=self.user1, journal=self.journal1, access_type='subscription')
        initial_end_date = sub1.end_date

        # Second purchase
        order2 = Order.objects.create(
            user=self.user1,
            full_name='User One',
            email='user1@example.com',
            total_amount=Decimal('1200.00'),
            status='paid'
        )
        OrderItem.objects.create(order=order2, journal_subscription=self.journal1, quantity=1, price=Decimal('1200.00'))
        grant_journal_access_for_order(order2)

        sub1.refresh_from_db()
        expected_end_date = initial_end_date + datetime.timedelta(days=365)
        self.assertAlmostEqual(sub1.end_date.timestamp(), expected_end_date.timestamp(), delta=5)

        # Idempotent re-execution on order2 does not extend further
        grant_journal_access_for_order(order2)
        sub1.refresh_from_db()
        self.assertAlmostEqual(sub1.end_date.timestamp(), expected_end_date.timestamp(), delta=5)


class JournalPurchaseFormatsPhase8Tests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(email='buyer@example.com', password='password123')
        self.client.force_authenticate(user=self.user)

        self.category = Category.objects.create(name='Science', slug='science', category_type='journals')
        self.journal = Journal.objects.create(
            title='Advances in Scientific Research',
            slug='asr-journal',
            issn='5555-6666',
            category=self.category,
            subscription_price_annual=Decimal('3000.00'),
            access_type='Subscription'
        )

        # Issue with digital, print, and bundle configured
        self.issue_all = JournalIssue.objects.create(
            journal=self.journal,
            title='Vol 1, Issue 1 Full Formats',
            volume_number=1,
            issue_number=1,
            publication_date=datetime.date(2026, 1, 1),
            price=Decimal('299.00'),
            price_print=Decimal('499.00'),
            price_bundle=Decimal('649.00'),
            stock=15,
            file_digital='test_issue_1.pdf'
        )

        # Issue with out-of-stock print and no bundle
        self.issue_digital_only = JournalIssue.objects.create(
            journal=self.journal,
            title='Vol 1, Issue 2 Digital Only',
            volume_number=1,
            issue_number=2,
            publication_date=datetime.date(2026, 2, 1),
            price=Decimal('199.00'),
            stock=0,
            file_digital='test_issue_2.pdf'
        )

    def test_digital_issue_order_grants_no_access(self):
        """Issue-level purchase is retired: a digital issue order grants no entitlement."""
        order = Order.objects.create(
            user=self.user,
            full_name='Buyer User',
            email='buyer@example.com',
            total_amount=Decimal('299.00'),
            status='paid',
        )
        OrderItem.objects.create(
            order=order,
            journal_issue=self.issue_all,
            format='digital',
            quantity=1,
            price=Decimal('299.00')
        )

        access_list = grant_journal_access_for_order(order)
        self.assertEqual(len(access_list), 0)
        self.assertFalse(UserJournalAccess.objects.filter(user=self.user).exists())
        has_access, _ = check_journal_issue_access(self.user, self.issue_all)
        self.assertFalse(has_access)

    def test_print_only_purchase_does_not_grant_digital_access(self):
        order = Order.objects.create(
            user=self.user,
            full_name='Buyer User',
            email='buyer@example.com',
            total_amount=Decimal('499.00'),
            status='paid',
        )
        OrderItem.objects.create(
            order=order,
            journal_issue=self.issue_all,
            format='print',
            quantity=1,
            price=Decimal('499.00')
        )

        access_list = grant_journal_access_for_order(order)
        self.assertEqual(len(access_list), 0)
        has_access, _ = check_journal_issue_access(self.user, self.issue_all)
        self.assertFalse(has_access)

    def test_bundle_issue_order_grants_no_access(self):
        """Bundle items no longer create a digital entitlement either."""
        order = Order.objects.create(
            user=self.user,
            full_name='Buyer User',
            email='buyer@example.com',
            total_amount=Decimal('649.00'),
            status='paid',
        )
        OrderItem.objects.create(
            order=order,
            journal_issue=self.issue_all,
            format='bundle',
            quantity=1,
            price=Decimal('649.00')
        )

        access_list = grant_journal_access_for_order(order)
        self.assertEqual(len(access_list), 0)
        has_access, _ = check_journal_issue_access(self.user, self.issue_all)
        self.assertFalse(has_access)

    def test_backend_price_validation_and_issue_rejection(self):
        """Server-authoritative pricing for the remaining purchase types; issue items rejected."""
        article = JournalArticle.objects.create(
            journal=self.journal,
            issue=self.issue_all,
            title='Priced Test Article',
            abstract='Public abstract.',
            full_text='SECRET BODY',
            price=Decimal('149.00'),
            status='published',
            access_mode='paid',
            publication_date=datetime.date(2026, 1, 1),
        )

        base = {
            'full_name': 'Buyer User',
            'email': 'buyer@example.com',
            'phone': '9876543210',
            'shipping_address': '123 Academic Way',
            'city': 'Delhi',
            'state': 'Delhi',
            'postal_code': '110001',
            'country': 'India',
            'payment_method': 'razorpay',
        }

        # 1. Digital issue purchase is rejected outright (no checkout, no price)
        res_issue = self.client.post(
            '/api/commerce/',
            {**base, 'items': [{'journal_issue': self.issue_all.id, 'format': 'digital', 'quantity': 1}]},
            format='json'
        )
        self.assertEqual(res_issue.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('no longer offered', str(res_issue.data).lower())

        # 2. Print issue purchase is rejected too (physical issue sales removed here)
        res_print = self.client.post(
            '/api/commerce/',
            {**base, 'items': [{'journal_issue': self.issue_all.id, 'format': 'print', 'quantity': 1, 'price': '0.01'}]},
            format='json'
        )
        self.assertEqual(res_print.status_code, status.HTTP_400_BAD_REQUEST)

        # 3. Bundle issue purchase is rejected as well
        res_bundle = self.client.post(
            '/api/commerce/',
            {**base, 'items': [{'journal_issue': self.issue_all.id, 'format': 'bundle', 'quantity': 1}]},
            format='json'
        )
        self.assertEqual(res_bundle.status_code, status.HTTP_400_BAD_REQUEST)

        # 4. Individual article purchase still works and uses backend authoritative pricing
        res_article = self.client.post(
            '/api/commerce/',
            {**base, 'items': [{'article': article.id, 'quantity': 1, 'price': '0.01', 'total_amount': '0.01'}]},
            format='json'
        )
        self.assertEqual(res_article.status_code, status.HTTP_201_CREATED)
        article_order = Order.objects.get(id=res_article.data['id'])
        self.assertEqual(article_order.total_amount, Decimal('149.00'))
        art_item = article_order.items.first()
        self.assertEqual(art_item.price, Decimal('149.00'))
        self.assertEqual(art_item.format, 'digital')
        self.assertFalse(article_order.requires_shipping())

        # 5. Journal subscription purchase still works at the server-side annual price
        res_sub = self.client.post(
            '/api/commerce/',
            {**base, 'items': [{'journal_subscription': self.journal.id, 'quantity': 1, 'price': '0.01'}]},
            format='json'
        )
        self.assertEqual(res_sub.status_code, status.HTTP_201_CREATED)
        sub_order = Order.objects.get(id=res_sub.data['id'])
        self.assertEqual(sub_order.total_amount, Decimal('3000.00'))
        self.assertEqual(sub_order.items.first().price, Decimal('3000.00'))

    def test_unverified_or_cancelled_payment_grants_no_entitlement(self):
        order = Order.objects.create(
            user=self.user,
            full_name='Buyer User',
            email='buyer@example.com',
            total_amount=Decimal('3000.00'),
            status='failed',
        )
        OrderItem.objects.create(
            order=order,
            journal_subscription=self.journal,
            format='digital',
            quantity=1,
            price=Decimal('3000.00')
        )
        access_list = grant_journal_access_for_order(order)
        self.assertEqual(len(access_list), 0)
        has_access, _ = check_journal_issue_access(self.user, self.issue_all)
        self.assertFalse(has_access)


class OrderFulfillmentPhase9Tests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(email='customer1@example.com', password='password123')
        self.user2 = User.objects.create_user(email='customer2@example.com', password='password123')
        self.staff_user = User.objects.create_user(email='staff1@example.com', password='password123', is_staff=True)

        self.category = Category.objects.create(name='Technology', slug='technology', category_type='journals')
        self.book_category = Category.objects.create(name='Books Tech', slug='books-tech', category_type='books')
        self.book = Book.objects.create(
            title='Handbook of Robotics',
            slug='handbook-robotics',
            author='Dr. Ada',
            category=self.book_category,
            description='Robotics handbook',
            price=Decimal('500.00'),
            published_date=datetime.date(2026, 1, 1)
        )
        self.journal = Journal.objects.create(
            title='Journal of Technology',
            slug='jot-journal',
            issn='1234-5678',
            category=self.category,
            subscription_price_annual=Decimal('2500.00'),
            access_type='Subscription'
        )
        self.issue = JournalIssue.objects.create(
            journal=self.journal,
            title='Vol 1, Issue 1',
            volume_number=1,
            issue_number=1,
            publication_date=datetime.date(2026, 1, 1),
            price=Decimal('299.00'),
            price_print=Decimal('499.00'),
            stock=20,
            file_digital='issue1.pdf'
        )

    def test_digital_only_order_marked_not_required(self):
        """A digital-only (subscription) order needs no physical fulfillment."""
        self.client.force_authenticate(user=self.user1)
        payload = {
            'full_name': 'Customer One',
            'email': 'customer1@example.com',
            'phone': '9998887770',
            'shipping_address': 'Address line',
            'city': 'Chennai',
            'state': 'Tamil Nadu',
            'postal_code': '600001',
            'country': 'India',
            'payment_method': 'razorpay',
            'items': [
                {
                    'journal_subscription': self.journal.id,
                    'quantity': 1,
                }
            ]
        }
        res = self.client.post('/api/commerce/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        order = Order.objects.get(id=res.data['id'])
        self.assertEqual(order.fulfillment_status, 'not_required')
        self.assertFalse(order.requires_shipping())

    def test_physical_print_order_marked_pending(self):
        """A physical (book print) order still initializes pending fulfillment."""
        self.client.force_authenticate(user=self.user1)
        payload = {
            'full_name': 'Customer One',
            'email': 'customer1@example.com',
            'phone': '9998887770',
            'shipping_address': 'Address line',
            'city': 'Chennai',
            'state': 'Tamil Nadu',
            'postal_code': '600001',
            'country': 'India',
            'payment_method': 'razorpay',
            'items': [
                {
                    'book': self.book.id,
                    'quantity': 1,
                }
            ]
        }
        res = self.client.post('/api/commerce/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        order = Order.objects.get(id=res.data['id'])
        self.assertEqual(order.fulfillment_status, 'pending')
        self.assertTrue(order.requires_shipping())

    def test_issue_level_order_is_rejected_at_checkout(self):
        """Issue purchases cannot enter the cart/checkout pipeline at all."""
        self.client.force_authenticate(user=self.user1)
        for fmt in ('digital', 'print', 'bundle'):
            payload = {
                'full_name': 'Customer One',
                'email': 'customer1@example.com',
                'phone': '9998887770',
                'shipping_address': 'Address line',
                'city': 'Chennai',
                'state': 'Tamil Nadu',
                'postal_code': '600001',
                'country': 'India',
                'payment_method': 'razorpay',
                'items': [
                    {'journal_issue': self.issue.id, 'format': fmt, 'quantity': 1},
                ]
            }
            res = self.client.post('/api/commerce/', payload, format='json')
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST, fmt)
        self.assertEqual(Order.objects.filter(user=self.user1).count(), 0)

    def test_staff_only_fulfillment_update(self):
        order = Order.objects.create(
            user=self.user1,
            full_name='Customer One',
            email='customer1@example.com',
            total_amount=Decimal('499.00'),
            status='paid',
            fulfillment_status='pending'
        )
        OrderItem.objects.create(
            order=order,
            journal_issue=self.issue,
            format='print',
            quantity=1,
            price=Decimal('499.00')
        )

        # 1. Non-staff user denied
        self.client.force_authenticate(user=self.user1)
        res_denied = self.client.post(
            f'/api/commerce/{order.id}/update_fulfillment/',
            {'fulfillment_status': 'packed'},
            format='json'
        )
        self.assertEqual(res_denied.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Staff user permitted
        self.client.force_authenticate(user=self.staff_user)
        res_ok = self.client.post(
            f'/api/commerce/{order.id}/update_fulfillment/',
            {
                'fulfillment_status': 'dispatched',
                'courier_name': 'India Post Speed Post',
                'tracking_number': 'EM123456789IN',
                'tracking_url': 'https://www.indiapost.gov.in',
            },
            format='json'
        )
        self.assertEqual(res_ok.status_code, status.HTTP_200_OK)
        order.refresh_from_db()
        self.assertEqual(order.fulfillment_status, 'dispatched')
        self.assertEqual(order.courier_name, 'India Post Speed Post')
        self.assertEqual(order.tracking_number, 'EM123456789IN')
        self.assertIsNotNone(order.dispatched_at)

    def test_customer_isolation_fulfillment_tracking(self):
        order = Order.objects.create(
            user=self.user1,
            full_name='Customer One',
            email='customer1@example.com',
            total_amount=Decimal('499.00'),
            status='paid',
            fulfillment_status='dispatched',
            courier_name='BlueDart',
            tracking_number='BD998877'
        )
        OrderItem.objects.create(
            order=order,
            journal_issue=self.issue,
            format='print',
            quantity=1,
            price=Decimal('499.00')
        )

        # Customer 2 cannot access Customer 1's order
        self.client.force_authenticate(user=self.user2)
        res = self.client.get(f'/api/commerce/{order.id}/')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

        # Customer 1 can access their own order
        self.client.force_authenticate(user=self.user1)
        res_owner = self.client.get(f'/api/commerce/{order.id}/')
        self.assertEqual(res_owner.status_code, status.HTTP_200_OK)
        self.assertEqual(res_owner.data['fulfillment_status'], 'dispatched')
        self.assertEqual(res_owner.data['tracking_number'], 'BD998877')

    def test_status_transitions_and_validations(self):
        order = Order.objects.create(
            user=self.user1,
            full_name='Customer One',
            email='customer1@example.com',
            total_amount=Decimal('499.00'),
            status='paid',
            fulfillment_status='delivered'
        )
        OrderItem.objects.create(
            order=order,
            journal_issue=self.issue,
            format='print',
            quantity=1,
            price=Decimal('499.00')
        )
        self.client.force_authenticate(user=self.staff_user)

        # Delivered order cannot revert to pending
        res_revert = self.client.post(
            f'/api/commerce/{order.id}/update_fulfillment/',
            {'fulfillment_status': 'pending'},
            format='json'
        )
        self.assertEqual(res_revert.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('cannot be reverted', res_revert.data['error'])

        # Invalid string rejected
        res_invalid = self.client.post(
            f'/api/commerce/{order.id}/update_fulfillment/',
            {'fulfillment_status': 'on_the_moon'},
            format='json'
        )
        self.assertEqual(res_invalid.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Invalid fulfillment status', res_invalid.data['error'])
class SubscriptionLifecyclePhase10Tests(TestCase):
    """
    Phase 10 -- Subscription Lifecycle and Entitlement Reliability Tests.
    """

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(email='subscriber@example.com', password='password123')
        self.category = Category.objects.create(name='Medical Research', slug='med-research', category_type='journals')
        self.journal = Journal.objects.create(
            title='Journal of Advanced Medicine',
            slug='journal-advanced-med',
            issn='2345-6789',
            category=self.category,
            subscription_price_annual=Decimal('2500.00'),
            access_type='Subscription'
        )
        self.issue1 = JournalIssue.objects.create(
            journal=self.journal,
            volume_number=1,
            issue_number=1,
            title='Issue 1: Cardiology Foundations',
            price=Decimal('500.00'),
            price_print=Decimal('700.00'),
            price_bundle=Decimal('900.00'),
            publication_date=datetime.date(2026, 1, 15)
        )
        self.issue2 = JournalIssue.objects.create(
            journal=self.journal,
            volume_number=1,
            issue_number=2,
            title='Issue 2: Neural Networks in Surgery',
            price=Decimal('500.00'),
            price_print=Decimal('700.00'),
            price_bundle=Decimal('900.00'),
            publication_date=datetime.date(2026, 6, 15)
        )

    def test_new_subscription_activation(self):
        """1. New subscription purchase activates 1-year access window."""
        order = Order.objects.create(
            user=self.user,
            full_name='Sub Buyer',
            email='subscriber@example.com',
            total_amount=Decimal('2500.00'),
            status='paid'
        )
        OrderItem.objects.create(order=order, journal_subscription=self.journal, quantity=1, price=Decimal('2500.00'))

        accesses = grant_journal_access_for_order(order)
        self.assertEqual(len(accesses), 1)
        access = accesses[0]
        self.assertEqual(access.access_type, 'subscription')
        self.assertEqual(access.journal, self.journal)
        self.assertIsNone(access.issue)
        self.assertTrue(access.is_active)
        self.assertTrue(access.is_valid_now())

        # Access check for issue in journal
        has_access, reason = check_journal_issue_access(self.user, self.issue1)
        self.assertTrue(has_access)
        self.assertEqual(reason, 'Active journal subscription')

    def test_active_subscription_renewal_extends_from_current_expiry(self):
        """2. Active subscription renewal extends exactly 365 days from current expiry."""
        now = timezone.now()
        initial_end = now + datetime.timedelta(days=100)
        sub = UserJournalAccess.objects.create(
            user=self.user,
            journal=self.journal,
            access_type='subscription',
            start_date=now - datetime.timedelta(days=265),
            end_date=initial_end,
            is_active=True
        )

        renewal_order = Order.objects.create(
            user=self.user,
            full_name='Sub Buyer',
            email='subscriber@example.com',
            total_amount=Decimal('2500.00'),
            status='paid'
        )
        OrderItem.objects.create(order=renewal_order, journal_subscription=self.journal, quantity=1, price=Decimal('2500.00'))

        grant_journal_access_for_order(renewal_order)
        sub.refresh_from_db()

        expected_end = initial_end + datetime.timedelta(days=365)
        self.assertAlmostEqual(sub.end_date.timestamp(), expected_end.timestamp(), delta=5)
        self.assertTrue(sub.is_valid_now())
        self.assertEqual(sub.order, renewal_order)

    def test_expired_subscription_renewal_grants_fresh_window(self):
        """3. Expired subscription renewal starts a fresh 1-year window from now."""
        past_end = timezone.now() - datetime.timedelta(days=30)
        UserJournalAccess.objects.create(
            user=self.user,
            journal=self.journal,
            access_type='subscription',
            start_date=past_end - datetime.timedelta(days=365),
            end_date=past_end,
            is_active=True
        )

        has_access, _ = check_journal_issue_access(self.user, self.issue1)
        self.assertFalse(has_access)

        renewal_order = Order.objects.create(
            user=self.user,
            full_name='Sub Buyer',
            email='subscriber@example.com',
            total_amount=Decimal('2500.00'),
            status='paid'
        )
        OrderItem.objects.create(order=renewal_order, journal_subscription=self.journal, quantity=1, price=Decimal('2500.00'))

        grant_journal_access_for_order(renewal_order)

        active_sub = UserJournalAccess.objects.filter(
            user=self.user,
            journal=self.journal,
            access_type='subscription',
            is_active=True,
            end_date__gte=timezone.now()
        ).first()
        self.assertIsNotNone(active_sub)
        self.assertTrue(active_sub.is_valid_now())

        has_access_after, _ = check_journal_issue_access(self.user, self.issue1)
        self.assertTrue(has_access_after)

    def test_idempotent_reprocessing(self):
        """4. Reprocessing the same paid order does not create duplicates or extend dates multiple times."""
        order = Order.objects.create(
            user=self.user,
            full_name='Sub Buyer',
            email='subscriber@example.com',
            total_amount=Decimal('2500.00'),
            status='paid'
        )
        OrderItem.objects.create(order=order, journal_subscription=self.journal, quantity=1, price=Decimal('2500.00'))

        grant_journal_access_for_order(order)
        first_sub = UserJournalAccess.objects.get(user=self.user, journal=self.journal, access_type='subscription')
        first_end = first_sub.end_date

        second_run = grant_journal_access_for_order(order)
        self.assertEqual(len(second_run), 1)

        total_subs = UserJournalAccess.objects.filter(user=self.user, journal=self.journal, access_type='subscription').count()
        self.assertEqual(total_subs, 1)

        first_sub.refresh_from_db()
        self.assertEqual(first_sub.end_date, first_end)

    def test_print_only_issue_does_not_grant_digital_access(self):
        """5. Print-only purchases do not create digital UserJournalAccess."""
        order = Order.objects.create(
            user=self.user,
            full_name='Print Buyer',
            email='subscriber@example.com',
            total_amount=Decimal('700.00'),
            status='paid'
        )
        OrderItem.objects.create(
            order=order,
            journal_issue=self.issue1,
            format='print',
            quantity=1,
            price=Decimal('700.00')
        )

        accesses = grant_journal_access_for_order(order)
        self.assertEqual(len(accesses), 0)
        self.assertFalse(UserJournalAccess.objects.filter(user=self.user, issue=self.issue1).exists())

        has_access, _ = check_journal_issue_access(self.user, self.issue1)
        self.assertFalse(has_access)

    def test_digital_and_bundle_issue_orders_grant_no_access(self):
        """6 and 7. Digital and bundle issue items no longer create any entitlement."""
        order_digital = Order.objects.create(
            user=self.user,
            full_name='Digital Buyer',
            email='subscriber@example.com',
            total_amount=Decimal('500.00'),
            status='paid'
        )
        OrderItem.objects.create(
            order=order_digital,
            journal_issue=self.issue1,
            format='digital',
            quantity=1,
            price=Decimal('500.00')
        )
        self.assertEqual(grant_journal_access_for_order(order_digital), [])
        self.assertFalse(UserJournalAccess.objects.filter(user=self.user, issue=self.issue1).exists())

        order_bundle = Order.objects.create(
            user=self.user,
            full_name='Bundle Buyer',
            email='subscriber@example.com',
            total_amount=Decimal('900.00'),
            status='paid'
        )
        OrderItem.objects.create(
            order=order_bundle,
            journal_issue=self.issue2,
            format='bundle',
            quantity=1,
            price=Decimal('900.00')
        )
        self.assertEqual(grant_journal_access_for_order(order_bundle), [])
        self.assertFalse(UserJournalAccess.objects.filter(user=self.user, issue=self.issue2).exists())

        # Neither paid issue order unlocks the complete issue PDF
        self.assertFalse(check_journal_issue_access(self.user, self.issue1)[0])
        self.assertFalse(check_journal_issue_access(self.user, self.issue2)[0])

    def test_legacy_issue_entitlement_does_not_grant_access(self):
        """6b. A pre-existing access_type='issue' record must not unlock a paid issue PDF."""
        UserJournalAccess.objects.create(
            user=self.user,
            journal=self.journal,
            issue=self.issue1,
            access_type='issue',
            start_date=timezone.now(),
            end_date=None,
            is_active=True,
        )
        has_access, reason = check_journal_issue_access(self.user, self.issue1)
        self.assertFalse(has_access)
        self.assertEqual(reason, 'No active journal subscription')
        # A different issue of the same journal is equally locked
        self.assertFalse(check_journal_issue_access(self.user, self.issue2)[0])

    def test_subscription_unlocks_all_issues_of_the_journal(self):
        """6c. The journal subscription is the only paid path to complete issue PDFs."""
        order = Order.objects.create(
            user=self.user,
            full_name='Sub Buyer',
            email='subscriber@example.com',
            total_amount=Decimal('2500.00'),
            status='paid'
        )
        OrderItem.objects.create(order=order, journal_subscription=self.journal, quantity=1, price=Decimal('2500.00'))
        grant_journal_access_for_order(order)

        self.assertTrue(check_journal_issue_access(self.user, self.issue1)[0])
        self.assertTrue(check_journal_issue_access(self.user, self.issue2)[0])

    def test_unpaid_order_grants_no_access(self):
        """8. Pending or failed orders never grant access."""
        order = Order.objects.create(
            user=self.user,
            full_name='Pending Buyer',
            email='subscriber@example.com',
            total_amount=Decimal('2500.00'),
            status='pending'
        )
        OrderItem.objects.create(order=order, journal_subscription=self.journal, quantity=1, price=Decimal('2500.00'))

        accesses = grant_journal_access_for_order(order)
        self.assertEqual(len(accesses), 0)
        self.assertFalse(UserJournalAccess.objects.filter(user=self.user).exists())
class ReleaseReadinessPhase12Tests(TestCase):
    """
    Phase 12 -- End-to-End Release Readiness, Security, and Isolation Tests.
    """

    def setUp(self):
        self.client = APIClient()
        self.customer1 = User.objects.create_user(email='customer1@example.com', password='password123')
        self.customer2 = User.objects.create_user(email='customer2@example.com', password='password123')
        self.staff_user = User.objects.create_user(email='admin@example.com', password='password123', is_staff=True)

        self.category = Category.objects.create(name='Technology', slug='tech', category_type='journals')
        self.journal = Journal.objects.create(
            title='AI Research Letters',
            slug='ai-research-letters',
            issn='9876-5432',
            category=self.category,
            subscription_price_annual=Decimal('3000.00'),
            access_type='Subscription'
        )
        self.issue = JournalIssue.objects.create(
            journal=self.journal,
            volume_number=1,
            issue_number=1,
            title='Volume 1, Issue 1',
            price=Decimal('600.00'),
            price_print=Decimal('800.00'),
            price_bundle=Decimal('1000.00'),
            stock=25,
            publication_date=datetime.date(2026, 2, 1)
        )

    def test_customer_facing_serializer_omits_internal_fulfillment_notes(self):
        """Verify internal staff-only fulfillment_notes are never exposed to customers."""
        order = Order.objects.create(
            user=self.customer1,
            full_name='Customer One',
            email='customer1@example.com',
            total_amount=Decimal('800.00'),
            status='paid',
            fulfillment_status='processing',
            fulfillment_notes='CONFIDENTIAL: Warehouse batch #492, packing delayed.'
        )

        # Authenticated as Customer 1 (owner)
        self.client.force_authenticate(user=self.customer1)
        res_cust = self.client.get(f'/api/commerce/{order.id}/')
        self.assertEqual(res_cust.status_code, status.HTTP_200_OK)
        self.assertNotIn('fulfillment_notes', res_cust.data)

        # Authenticated as Staff user
        self.client.force_authenticate(user=self.staff_user)
        res_staff = self.client.get(f'/api/commerce/{order.id}/')
        self.assertEqual(res_staff.status_code, status.HTTP_200_OK)
        self.assertIn('fulfillment_notes', res_staff.data)
        self.assertEqual(res_staff.data['fulfillment_notes'], 'CONFIDENTIAL: Warehouse batch #492, packing delayed.')

    def test_customer_cannot_access_other_customers_order(self):
        """Verify customer data isolation: Customer 2 cannot access Customer 1's order."""
        order = Order.objects.create(
            user=self.customer1,
            full_name='Customer One',
            email='customer1@example.com',
            total_amount=Decimal('600.00'),
            status='paid'
        )

        self.client.force_authenticate(user=self.customer2)
        res = self.client.get(f'/api/commerce/{order.id}/')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_print_order_initializes_pending_fulfillment_and_no_digital_access(self):
        """Verify print-only order initializes pending fulfillment and grants zero digital access."""
        order = Order.objects.create(
            user=self.customer1,
            full_name='Customer One',
            email='customer1@example.com',
            total_amount=Decimal('800.00'),
            status='paid'
        )
        OrderItem.objects.create(
            order=order,
            journal_issue=self.issue,
            format='print',
            quantity=1,
            price=Decimal('800.00')
        )
        # Verify shipping requirement
        self.assertTrue(order.requires_shipping())

        # Grant access runs
        accesses = grant_journal_access_for_order(order)
        self.assertEqual(len(accesses), 0)
        self.assertFalse(UserJournalAccess.objects.filter(user=self.customer1, issue=self.issue).exists())

    def test_bundle_order_requires_shipping_but_grants_no_digital_access(self):
        """Historical bundle orders still require shipping, but no longer grant digital access."""
        order = Order.objects.create(
            user=self.customer1,
            full_name='Customer One',
            email='customer1@example.com',
            total_amount=Decimal('1000.00'),
            status='paid'
        )
        OrderItem.objects.create(
            order=order,
            journal_issue=self.issue,
            format='bundle',
            quantity=1,
            price=Decimal('1000.00')
        )
        self.assertTrue(order.requires_shipping())

        accesses = grant_journal_access_for_order(order)
        self.assertEqual(len(accesses), 0)
        self.assertFalse(UserJournalAccess.objects.filter(user=self.customer1, issue=self.issue).exists())
        self.assertFalse(check_journal_issue_access(self.customer1, self.issue)[0])


class AdminOrderConsolidationPhase13Tests(TestCase):
    """
    Orders + Fulfillment consolidation -- generic-write lockdown, guarded
    cancellation, and the staff-only narrow status endpoint.
    """

    def setUp(self):
        self.client = APIClient()
        self.customer = User.objects.create_user(email='shopper@example.com', password='password123')
        self.staff_user = User.objects.create_user(email='desk@example.com', password='password123', is_staff=True)

        self.book_category = Category.objects.create(name='Physics', slug='physics', category_type='books')
        self.book = Book.objects.create(
            title='Applied Physics',
            slug='applied-physics',
            author='Dr. Curie',
            category=self.book_category,
            description='Applied physics text',
            price=Decimal('600.00'),
            published_date=datetime.date(2026, 1, 1)
        )

    def _make_order(self, **kwargs):
        defaults = {
            'user': self.customer,
            'full_name': 'Shopper User',
            'email': 'shopper@example.com',
            'total_amount': Decimal('640.00'),
            'status': 'pending',
        }
        defaults.update(kwargs)
        return Order.objects.create(**defaults)

    def _physical_order(self, **kwargs):
        order = self._make_order(**kwargs)
        OrderItem.objects.create(order=order, book=self.book, quantity=1, price=Decimal('600.00'), format='print')
        return order

    # ─── Generic write lockdown (Phase D) ────────────────────────────────

    def test_generic_patch_put_delete_are_disabled(self):
        """Customers cannot rewrite or delete orders through generic endpoints."""
        order = self._physical_order(status='paid')
        self.client.force_authenticate(user=self.customer)

        for method, payload in (
            ('patch', {'total_amount': '0.01', 'fulfillment_status': 'delivered'}),
            ('put', {'total_amount': '0.01', 'status': 'cancelled'}),
        ):
            res = getattr(self.client, method)(f'/api/commerce/{order.id}/', payload, format='json')
            self.assertEqual(res.status_code, status.HTTP_405_METHOD_NOT_ALLOWED, method)

        res_delete = self.client.delete(f'/api/commerce/{order.id}/')
        self.assertEqual(res_delete.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

        # Sensitive fields are untouched
        order.refresh_from_db()
        self.assertEqual(order.total_amount, Decimal('640.00'))
        self.assertEqual(order.status, 'paid')
        self.assertEqual(order.fulfillment_status, 'not_required')

    def test_staff_also_cannot_use_generic_writes(self):
        """The lockdown is method-level: even staff must use the guarded actions."""
        order = self._physical_order()
        self.client.force_authenticate(user=self.staff_user)
        res = self.client.patch(f'/api/commerce/{order.id}/', {'status': 'cancelled'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        order.refresh_from_db()
        self.assertEqual(order.status, 'pending')

    # ─── Guarded cancellation (Phase C) ──────────────────────────────────

    def test_cancel_payment_only_accepts_unpaid_orders(self):
        pending_order = self._make_order(status='pending')
        self.client.force_authenticate(user=self.customer)
        res = self.client.post(f'/api/commerce/{pending_order.id}/cancel_payment/', {'reason': 'abandoned'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        pending_order.refresh_from_db()
        self.assertEqual(pending_order.status, 'cancelled')

    def test_cancel_payment_refuses_paid_orders(self):
        """No silent cancellation of captured payments (refund workflow absent)."""
        paid_order = self._make_order(status='paid')
        self.client.force_authenticate(user=self.customer)
        res = self.client.post(f'/api/commerce/{paid_order.id}/cancel_payment/', format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('refunds', str(res.data['error']).lower())
        paid_order.refresh_from_db()
        self.assertEqual(paid_order.status, 'paid')

    # ─── Narrow staff-only status endpoint (Phase C) ─────────────────────

    def test_update_status_requires_staff(self):
        order = self._make_order()
        self.client.force_authenticate(user=self.customer)
        res = self.client.post(f'/api/commerce/{order.id}/update_status/', {'status': 'cancelled'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_update_status_pending_to_cancelled_persists(self):
        order = self._make_order()
        self.client.force_authenticate(user=self.staff_user)
        res = self.client.post(f'/api/commerce/{order.id}/update_status/', {'status': 'cancelled'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['status'], 'cancelled')
        order.refresh_from_db()
        self.assertEqual(order.status, 'cancelled')

    def test_update_status_cannot_mark_unpaid_order_paid(self):
        """Administrative status changes must never bypass payment verification."""
        order = self._make_order()
        self.client.force_authenticate(user=self.staff_user)
        res = self.client.post(f'/api/commerce/{order.id}/update_status/', {'status': 'paid'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('razorpay', str(res.data['error']).lower())
        order.refresh_from_db()
        self.assertEqual(order.status, 'pending')
        # No entitlements were granted by the rejected attempt
        self.assertFalse(UserJournalAccess.objects.filter(user=self.customer).exists())

    def test_update_status_cannot_cancel_paid_order(self):
        order = self._make_order(status='paid')
        self.client.force_authenticate(user=self.staff_user)
        res = self.client.post(f'/api/commerce/{order.id}/update_status/', {'status': 'cancelled'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        order.refresh_from_db()
        self.assertEqual(order.status, 'paid')

    def test_update_status_defers_logistics_to_fulfillment_desk(self):
        """shipped/delivered status changes are rejected; fulfillment stays authoritative."""
        order = self._physical_order(status='paid')
        self.client.force_authenticate(user=self.staff_user)
        for target in ('shipped', 'delivered'):
            res = self.client.post(f'/api/commerce/{order.id}/update_status/', {'status': target}, format='json')
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST, target)
            self.assertIn('fulfillment', str(res.data['error']).lower())
        order.refresh_from_db()
        self.assertEqual(order.status, 'paid')

    def test_update_status_rejects_invalid_and_unknown_values(self):
        order = self._make_order()
        self.client.force_authenticate(user=self.staff_user)
        for bad in ('refunded', 'processing', 'on_the_moon', ''):
            res = self.client.post(f'/api/commerce/{order.id}/update_status/', {'status': bad}, format='json')
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST, bad)
        order.refresh_from_db()
        self.assertEqual(order.status, 'pending')

    # ─── Fulfillment guard verification (Phase E) ─────────────────────────

    def test_fulfillment_cannot_dispatch_unpaid_order(self):
        order = self._physical_order(status='pending', fulfillment_status='pending')
        self.client.force_authenticate(user=self.staff_user)
        res = self.client.post(
            f'/api/commerce/{order.id}/update_fulfillment/',
            {'fulfillment_status': 'dispatched'},
            format='json'
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('unpaid', str(res.data['error']).lower())
        order.refresh_from_db()
        self.assertEqual(order.fulfillment_status, 'pending')
        self.assertIsNone(order.dispatched_at)

    def test_fulfillment_delivered_state_protection_and_persistence(self):
        order = self._physical_order(status='paid', fulfillment_status='delivered')
        self.client.force_authenticate(user=self.staff_user)
        res = self.client.post(
            f'/api/commerce/{order.id}/update_fulfillment/',
            {'fulfillment_status': 'packed'},
            format='json'
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('cannot be reverted', res.data['error'])
        order.refresh_from_db()
        self.assertEqual(order.fulfillment_status, 'delivered')

    def test_admin_stats_endpoint_is_staff_only(self):
        self.client.force_authenticate(user=self.customer)
        res = self.client.get('/api/commerce/stats/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.staff_user)
        res_staff = self.client.get('/api/commerce/stats/')
        self.assertEqual(res_staff.status_code, status.HTTP_200_OK)
        self.assertIn('total_revenue', res_staff.data)


class OrderContactFieldsRegressionTests(TestCase):
    """Regression for the lost-phone/lost-address bug: the checkout payload sent
    'phone'/'address' but the serializer only declared 'phone_number'/
    'shipping_address', so DRF silently dropped the values and every order was
    stored with a blank phone and street address on its invoice."""

    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(email='contact-test@example.com', password='password123')
        self.category = Category.objects.create(name='Contact Books', slug='contact-books', category_type='books')
        self.book = Book.objects.create(
            title='Contact Regression Handbook',
            slug='contact-regression-handbook',
            author='Dr. Test',
            category=self.category,
            description='x',
            price=Decimal('100.00'),
            published_date=datetime.date(2026, 1, 1)
        )

    def _base_payload(self):
        return {
            'full_name': 'Contact Tester',
            'email': 'contact-test@example.com',
            'city': 'Chennai',
            'postal_code': '601203',
            'country': 'India',
            'payment_method': 'razorpay',
            'items': [{'book': self.book.id, 'quantity': 1, 'format': 'digital'}],
        }

    def test_legacy_phone_and_address_aliases_persist(self):
        """'phone'/'address' keys (old frontend) must populate the real fields."""
        self.client.force_authenticate(user=self.user1)
        payload = {**self._base_payload(), 'phone': '+91 98765 43210', 'address': '22, Anna Nagar, Tamil Nadu'}
        res = self.client.post('/api/commerce/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        order = Order.objects.get(id=res.data['id'])
        # Digits normalized to the last 10 (model validator expects 10 digits)
        self.assertEqual(order.phone_number, '9876543210')
        self.assertEqual(order.shipping_address, '22, Anna Nagar, Tamil Nadu')

    def test_explicit_model_fields_take_precedence_over_aliases(self):
        self.client.force_authenticate(user=self.user1)
        payload = {
            **self._base_payload(),
            'phone_number': '9000000001',
            'shipping_address': 'Explicit Street 1',
            'phone': '9999999999',
            'address': 'Alias Street 2',
        }
        res = self.client.post('/api/commerce/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        order = Order.objects.get(id=res.data['id'])
        self.assertEqual(order.phone_number, '9000000001')
        self.assertEqual(order.shipping_address, 'Explicit Street 1')

    def test_phone_alias_with_garbage_is_rejected_not_dropped(self):
        """Global input-validation rule: an invalid phone alias must fail with
        a structured error instead of being silently stored as a blank phone
        (the old behavior lost the customer's contactability)."""
        self.client.force_authenticate(user=self.user1)
        payload = {**self._base_payload(), 'phone': 'not-a-phone', 'address': 'No Digits Lane'}
        res = self.client.post('/api/commerce/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('phone_number', str(res.data))
        self.assertEqual(Order.objects.count(), 0)

    def test_full_checkout_address_including_state_is_stored(self):
        """Every checkout address component (street, city, state, pin, country)
        must be persisted on its own column so the invoice can format them.
        'state' previously had no Order column and was crammed into the street
        line; it now has a dedicated field."""
        self.client.force_authenticate(user=self.user1)
        payload = {
            **self._base_payload(),
            'phone_number': '9876543210',
            'shipping_address': 'No. 12, Gandhi Street, Perambur',
            'city': 'CHENNAI',
            'state': 'TAMIL NADU',
            'postal_code': '601203',
            'country': 'India',
        }
        res = self.client.post('/api/commerce/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        order = Order.objects.get(id=res.data['id'])
        self.assertEqual(order.shipping_address, 'No. 12, Gandhi Street, Perambur')
        self.assertEqual(order.city, 'CHENNAI')
        self.assertEqual(order.state, 'TAMIL NADU')
        self.assertEqual(order.postal_code, '601203')
        self.assertEqual(order.country, 'India')


class PaymentResultPageIdorRegressionTests(TestCase):
    """Audit C-1 regression: /payment/success|failed|pending/ must never
    expose order PII to anonymous or unauthorized requesters.

    These views used to look up an order by a client-supplied sequential
    ?order_id= and render full_name, email, transaction id and amount to any
    requester. They are now data-free redirect stubs that hand the browser
    back to the authenticated Next.js payment routes.
    """

    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(email='owner@example.com', password='password123')
        self.order = Order.objects.create(
            user=self.owner,
            full_name='Secret Victim Name',
            email='secret-victim@example.com',
            total_amount=Decimal('600.00'),
            status='paid',
            razorpay_payment_id='pay_SECRETTRANSACTION123',
        )

    def _assert_no_pii(self, response):
        body = response.content.decode('utf-8', errors='ignore')
        for needle in ('Secret Victim Name', 'secret-victim@example.com',
                       'pay_SECRETTRANSACTION123', '600.00'):
            self.assertNotIn(needle, body)

    def test_anonymous_success_page_redirects_without_order_data(self):
        res = self.client.get('/payment/success/', {'order_id': self.order.id})
        self.assertEqual(res.status_code, status.HTTP_302_FOUND)
        self.assertIn('/payment/success/', res['Location'])
        self.assertIn(str(self.order.id), res['Location'])
        self._assert_no_pii(res)

    def test_anonymous_failed_page_redirects_without_order_data(self):
        res = self.client.get('/payment/failed/', {'order_id': self.order.id})
        self.assertEqual(res.status_code, status.HTTP_302_FOUND)
        self.assertIn('/payment/failed/', res['Location'])
        self._assert_no_pii(res)

    def test_anonymous_pending_page_redirects_without_order_data(self):
        res = self.client.get('/payment/pending/', {'order_id': self.order.id})
        self.assertEqual(res.status_code, status.HTTP_302_FOUND)
        self.assertIn('/payment/processing/', res['Location'])
        self._assert_no_pii(res)

    def test_nonexistent_order_id_reveals_nothing(self):
        """A guessed sequential id that does not exist must be answered
        identically to one that does — no enumeration oracle."""
        res_missing = self.client.get('/payment/success/', {'order_id': 99999999})
        res_real = self.client.get('/payment/success/', {'order_id': self.order.id})
        self.assertEqual(res_missing.status_code, status.HTTP_302_FOUND)
        self.assertEqual(res_missing.content, res_real.content)
        self.assertNotIn(b'Secret', res_missing.content)

    def test_garbage_order_ids_are_rejected_safely(self):
        for bad_id in ('abc', '1;DROP', '../../etc/passwd', '-5', '0', '   '):
            res = self.client.get('/payment/success/', {'order_id': bad_id})
            self.assertEqual(res.status_code, status.HTTP_302_FOUND)
            self.assertIn('/dashboard/orders', res['Location'])
            self._assert_no_pii(res)

    def test_missing_order_id_falls_back_to_dashboard(self):
        res = self.client.get('/payment/success/')
        self.assertEqual(res.status_code, status.HTTP_302_FOUND)
        self.assertIn('/dashboard/orders', res['Location'])
        self._assert_no_pii(res)

    def test_failed_page_does_not_reflect_client_reason(self):
        """The old view echoed ?reason= straight into HTML (reflection/XSS
        vector). Arbitrary reason text must now be dropped entirely."""
        res = self.client.get(
            '/payment/failed/',
            {'order_id': self.order.id, 'reason': '<script>reason-probe-9x7</script>'},
        )
        self.assertEqual(res.status_code, status.HTTP_302_FOUND)
        body = res.content.decode('utf-8', errors='ignore')
        self.assertNotIn('reason-probe-9x7', body)

    def test_authenticated_non_owner_cannot_extract_data_from_page(self):
        """The redirect stub serves the identical byte-free response to every
        requester, logged in or not — the page itself can never leak another
        customer's order. Real API isolation is covered by
        ReleaseReadinessPhase12Tests.test_customer_cannot_access_other_customers_order.
        """
        intruder = User.objects.create_user(email='intruder@example.com', password='password123')
        self.client.force_authenticate(user=intruder)
        res = self.client.get('/payment/success/', {'order_id': self.order.id})
        self.assertEqual(res.status_code, status.HTTP_302_FOUND)
        self._assert_no_pii(res)


@override_settings(RAZORPAY_KEY_ID='rzp_test_QRONLY', RAZORPAY_KEY_SECRET='qr-secret')
class QrPaymentVerificationPhaseTests(TestCase):
    """Audit M-2 regression: check_qr_payment must server-side verify amount,
    currency, payment-ID uniqueness and order state before flipping to paid —
    never on captured status alone."""

    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(email='qr-user1@example.com', password='password123')
        self.user2 = User.objects.create_user(email='qr-user2@example.com', password='password123')
        self.journal_category = Category.objects.create(name='QR Journals', slug='qr-journals', category_type='journals')
        self.journal1 = Journal.objects.create(
            title='QR Research Letters', slug='qr-research-letters', issn='7777-8888',
            category=self.journal_category, subscription_price_annual=Decimal('1200.00'),
            access_type='Subscription')

    def _pending_order(self):
        order = Order.objects.create(
            user=self.user1, full_name='QR User', email='qr-user1@example.com',
            total_amount=Decimal('1200.00'), status='pending',
            payment_method='upi', razorpay_order_id='qr_TESTQR123')
        OrderItem.objects.create(order=order, journal_subscription=self.journal1,
                                 quantity=1, price=Decimal('1200.00'))
        return order

    def _mock_qr_list(self, mock_get, items, code=200):
        resp = MagicMock()
        resp.status_code = code
        resp.json.return_value = {'items': items}
        mock_get.return_value = resp

    @patch('requests.get')
    def test_captured_payment_with_correct_amount_paid_and_grants_access(self, mock_get):
        order = self._pending_order()
        self._mock_qr_list(mock_get, [
            {'id': 'pay_qr_ok', 'status': 'captured', 'amount': 120000, 'currency': 'INR'}])
        self.client.force_authenticate(user=self.user1)
        with patch('orders.views.generate_invoice') as mock_invoice:
            res = self.client.get(f'/api/commerce/{order.id}/check_qr_payment/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['status'], 'success')
        order.refresh_from_db()
        self.assertEqual(order.status, 'paid')
        self.assertEqual(order.razorpay_payment_id, 'pay_qr_ok')
        self.assertTrue(UserJournalAccess.objects.filter(user=self.user1, journal=self.journal1).exists())
        self.assertTrue(InvoiceJob.objects.filter(order=order).exists())

    @patch('requests.get')
    def test_captured_wrong_amount_does_not_mark_paid(self, mock_get):
        order = self._pending_order()
        self._mock_qr_list(mock_get, [
            {'id': 'pay_qr_short', 'status': 'captured', 'amount': 100, 'currency': 'INR'}])
        self.client.force_authenticate(user=self.user1)
        with patch('orders.views.generate_invoice') as mock_invoice:
            res = self.client.get(f'/api/commerce/{order.id}/check_qr_payment/')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        order.refresh_from_db()
        self.assertEqual(order.status, 'pending')
        self.assertFalse(UserJournalAccess.objects.filter(user=self.user1).exists())
        mock_invoice.assert_not_called()

    @patch('requests.get')
    def test_captured_wrong_currency_does_not_mark_paid(self, mock_get):
        order = self._pending_order()
        self._mock_qr_list(mock_get, [
            {'id': 'pay_qr_usd', 'status': 'captured', 'amount': 120000, 'currency': 'USD'}])
        self.client.force_authenticate(user=self.user1)
        res = self.client.get(f'/api/commerce/{order.id}/check_qr_payment/')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        order.refresh_from_db()
        self.assertEqual(order.status, 'pending')

    @patch('requests.get')
    def test_reused_payment_id_on_another_order_is_rejected(self, mock_get):
        victim = self._pending_order()
        # Another order already holds this Razorpay payment id.
        other = Order.objects.create(
            user=self.user2, full_name='Other', email='qr-user2@example.com',
            total_amount=Decimal('1200.00'), status='paid',
            razorpay_payment_id='pay_qr_reused')
        self._mock_qr_list(mock_get, [
            {'id': 'pay_qr_reused', 'status': 'captured', 'amount': 120000, 'currency': 'INR'}])
        self.client.force_authenticate(user=self.user1)
        res = self.client.get(f'/api/commerce/{victim.id}/check_qr_payment/')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        victim.refresh_from_db()
        self.assertEqual(victim.status, 'pending')

    @patch('requests.get')
    def test_duplicate_polling_is_idempotent(self, mock_get):
        order = self._pending_order()
        self._mock_qr_list(mock_get, [
            {'id': 'pay_qr_once', 'status': 'captured', 'amount': 120000, 'currency': 'INR'}])
        self.client.force_authenticate(user=self.user1)
        with patch('orders.views.generate_invoice') as mock_invoice:
            first = self.client.get(f'/api/commerce/{order.id}/check_qr_payment/')
            # Second poll: short-circuits on the already-paid branch — the
            # Razorpay API is not even consulted and no second invoice runs.
            second = self.client.get(f'/api/commerce/{order.id}/check_qr_payment/')
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(second.data['status'], 'success')
        self.assertEqual(InvoiceJob.objects.filter(order=order).count(), 1)
        self.assertEqual(
            UserJournalAccess.objects.filter(user=self.user1, journal=self.journal1).count(), 1)

    @patch('requests.get')
    def test_uncaptured_payments_stay_pending(self, mock_get):
        order = self._pending_order()
        self._mock_qr_list(mock_get, [
            {'id': 'pay_qr_fail', 'status': 'failed', 'amount': 120000, 'currency': 'INR'},
            {'id': 'pay_qr_created', 'status': 'created', 'amount': 120000, 'currency': 'INR'}])
        self.client.force_authenticate(user=self.user1)
        res = self.client.get(f'/api/commerce/{order.id}/check_qr_payment/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['status'], 'pending')
        order.refresh_from_db()
        self.assertEqual(order.status, 'pending')

    @patch('requests.get')
    def test_non_owner_cannot_poll_anothers_qr_order(self, mock_get):
        order = self._pending_order()
        self._mock_qr_list(mock_get, [
            {'id': 'pay_qr_ok', 'status': 'captured', 'amount': 120000, 'currency': 'INR'}])
        self.client.force_authenticate(user=self.user2)
        res = self.client.get(f'/api/commerce/{order.id}/check_qr_payment/')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        order.refresh_from_db()
        self.assertEqual(order.status, 'pending')

    @patch('requests.get')
    def test_order_without_linked_qr_id_is_not_paid(self, mock_get):
        """A client-set non-QR razorpay id (e.g. a card order) must not be
        treated as a UPI QR match — no server-side QR association, no pay."""
        order = self._pending_order()
        order.razorpay_order_id = 'order_not_a_qr'
        order.save()
        self.client.force_authenticate(user=self.user1)
        res = self.client.get(f'/api/commerce/{order.id}/check_qr_payment/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['status'], 'pending')
        mock_get.assert_not_called()
        order.refresh_from_db()
        self.assertEqual(order.status, 'pending')


class SharedCacheBoundaryRegressionTests(TestCase):
    """Audit M-9 regression: public catalog responses may be cached safely, but
    anything private must be denied to anonymous callers (so a shared cache can
    never serve it) and unpublished content must never enter the cacheable
    public article responses."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(email='cache-user@example.com', password='password123')
        self.other = User.objects.create_user(email='cache-other@example.com', password='password123')
        self.category = Category.objects.create(name='Cache Cats', slug='cache-cats', category_type='books')
        self.journal_category = Category.objects.create(
            name='Cache Journals', slug='cache-journals', category_type='journals')
        self.journal = Journal.objects.create(
            title='Cache Letters', slug='cache-letters', issn='9999-0000',
            category=self.journal_category,
            subscription_price_annual=Decimal('1200.00'))

    def _order(self, owner):
        order = Order.objects.create(
            user=owner, full_name='Cache User', email=owner.email,
            total_amount=Decimal('100.00'), status='paid', payment_method='upi')
        OrderItem.objects.create(order=order, journal_subscription=self.journal,
                                 quantity=1, price=Decimal('100.00'))
        return order

    # ---- public surfaces: safe to cache ----

    def test_public_catalog_lists_are_anonymous_readable(self):
        for url in ('/api/publications/books/', '/api/publications/journals/',
                    '/api/publications/categories/'):
            res = self.client.get(url)
            self.assertEqual(res.status_code, status.HTTP_200_OK, url)

    def test_draft_article_is_absent_from_public_article_flows(self):
        from publications.models import JournalArticle
        draft = JournalArticle.objects.create(
            title='Secret Unpublished Draft', slug='secret-unpublished-draft',
            journal=self.journal, status='draft')
        published = JournalArticle.objects.create(
            title='Open Published Paper', slug='open-published-paper',
            journal=self.journal, status='published')

        listing = self.client.get('/api/publications/articles/')
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        results = listing.data['results'] if isinstance(listing.data, dict) and 'results' in listing.data else listing.data
        slugs = [row.get('slug') for row in results]
        self.assertNotIn('secret-unpublished-draft', slugs)
        self.assertIn('open-published-paper', slugs)

        # Direct retrieval of the draft by anonymous users is a 404, not a hit
        # that a shared cache could memorize.
        res = self.client.get(f'/api/publications/articles/{draft.slug}/')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        ok = self.client.get(f'/api/publications/articles/{published.slug}/')
        self.assertEqual(ok.status_code, status.HTTP_200_OK)

    # ---- private surfaces: must not be anonymously servable ----

    def test_order_list_and_detail_denied_to_anonymous(self):
        self._order(self.user)
        list_res = self.client.get('/api/commerce/')
        self.assertIn(list_res.status_code, (401, 403))
        detail_res = self.client.get('/api/commerce/1/')
        self.assertIn(detail_res.status_code, (401, 403))

    def test_profile_and_user_access_denied_to_anonymous(self):
        self.assertIn(self.client.get('/api/users/profile/').status_code, (401, 403))
        self.assertIn(self.client.get('/api/publications/user-access/').status_code, (401, 403))

    def test_authenticated_order_list_is_scoped_to_owner(self):
        mine = self._order(self.user)
        theirs = self._order(self.other)
        self.client.force_authenticate(user=self.user)
        res = self.client.get('/api/commerce/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data['results'] if isinstance(res.data, dict) and 'results' in res.data else res.data
        ids = {row['id'] for row in results}
        self.assertIn(mine.id, ids)
        self.assertNotIn(theirs.id, ids)


@override_settings(RAZORPAY_KEY_ID='rzp_test_CARD', RAZORPAY_KEY_SECRET='card-secret')
class RazorpayCardVerificationAttackTests(TestCase):
    """Phase-2 §4 attack cases for the card verify_razorpay endpoint: an order
    is flipped to 'paid' ONLY on a genuine, correctly-valued, single-use
    signature verified with our own keys. Amount mismatch, invalid signature,
    cross-order replay, anonymous and non-owner callers must ALL fail without
    granting payment status or journal entitlements."""

    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(email='card-owner@example.com', password='password123')
        self.intruder = User.objects.create_user(email='card-intruder@example.com', password='password123')
        cat = Category.objects.create(name='Card Journals', slug='card-journals', category_type='journals')
        self.journal = Journal.objects.create(
            title='Card Research', slug='card-research', issn='2468-1357',
            category=cat, subscription_price_annual=Decimal('1200.00'), access_type='Subscription')

    def _pending_order(self, owner=None, amount=Decimal('1200.00')):
        owner = owner or self.owner
        order = Order.objects.create(
            user=owner, full_name='Card Owner', email=owner.email,
            total_amount=amount, status='pending', razorpay_order_id='order_local_abc')
        OrderItem.objects.create(order=order, journal_subscription=self.journal,
                                 quantity=1, price=amount)
        return order

    @patch('orders.views.razorpay.Client')
    def test_amount_mismatch_does_not_mark_paid(self, mock_client):
        inst = mock_client.return_value
        inst.utility.verify_payment_signature.return_value = True
        inst.payment.fetch.return_value = {'amount': 1, 'currency': 'INR'}  # 1 paise, not 120000
        order = self._pending_order()
        self.client.force_authenticate(user=self.owner)
        with patch('orders.views.generate_invoice') as inv:
            res = self.client.post(f'/api/commerce/{order.id}/verify_razorpay/', {
                'razorpay_order_id': 'order_local_abc',
                'razorpay_payment_id': 'pay_amt', 'razorpay_signature': 'sig'})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        order.refresh_from_db()
        self.assertEqual(order.status, 'pending')
        inv.assert_not_called()
        self.assertFalse(UserJournalAccess.objects.filter(user=self.owner).exists())

    @patch('orders.views.razorpay.Client')
    def test_invalid_signature_does_not_mark_paid_and_leaks_no_detail(self, mock_client):
        inst = mock_client.return_value
        inst.utility.verify_payment_signature.side_effect = Exception('raw provider internals 9x7')
        order = self._pending_order()
        self.client.force_authenticate(user=self.owner)
        res = self.client.post(f'/api/commerce/{order.id}/verify_razorpay/', {
            'razorpay_order_id': 'order_local_abc',
            'razorpay_payment_id': 'pay_bad', 'razorpay_signature': 'sig'})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        body = str(res.data)
        self.assertNotIn('raw provider internals 9x7', body)  # no SDK error echoed to client
        order.refresh_from_db()
        self.assertNotEqual(order.status, 'paid')
        self.assertFalse(UserJournalAccess.objects.filter(user=self.owner).exists())

    @patch('orders.views.razorpay.Client')
    def test_replayed_payment_id_on_another_order_rejected(self, mock_client):
        # A different order already consumed this Razorpay payment id.
        prior = self._pending_order()
        prior.status = 'paid'
        prior.razorpay_payment_id = 'pay_replay'
        prior.save()
        victim = self._pending_order()
        inst = mock_client.return_value
        inst.utility.verify_payment_signature.return_value = True
        inst.payment.fetch.return_value = {'amount': 120000, 'currency': 'INR'}
        self.client.force_authenticate(user=self.owner)
        with patch('orders.views.generate_invoice') as inv:
            res = self.client.post(f'/api/commerce/{victim.id}/verify_razorpay/', {
                'razorpay_order_id': 'order_local_abc',
                'razorpay_payment_id': 'pay_replay', 'razorpay_signature': 'sig'})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        victim.refresh_from_db()
        self.assertEqual(victim.status, 'pending')
        inv.assert_not_called()

    def test_anonymous_verify_is_unauthorized(self):
        order = self._pending_order()
        res = self.client.post(f'/api/commerce/{order.id}/verify_razorpay/', {
            'razorpay_order_id': 'order_local_abc',
            'razorpay_payment_id': 'pay_x', 'razorpay_signature': 'sig'})
        self.assertIn(res.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))
        order.refresh_from_db()
        self.assertEqual(order.status, 'pending')

    @patch('orders.views.razorpay.Client')
    def test_non_owner_cannot_verify_anothers_order(self, mock_client):
        order = self._pending_order(owner=self.owner)
        self.client.force_authenticate(user=self.intruder)
        res = self.client.post(f'/api/commerce/{order.id}/verify_razorpay/', {
            'razorpay_order_id': 'order_local_abc',
            'razorpay_payment_id': 'pay_x', 'razorpay_signature': 'sig'})
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        order.refresh_from_db()
        self.assertEqual(order.status, 'pending')

    def test_status_cannot_be_manually_set_to_paid_even_by_staff(self):
        order = self._pending_order()
        staff = User.objects.create_user(email='card-staff@example.com', password='password123', is_staff=True)
        self.client.force_authenticate(user=staff)
        res = self.client.post(f'/api/commerce/{order.id}/update_status/', {'status': 'paid'})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        order.refresh_from_db()
        self.assertEqual(order.status, 'pending')

    def test_simulate_payment_blocked_when_not_debug(self):
        order = self._pending_order()
        self.client.force_authenticate(user=self.owner)
        # Test settings run with DEBUG=False; the dev-only shortcut must be
        # refused outright so it can never mark an order paid in production.
        with override_settings(DEBUG=False):
            res = self.client.post(f'/api/commerce/{order.id}/simulate_payment/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        order.refresh_from_db()
        self.assertEqual(order.status, 'pending')


class PrivateNoStoreCacheHeaderPhase2Tests(TestCase):
    """Phase 2 §8: every per-user/private API response must explicitly declare
    Cache-Control: no-store (+ Vary on credentials) so a misconfigured shared
    cache in front of the API can never store one customer's data and serve it
    to another — while public catalog responses stay cacheable (no header)."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(email='hdr-user@example.com', password='password123')
        self.journal_category = Category.objects.create(
            name='Hdr Journals', slug='hdr-journals', category_type='journals')
        self.journal = Journal.objects.create(
            title='Hdr Letters', slug='hdr-letters', issn='7777-0001',
            category=self.journal_category, subscription_price_annual=Decimal('1200.00'))
        self.issue = JournalIssue.objects.create(
            journal=self.journal, title='Vol 1', volume_number=1, issue_number=1,
            publication_date=datetime.date(2026, 1, 1), price=Decimal('200.00'))
        self.article = JournalArticle.objects.create(
            journal=self.journal, issue=self.issue, title='Hdr Article',
            slug='hdr-article', status='published')

    def _order(self, status_value='pending'):
        order = Order.objects.create(
            user=self.user, full_name='Hdr User', email=self.user.email,
            total_amount=Decimal('100.00'), status=status_value, payment_method='upi')
        OrderItem.objects.create(order=order, journal_subscription=self.journal,
                                 quantity=1, price=Decimal('100.00'))
        return order

    def test_order_list_and_detail_are_no_store(self):
        order = self._order('paid')
        self.client.force_authenticate(user=self.user)
        for url in ('/api/commerce/', f'/api/commerce/{order.id}/'):
            res = self.client.get(url)
            self.assertEqual(res.status_code, status.HTTP_200_OK, url)
            self.assertEqual(res['Cache-Control'], 'no-store', url)
            self.assertIn('Authorization', res.get('Vary', ''), url)

    def test_issue_pdf_denial_is_no_store(self):
        # Anonymous caller is denied (401) — the denial itself carries the
        # subscription reason, so it must not be shareable either.
        res = self.client.get(f'/api/publications/issues/{self.issue.id}/pdf/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(res['Cache-Control'], 'no-store')

    def test_article_access_state_is_no_store(self):
        res = self.client.get(f'/api/publications/articles/{self.article.id}/access/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res['Cache-Control'], 'no-store')

    def test_article_fulltext_denial_is_no_store(self):
        res = self.client.get(f'/api/publications/articles/{self.article.id}/fulltext/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(res['Cache-Control'], 'no-store')

    def test_chapter_section_content_is_no_store(self):
        from publications.models import BookChapter, ChapterSection
        book_category = Category.objects.create(name='Hdr Books', slug='hdr-books', category_type='books')
        book = Book.objects.create(
            title='Hdr Book', slug='hdr-book', author='A', category=book_category,
            price=Decimal('100.00'), published_date=datetime.date(2026, 1, 1))
        chapter = BookChapter.objects.create(
            book=book, title='Hdr Chapter', slug='hdr-chapter', status='published',
            access_mode='paid')
        section = ChapterSection.objects.create(
            chapter=chapter, title='S1', display_order=1, preview_content='preview',
            full_content='SECRET BODY', status='published')
        res = self.client.get(
            f'/api/publications/books/{book.slug}/chapters/{chapter.slug}/sections/{section.id}/content/')
        self.assertIn(res.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))
        self.assertEqual(res['Cache-Control'], 'no-store')

    def test_invoice_endpoint_is_no_store(self):
        from rest_framework_simplejwt.tokens import RefreshToken
        order = self._order('pending')  # pending => no invoice generation attempt
        token = str(RefreshToken.for_user(self.user).access_token)
        res = self.client.get(f'/api/commerce/{order.id}/invoice/',
                              HTTP_AUTHORIZATION=f'Bearer {token}')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(res['Cache-Control'], 'no-store')

    def test_public_catalog_responses_stay_cacheable(self):
        # No explicit no-store on public list/detail — the frontend legitimately
        # caches these (ISR revalidate); the fix must not have degraded them.
        for url in ('/api/publications/books/', '/api/publications/journals/',
                    f'/api/publications/books/{"nonexistent-slug"}/'):
            res = self.client.get(url)
            self.assertNotEqual(res.get('Cache-Control'), 'no-store', url)


@override_settings(RAZORPAY_KEY_ID='rzp_test_LEAK', RAZORPAY_KEY_SECRET='leak-secret')
class RazorpayErrorLeakHardeningTests(TestCase):
    """Insecure-defaults audit finding 1 (debug leakage).

    Order creation and the UPI QR flow returned the raw Razorpay SDK message /
    gateway response body in their error payloads. The sibling verify path was
    already hardened (see test_invalid_signature_does_not_mark_paid_and_leaks_no_detail);
    these three were the ones left behind. Gateway detail belongs in the server
    log only — never in a client-visible response.
    """

    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(email='leak-owner@example.com', password='password123')
        cat = Category.objects.create(name='Leak Journals', slug='leak-journals', category_type='journals')
        self.journal = Journal.objects.create(
            title='Leak Studies', slug='leak-studies', issn='2468-1357',
            category=cat, subscription_price_annual=Decimal('900.00'), access_type='Subscription')

    def _pending_order(self):
        order = Order.objects.create(
            user=self.owner, full_name='Leak Owner', email=self.owner.email,
            total_amount=Decimal('900.00'), status='pending')
        OrderItem.objects.create(order=order, journal_subscription=self.journal,
                                 quantity=1, price=Decimal('900.00'))
        return order

    @patch('orders.views.razorpay.Client')
    def test_initiate_razorpay_failure_leaks_no_gateway_text(self, mock_client):
        mock_client.return_value.order.create.side_effect = Exception('order-internals-3f9')
        order = self._pending_order()
        self.client.force_authenticate(user=self.owner)
        res = self.client.post(f'/api/commerce/{order.id}/initiate_razorpay/')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertNotIn('order-internals-3f9', str(res.data))
        order.refresh_from_db()
        self.assertIsNone(order.razorpay_order_id)

    @patch('requests.post')
    def test_qr_failure_leaks_no_gateway_body(self, mock_post):
        # Non-2xx from the QR API: res.text is logged, not echoed.
        mock_post.return_value = MagicMock(status_code=502, text='qr-body-internals-6h1')
        order = self._pending_order()
        self.client.force_authenticate(user=self.owner)
        res = self.client.post(f'/api/commerce/{order.id}/generate_qr_code/')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertNotIn('qr-body-internals-6h1', str(res.data))

    @patch('requests.post')
    def test_qr_exception_leaks_no_connection_internals(self, mock_post):
        # Raised exception: can name internal hosts/connection details.
        mock_post.side_effect = Exception('HTTPSConnectionPool(host=api.razorpay.com) qr-conn-5t2')
        order = self._pending_order()
        self.client.force_authenticate(user=self.owner)
        res = self.client.post(f'/api/commerce/{order.id}/generate_qr_code/')
        self.assertEqual(res.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertNotIn('qr-conn-5t2', str(res.data))
        self.assertNotIn('HTTPSConnectionPool', str(res.data))

