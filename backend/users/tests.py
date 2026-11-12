"""Tests for the admin invitation & account activation system.

Covers: invitation creation (permissions, duplicates, roles), branded email
delivery and failure handling, token lifecycle (resend/revoke/expiry/reuse),
activation and login, privilege-escalation guards, deactivation, and audit
logging. The Django test runner swaps EMAIL_BACKEND for the in-memory locmem
backend, so mail.outbox assertions reflect real send_invitation_email() calls.
"""
import re
from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from .models import AdminAuditEvent, AdminInvitation, User
from .roles import permissions_for_role, ALL_SECTION_KEYS

# High enough that throttling never interferes with functional assertions.
NO_THROTTLE_RATES = {
    'invitation-validate': '100000/min',
    'invitation-accept': '100000/min',
    'password-reset': '100000/min',
    # Login brute-force throttle (users/throttles.py FailedLoginThrottle):
    # functional classes below run many logins from one IP; only the dedicated
    # LoginThrottleTests exercise the real limiting behaviour.
    'login': '100000/min',
    'login-admin': '100000/min',
}

TOKEN_RE = re.compile(r'token=([A-Za-z0-9_\-]+)')


def extract_token_from_mail():
    """Pull the raw activation token out of the last sent invitation email."""
    mail = __import__('django').core.mail.outbox[-1]
    html = mail.alternatives[0][0]
    return TOKEN_RE.search(html).group(1)


def make_client():
    return APIClient(HTTP_HOST='localhost')


def bearer(client, token):
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
    return client


@override_settings(THROTTLE_RATES=NO_THROTTLE_RATES, FRONTEND_URL='https://app.mmsrpublications.test')
class InviteTestBase(TestCase):
    """Shared fixtures + helpers for the invitation test classes."""

    def setUp(self):
        self.super_admin = User.objects.create_superuser(
            email='chief@mmsr.com', password='Str3ng-Chief-Pass!')
        self.staff = User.objects.create_user(
            email='editor@mmsr.com', password='Ed1t0r-Pass!x', is_staff=True)
        self.client = make_client()

    def invite(self, payload=None, as_user='super'):
        body = {
            'full_name': 'Dr. Priya Raman',
            'email': 'priya@institution.edu',
            'role': 'editorial_admin',
            'department': 'Editorial',
            'phone': '9876543210',
            'notes': 'Invited for the JSR journal.',
        }
        body.update(payload or {})
        self.client.credentials()  # start anonymous
        url = reverse('admin-invitations')
        if as_user == 'anon':
            return self.client.post(url, body, format='json')
        email = 'chief@mmsr.com' if as_user == 'super' else 'editor@mmsr.com'
        password = 'Str3ng-Chief-Pass!' if as_user == 'super' else 'Ed1t0r-Pass!x'
        login = self.client.post(reverse('admin-login'),
                                 {'email': email, 'password': password}, format='json')
        return self.client.post(url, body, format='json',
                                HTTP_AUTHORIZATION=f'Bearer {login.data["tokens"]["access"]}')

    def _super_auth(self):
        login = self.client.post(reverse('admin-login'),
                                 {'email': 'chief@mmsr.com', 'password': 'Str3ng-Chief-Pass!'},
                                 format='json')
        return f'Bearer {login.data["tokens"]["access"]}'


class InvitationCreateTests(InviteTestBase):

    def test_super_admin_can_invite(self):
        resp = self.invite()
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertIn('Invitation sent', resp.data['message'])
        invitation = AdminInvitation.objects.get(pk=resp.data['invitation']['id'])
        self.assertEqual(invitation.status, AdminInvitation.Status.PENDING)
        self.assertIsNotNone(invitation.sent_at)

    def test_anonymous_cannot_invite(self):
        self.assertEqual(self.invite(as_user='anon').status_code,
                         status.HTTP_401_UNAUTHORIZED)

    def test_plain_staff_cannot_invite(self):
        resp = self.invite(as_user='staff')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    # ── validation ─────────────────────────────────────────────────────

    def test_invalid_role_rejected(self):
        resp = self.invite({'role': 'root_overlord'})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('role', resp.data)

    def test_duplicate_existing_admin_handled(self):
        self.invite({'email': 'editor@mmsr.com'})
        resp = self.invite({'email': 'editor@mmsr.com'})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(AdminInvitation.objects.filter(email__iexact='editor@mmsr.com').count(), 0)

    def test_duplicate_pending_invitation_returns_409(self):
        first = self.invite()
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        resp = self.invite()
        self.assertEqual(resp.status_code, status.HTTP_409_CONFLICT)
        self.assertIn('Resend', resp.data['email'][0])

    # ── account state before activation ────────────────────────────────

    def test_account_inactive_with_unusable_password_until_accepted(self):
        resp = self.invite()
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email='priya@institution.edu')
        self.assertFalse(user.is_active)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.has_usable_password())

    # ── token storage ──────────────────────────────────────────────────

    def test_raw_token_never_stored_plaintext(self):
        self.invite()
        raw = extract_token_from_mail()
        invitation = AdminInvitation.objects.get(email='priya@institution.edu')
        self.assertNotEqual(invitation.token_hash, raw)
        self.assertNotIn(raw, invitation.token_hash)
        self.assertEqual(len(invitation.token_hash), 64)  # SHA-256 hex

    # ── email content ──────────────────────────────────────────────────

    def test_invitation_email_content(self):
        import django.core.mail as mailmod
        mailmod.outbox = []
        self.invite()
        self.assertEqual(len(mailmod.outbox), 1)
        mail = mailmod.outbox[0]
        self.assertEqual(mail.subject, 'Invitation to MMSR Publications Admin Portal')
        self.assertEqual(mail.to, ['priya@institution.edu'])
        html = mail.alternatives[0][0]
        # Branded + informative
        self.assertIn('MMSR PUBLICATIONS', html)
        self.assertIn('Editorial Admin', html)
        self.assertIn('Security notice', html)
        self.assertIn('Accept Invitation', html)
        # Canonical frontend URL — never a Host-derived one
        self.assertIn('https://app.mmsrpublications.test/admin/accept-invitation?token=', html)
        # No plaintext password material anywhere in the email
        self.assertNotIn('Str3ng-Chief-Pass!', str(mail.body) + html)
        low = html.lower()
        self.assertNotIn('set_password', low)

    def test_notes_are_not_emailed(self):
        import django.core.mail as mailmod
        mailmod.outbox = []
        self.invite({'notes': 'SECRET-INTERNAL-NOTE-9931'})
        joined = str(mailmod.outbox[0].body) + str(mailmod.outbox[0].alternatives)
        self.assertNotIn('SECRET-INTERNAL-NOTE-9931', joined)

    # ── honest email-failure handling ──────────────────────────────────

    @patch('users.views.send_invitation_email', return_value=False)
    def test_email_failure_returns_502_and_keeps_pending_invitation(self, _mock):
        resp = self.invite()
        self.assertEqual(resp.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertIn('could NOT be delivered', resp.data['error'])
        invitation = AdminInvitation.objects.get(pk=resp.data['invitation_id'])
        self.assertEqual(invitation.status, AdminInvitation.Status.PENDING)
        self.assertIsNone(invitation.sent_at)
        # Retry after the outage: no duplicate account, resend works.
        with patch('users.views.send_invitation_email', return_value=True):
            retry = self.client.post(
                reverse('invitation-resend', args=[invitation.id]), format='json',
                HTTP_AUTHORIZATION=self._super_auth())
        self.assertEqual(retry.status_code, status.HTTP_200_OK)
        self.assertEqual(User.objects.filter(email='priya@institution.edu').count(), 1)

    # ── audit trail ────────────────────────────────────────────────────
    
    def test_audit_events_recorded_on_invite(self):
        self.invite()
        target = User.objects.get(email='priya@institution.edu')
        actions = set(AdminAuditEvent.objects.filter(target=target)
                      .values_list('action', flat=True))
        self.assertIn(AdminAuditEvent.Action.INVITATION_CREATED, actions)
        self.assertIn(AdminAuditEvent.Action.INVITATION_SENT, actions)

    def test_audit_never_contains_token_or_password(self):
        self.invite()
        raw = extract_token_from_mail()
        for event in AdminAuditEvent.objects.all():
            self.assertNotIn(raw, str(event.detail))
            self.assertNotIn('password', str(event.detail).lower())


class InvitationLifecycleTests(InviteTestBase):
    """Token lifecycle: validate, resend (old link dies), revoke, expiry,
    reuse protection, and activation."""

    def create_invitation(self):
        resp = self.invite()
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        return AdminInvitation.objects.get(pk=resp.data['invitation']['id'])

    # ── validation endpoint ────────────────────────────────────────────

    def test_validate_accepts_live_token(self):
        invitation = self.create_invitation()
        raw = extract_token_from_mail()
        resp = self.client.get(reverse('invitation-validate'), {'token': raw})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data['valid'])
        self.assertEqual(resp.data['email'], 'priya@institution.edu')
        self.assertEqual(resp.data['role'], 'editorial_admin')

    def test_validate_rejects_garbage_token(self):
        self.create_invitation()
        resp = self.client.get(reverse('invitation-validate'), {'token': 'not-a-real-token'})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        # Generic message — no enumeration of why it failed
        self.assertIn('invalid, expired, or has already been used', resp.data['error'])

    # ── resend invalidates the previous token ──────────────────────────

    def test_resend_invalidates_old_token(self):
        import django.core.mail as mailmod
        invitation = self.create_invitation()
        old_token = extract_token_from_mail()

        mailmod.outbox = []
        resp = self.client.post(reverse('invitation-resend', args=[invitation.id]),
                                format='json', HTTP_AUTHORIZATION=self._super_auth())
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        new_token = extract_token_from_mail()
        self.assertNotEqual(old_token, new_token)

        # Old link is dead
        dead = self.client.get(reverse('invitation-validate'), {'token': old_token})
        self.assertEqual(dead.status_code, status.HTTP_400_BAD_REQUEST)
        # New link works
        live = self.client.get(reverse('invitation-validate'), {'token': new_token})
        self.assertEqual(live.status_code, status.HTTP_200_OK)

    def test_resend_rejected_for_accepted_invitation(self):
        invitation = self.create_invitation()
        raw = extract_token_from_mail()
        self.client.post(reverse('invitation-accept'),
                         {'token': raw, 'password': 'Str0ng-Act1vate-Pw!'}, format='json')
        resp = self.client.post(reverse('invitation-resend', args=[invitation.id]),
                                format='json', HTTP_AUTHORIZATION=self._super_auth())
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    # ── revoke kills the link immediately ──────────────────────────────

    def test_revoke_invalidates_token(self):
        invitation = self.create_invitation()
        raw = extract_token_from_mail()
        resp = self.client.post(reverse('invitation-revoke', args=[invitation.id]),
                                format='json', HTTP_AUTHORIZATION=self._super_auth())
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        invitation.refresh_from_db()
        self.assertEqual(invitation.status, AdminInvitation.Status.REVOKED)
        self.assertEqual(invitation.token_hash, '')
        dead = self.client.get(reverse('invitation-validate'), {'token': raw})
        self.assertEqual(dead.status_code, status.HTTP_400_BAD_REQUEST)
        cannot_accept = self.client.post(reverse('invitation-accept'),
                                         {'token': raw, 'password': 'Str0ng-Act1vate-Pw!'},
                                         format='json')
        self.assertEqual(cannot_accept.status_code, status.HTTP_400_BAD_REQUEST)

    # ── expiry ─────────────────────────────────────────────────────────

    def test_expired_invitation_rejected(self):
        invitation = self.create_invitation()
        raw = extract_token_from_mail()
        AdminInvitation.objects.filter(pk=invitation.pk).update(
            expires_at=timezone.now() - timedelta(minutes=1))
        self.assertEqual(self.client.get(reverse('invitation-validate'),
                                         {'token': raw}).status_code,
                         status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.client.post(reverse('invitation-accept'),
                                          {'token': raw, 'password': 'Str0ng-Act1vate-Pw!'},
                                          format='json').status_code,
                         status.HTTP_400_BAD_REQUEST)
        invitation.refresh_from_db()
        self.assertEqual(invitation.status, AdminInvitation.Status.PENDING)  # untouched

    # ── password validation on accept ──────────────────────────────────

    def test_weak_password_rejected_account_stays_inactive(self):
        invitation = self.create_invitation()
        raw = extract_token_from_mail()
        resp = self.client.post(reverse('invitation-accept'),
                                {'token': raw, 'password': '123456'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        user = User.objects.get(email='priya@institution.edu')
        self.assertFalse(user.is_active)
        invitation.refresh_from_db()
        self.assertEqual(invitation.status, AdminInvitation.Status.PENDING)

    # ── activation ─────────────────────────────────────────────────────

    def test_activation_enables_login_and_seeds_role_permissions(self):
        invitation = self.create_invitation()
        raw = extract_token_from_mail()
        password = 'Str0ng-Act1vate-Pw!'
        resp = self.client.post(reverse('invitation-accept'),
                                {'token': raw, 'password': password}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        user = User.objects.get(email='priya@institution.edu')
        user.refresh_from_db()
        self.assertTrue(user.is_active)
        self.assertTrue(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertEqual(user.admin_role, 'editorial_admin')
        self.assertEqual(user.department, 'Editorial')
        self.assertEqual(user.admin_permissions, permissions_for_role('editorial_admin'))
        self.assertTrue(user.check_password(password))

        # Login now works through the existing admin auth path
        login = self.client.post(reverse('admin-login'),
                                 {'email': 'priya@institution.edu', 'password': password},
                                 format='json')
        self.assertEqual(login.status_code, status.HTTP_200_OK)
        self.assertTrue(login.data['user']['is_staff'])

    def test_super_admin_role_activation_grants_superuser(self):
        resp = self.invite({'role': 'super_admin', 'email': 'newchief@mmsr.com',
                            'full_name': 'New Chief'})
        raw = extract_token_from_mail()
        accept = self.client.post(reverse('invitation-accept'),
                                  {'token': raw, 'password': 'Sup3r-Activate-Pw!'},
                                  format='json')
        self.assertEqual(accept.status_code, status.HTTP_200_OK)
        user = User.objects.get(email='newchief@mmsr.com')
        self.assertTrue(user.is_superuser)

    def test_token_cannot_be_reused(self):
        invitation = self.create_invitation()
        raw = extract_token_from_mail()
        first = self.client.post(reverse('invitation-accept'),
                                 {'token': raw, 'password': 'Str0ng-Act1vate-Pw!'},
                                 format='json')
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        second = self.client.post(reverse('invitation-accept'),
                                  {'token': raw, 'password': 'An0ther-G00d-Pw!'}, format='json')
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('invalid, expired, or has already been used', second.data['error'])
        # Password from the first activation still stands
        self.assertTrue(User.objects.get(email='priya@institution.edu')
                        .check_password('Str0ng-Act1vate-Pw!'))

    def test_activation_audit_and_no_token_leakage(self):
        invitation = self.create_invitation()
        raw = extract_token_from_mail()
        self.client.post(reverse('invitation-accept'),
                         {'token': raw, 'password': 'Str0ng-Act1vate-Pw!'}, format='json')
        user = User.objects.get(email='priya@institution.edu')
        self.assertTrue(AdminAuditEvent.objects.filter(
            target=user, action=AdminAuditEvent.Action.ACCOUNT_ACTIVATED).exists())
        for event in AdminAuditEvent.objects.all():
            self.assertNotIn(raw, str(event.detail))


class AdminPermissionsTests(InviteTestBase):
    """Login, privilege escalation, deactivation, and password endpoints."""

    def activate_admin(self, email='priya@institution.edu', password='Str0ng-Act1vate-Pw!'):
        self.invite({'email': email, 'full_name': 'Priya Raman'})
        raw = extract_token_from_mail()
        accept = self.client.post(reverse('invitation-accept'),
                                  {'token': raw, 'password': password}, format='json')
        self.assertEqual(accept.status_code, status.HTTP_200_OK)
        return User.objects.get(email=email)

    def access_for(self, email, password):
        login = self.client.post(reverse('admin-login'),
                                 {'email': email, 'password': password}, format='json')
        self.assertEqual(login.status_code, status.HTTP_200_OK)
        return login.data['tokens']['access']

    # ── existing authentication keeps working ──────────────────────────

    def test_existing_superuser_login_still_works(self):
        resp = self.client.post(reverse('admin-login'),
                                {'email': 'chief@mmsr.com', 'password': 'Str3ng-Chief-Pass!'},
                                format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data['user']['is_superuser'])

    def test_non_staff_user_cannot_use_admin_login(self):
        User.objects.create_user(email='reader@x.com', password='Rea1der-Pass!x')
        resp = self.client.post(reverse('admin-login'),
                                {'email': 'reader@x.com', 'password': 'Rea1der-Pass!x'},
                                format='json')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    # ── privilege escalation over the API is blocked ───────────────────

    def test_staff_cannot_escalate_own_role_or_permissions(self):
        admin = self.activate_admin()
        access = self.access_for(admin.email, 'Str0ng-Act1vate-Pw!')
        client = bearer(make_client(), access)
        for payload in (
            {'is_superuser': True},
            {'is_staff': True},
            {'admin_role': 'super_admin'},
            {'is_active': False},
            {'admin_permissions': {'users': 'edit'}},
        ):
            resp = client.patch(reverse('admin-user-detail', args=[admin.id]),
                                payload, format='json')
            self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN, payload)

    def test_staff_cannot_promote_others(self):
        admin = self.activate_admin()
        other = User.objects.create_user(email='other@x.com', password='Oth3r-Pass!x')
        access = self.access_for(admin.email, 'Str0ng-Act1vate-Pw!')
        client = bearer(make_client(), access)
        resp = client.patch(reverse('admin-user-detail', args=[other.id]),
                            {'is_staff': True}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_superuser_cannot_modify_own_role_fields(self):
        access = self.access_for('chief@mmsr.com', 'Str3ng-Chief-Pass!')
        client = bearer(make_client(), access)
        # Role-field self-modification is refused outright...
        resp = client.patch(reverse('admin-user-detail', args=[self.super_admin.id]),
                            {'is_active': False}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        # ...and is_superuser is read-only on the serializer, so a PATCH
        # attempting self-demotion is silently ignored.
        resp = client.patch(reverse('admin-user-detail', args=[self.super_admin.id]),
                            {'is_superuser': False}, format='json')
        self.super_admin.refresh_from_db()
        self.assertTrue(self.super_admin.is_superuser)

    # ── deactivation / reactivation ────────────────────────────────────

    def test_deactivation_blocks_access_and_is_audited(self):
        admin = self.activate_admin()
        access = self.access_for(admin.email, 'Str0ng-Act1vate-Pw!')
        super_client = bearer(make_client(), self.access_for('chief@mmsr.com', 'Str3ng-Chief-Pass!'))
        resp = super_client.patch(reverse('admin-user-detail', args=[admin.id]),
                                  {'is_active': False}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        # A live JWT stops working immediately
        blocked = bearer(make_client(), access).get(reverse('user-profile'))
        self.assertEqual(blocked.status_code, status.HTTP_401_UNAUTHORIZED)
        # And re-login is refused
        self.assertEqual(make_client().post(reverse('admin-login'),
                                            {'email': admin.email, 'password': 'Str0ng-Act1vate-Pw!'},
                                            format='json').status_code,
                         status.HTTP_401_UNAUTHORIZED)
        self.assertTrue(AdminAuditEvent.objects.filter(
            target=admin, action=AdminAuditEvent.Action.ACCOUNT_DEACTIVATED).exists())

        # Reactivate — login works again; audit history retained
        resp = super_client.patch(reverse('admin-user-detail', args=[admin.id]),
                                  {'is_active': True}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(make_client().post(reverse('admin-login'),
                                            {'email': admin.email, 'password': 'Str0ng-Act1vate-Pw!'},
                                            format='json').status_code,
                         status.HTTP_200_OK)
        self.assertTrue(AdminAuditEvent.objects.filter(
            target=admin, action=AdminAuditEvent.Action.ACCOUNT_REACTIVATED).exists())
        self.assertTrue(AdminAuditEvent.objects.filter(
            target=admin, action=AdminAuditEvent.Action.ACCOUNT_DEACTIVATED).exists())

    def test_permissions_change_is_audited(self):
        admin = self.activate_admin()
        super_client = bearer(make_client(), self.access_for('chief@mmsr.com', 'Str3ng-Chief-Pass!'))
        resp = super_client.patch(reverse('admin-user-detail', args=[admin.id]),
                                  {'admin_permissions': {'journals': 'read'}}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(AdminAuditEvent.objects.filter(
            target=admin, action=AdminAuditEvent.Action.PERMISSIONS_CHANGED).exists())

    def test_ordinary_profile_edit_is_not_a_security_event(self):
        admin = self.activate_admin()
        super_client = bearer(make_client(), self.access_for('chief@mmsr.com', 'Str3ng-Chief-Pass!'))
        before = AdminAuditEvent.objects.count()
        resp = super_client.patch(reverse('admin-user-detail', args=[admin.id]),
                                  {'first_name': 'Renamed'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(AdminAuditEvent.objects.count(), before)

    # ── password change ────────────────────────────────────────────────

    def test_change_password_requires_current_password(self):
        admin = self.activate_admin()
        client = bearer(make_client(), self.access_for(admin.email, 'Str0ng-Act1vate-Pw!'))
        resp = client.post(reverse('change-password'),
                           {'current_password': 'Wrong-Old-Pw-123',
                            'new_password': 'N3w-G00d-Pass!x'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(admin.check_password('Str0ng-Act1vate-Pw!'))

    def test_change_password_success_and_audit(self):
        admin = self.activate_admin()
        client = bearer(make_client(), self.access_for(admin.email, 'Str0ng-Act1vate-Pw!'))
        resp = client.post(reverse('change-password'),
                           {'current_password': 'Str0ng-Act1vate-Pw!',
                            'new_password': 'N3w-G00d-Pass!x'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        admin.refresh_from_db()
        self.assertTrue(admin.check_password('N3w-G00d-Pass!x'))
        self.assertFalse(admin.check_password('Str0ng-Act1vate-Pw!'))
        self.assertTrue(AdminAuditEvent.objects.filter(
            target=admin, action=AdminAuditEvent.Action.PASSWORD_CHANGED,
            result=AdminAuditEvent.Result.SUCCESS).exists())

    def test_verify_password_true_for_correct_password(self):
        admin = self.activate_admin()
        client = bearer(make_client(), self.access_for(admin.email, 'Str0ng-Act1vate-Pw!'))
        resp = client.post(reverse('verify-password'),
                           {'current_password': 'Str0ng-Act1vate-Pw!'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data['valid'])

    def test_verify_password_false_and_audited_for_wrong_password(self):
        admin = self.activate_admin()
        client = bearer(make_client(), self.access_for(admin.email, 'Str0ng-Act1vate-Pw!'))
        resp = client.post(reverse('verify-password'),
                           {'current_password': 'Totally-Wrong-999'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(resp.data['valid'])
        # Password unchanged and a failed security event recorded (never the value)
        self.assertTrue(admin.check_password('Str0ng-Act1vate-Pw!'))
        self.assertTrue(AdminAuditEvent.objects.filter(
            target=admin, action=AdminAuditEvent.Action.PASSWORD_CHANGED,
            result=AdminAuditEvent.Result.FAILED).exists())

    def test_verify_password_requires_authentication(self):
        resp = make_client().post(reverse('verify-password'),
                                  {'current_password': 'anything'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    # ── dashboard admin headcount ──────────────────────────

    def test_admin_stats_counts_roles_and_status(self):
        admin = self.activate_admin()  # editorial (staff, non-superuser)
        User.objects.create_user(email='ghost-admin@x.com', password='Gh0st-Pass!x',
                                 is_staff=True, is_active=False)
        access = self.access_for('chief@mmsr.com', 'Str3ng-Chief-Pass!')
        resp = bearer(make_client(), access).get(reverse('admin-stats'))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        # fixture super_admin + fixture staff editor + activated editorial
        # + deactivated staff
        self.assertEqual(data['total_admins'], 4)
        self.assertEqual(data['active_admins'], 3)
        self.assertEqual(data['inactive_admins'], 1)
        self.assertEqual(data['super_admins'], 1)
        self.assertEqual(data['editorial_admins'], 3)
        self.assertEqual(data['active_super_admins'], 1)
        self.assertEqual(data['active_editorial_admins'], 2)
        self.assertEqual(admin.is_superuser, False)

    def test_admin_stats_requires_admin_access(self):
        reader = User.objects.create_user(email='quiet@x.com', password='Qu1et-Pass!x')
        access = str(RefreshToken.for_user(reader))
        resp = bearer(make_client(), access).get(reverse('admin-stats'))
        # Non-staff are refused outright; depending on the auth middleware the
        # portal surfaces this as 401 (session rejected) or 403 (permission).
        self.assertIn(resp.status_code,
                      [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_admin_stats_rejects_anonymous(self):
        resp = make_client().get(reverse('admin-stats'))
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


class PasswordResetTests(InviteTestBase):
    """Forgot-password workflow: generic responses, secure single-use links."""

    def test_reset_email_sent_for_existing_account(self):
        import django.core.mail as mailmod
        mailmod.outbox = []
        resp = self.client.post(reverse('request-password-reset'),
                                {'email': 'chief@mmsr.com'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mailmod.outbox), 1)
        self.assertIn('/reset-password?uid=', str(mailmod.outbox[0].body))
        self.assertTrue(AdminAuditEvent.objects.filter(
            action=AdminAuditEvent.Action.PASSWORD_RESET_REQUESTED).exists())

    def test_unknown_email_returns_generic_success(self):
        resp = self.client.post(reverse('request-password-reset'),
                                {'email': 'ghost@nowhere.test'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('If an account exists', resp.data['message'])

    def test_reset_token_cannot_be_reused(self):
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.encoding import force_bytes
        from django.utils.http import urlsafe_base64_encode
        uid = urlsafe_base64_encode(force_bytes(self.super_admin.pk))
        token = default_token_generator.make_token(self.super_admin)
        resp = self.client.post(reverse('confirm-password-reset'),
                                {'uid': uid, 'token': token,
                                 'new_password': 'R3set-G00d-Pass!x'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.super_admin.refresh_from_db()
        self.assertTrue(self.super_admin.check_password('R3set-G00d-Pass!x'))
        # Reusing the same token now fails (token embeds password hash)
        again = self.client.post(reverse('confirm-password-reset'),
                                 {'uid': uid, 'token': token,
                                  'new_password': 'An0ther-Pass!xyz'}, format='json')
        self.assertEqual(again.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(AdminAuditEvent.objects.filter(
            action=AdminAuditEvent.Action.PASSWORD_RESET_COMPLETED).exists())


class DeactivateInactiveUsersCommandTests(TestCase):
    """60-day inactivity auto-deactivation management command."""

    def setUp(self):
        from django.core.management import call_command
        self.call_command = call_command
        now = timezone.now()
        self.stale = User.objects.create_user(
            email='stale@mmsr.com', password='St1ale-Pass!x', is_staff=True)
        User.objects.filter(pk=self.stale.pk).update(last_login=now - timedelta(days=90))
        self.recent = User.objects.create_user(
            email='recent@mmsr.com', password='R3cent-Pass!x', is_staff=True)
        User.objects.filter(pk=self.recent.pk).update(last_login=now - timedelta(days=5))
        self.never = User.objects.create_user(
            email='never@mmsr.com', password='N3ver-Pass!x', is_staff=True)
        User.objects.filter(pk=self.never.pk).update(
            last_login=None, date_joined=now - timedelta(days=120))
        self.chief = User.objects.create_superuser(
            email='chief2@mmsr.com', password='Ch1ef-Pass!x')
        User.objects.filter(pk=self.chief.pk).update(last_login=now - timedelta(days=365))

    def _refresh(self, u):
        u.refresh_from_db()
        return u.is_active

    def test_stale_staff_is_deactivated(self):
        self.call_command('deactivate_inactive_users')
        self.assertFalse(self._refresh(self.stale))

    def test_recently_active_staff_is_kept(self):
        self.call_command('deactivate_inactive_users')
        self.assertTrue(self._refresh(self.recent))

    def test_never_logged_in_measured_from_date_joined(self):
        self.call_command('deactivate_inactive_users')
        self.assertFalse(self._refresh(self.never))

    def test_superuser_exempt_by_default(self):
        self.call_command('deactivate_inactive_users')
        self.assertTrue(self._refresh(self.chief))

    def test_dry_run_changes_nothing(self):
        self.call_command('deactivate_inactive_users', '--dry-run')
        self.assertTrue(self._refresh(self.stale))
        self.assertTrue(self._refresh(self.never))

    def test_custom_days_threshold(self):
        # 3-day cutoff also catches the 5-day-idle account.
        self.call_command('deactivate_inactive_users', '--days', '3')
        self.assertFalse(self._refresh(self.recent))

    def test_deactivation_recorded_in_audit_log(self):
        self.call_command('deactivate_inactive_users')
        self.assertTrue(AdminAuditEvent.objects.filter(
            action=AdminAuditEvent.Action.ACCOUNT_DEACTIVATED,
            target_email='stale@mmsr.com').exists())


def perm_map(**overrides):
    """Full 13-key map defaulting to 'none' (the wizard's Step-2 default)."""
    full = {key: 'none' for key in ALL_SECTION_KEYS}
    full.update(overrides)
    return full


class StaffInvitationWorkflowTests(InviteTestBase):
    """Two-step Add Admin workflow: existing-user selection, separate work
    email, explicit pre-send permission maps, and work-email login."""

    def accept(self, raw=None, password='Str0ng-Act1vate-Pw!'):
        raw = raw or extract_token_from_mail()
        return self.client.post(reverse('invitation-accept'),
                                {'token': raw, 'password': password}, format='json')

    # ── existing-user selection ────────────────────────────────────────

    def test_existing_user_invitation_reuses_account_without_touching_personal_email(self):
        reader = User.objects.create_user(
            email='reena@personal.com', password='R3ena-Pass!x',
            first_name='Reena', last_name='Das', department='Research')
        resp = self.invite({
            'user_id': reader.id,
            'email': 'reena.das@mmsr.gov',          # work email
            'full_name': 'Reena Das',
            'permissions': perm_map(books='read'),
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(User.objects.count(), 3)  # fixture 2 + reader, no duplicate
        reader.refresh_from_db()
        self.assertEqual(reader.email, 'reena@personal.com')  # not overwritten
        self.assertFalse(reader.is_staff)                      # until accepted
        invitation = AdminInvitation.objects.get(pk=resp.data['invitation']['id'])
        self.assertEqual(invitation.user_id, reader.id)
        self.assertEqual(invitation.email, 'reena.das@mmsr.gov')
        self.assertEqual(invitation.personal_email, 'reena@personal.com')

    def test_existing_active_admin_rejected_by_user_id(self):
        resp = self.invite({'user_id': self.staff.id, 'email': 'dup-work@mmsr.gov'})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('user_id', resp.data)

    # ── activation mail targets the personal email (security rule) ─────

    def test_activation_email_is_delivered_to_personal_email(self):
        import django.core.mail as mailmod
        mailmod.outbox = []
        reader = User.objects.create_user(email='k@personal.com', password='K1-Pass!x')
        self.invite({'user_id': reader.id, 'email': 'k@mmsr.gov', 'full_name': 'K Ay',
                     'permissions': perm_map()})
        # Link goes to the invitee's personal mailbox, never the work login.
        self.assertEqual(mailmod.outbox[0].to, ['k@personal.com'])
        joined = str(mailmod.outbox[0].body) + str(mailmod.outbox[0].alternatives)
        self.assertIn('k@mmsr.gov', joined)          # work email shown as the login
        self.assertIn('k@personal.com', joined)      # delivery address disclosed

    def test_activation_email_falls_back_to_work_email_without_personal(self):
        import django.core.mail as mailmod
        mailmod.outbox = []
        self.invite({'email': 'brandnew@mmsr.gov', 'full_name': 'New Staff'})
        # No personal address on record: the work email is the identity, so
        # it legitimately receives the link.
        self.assertEqual(mailmod.outbox[0].to, ['brandnew@mmsr.gov'])

    def test_password_reset_via_work_email_goes_to_personal_email(self):
        import django.core.mail as mailmod
        mailmod.outbox = []
        reader = User.objects.create_user(email='m@personal.com', password='M1-Pass!x')
        reader.work_email = 'm@mmsr.gov'
        reader.is_staff = True
        reader.save(update_fields=['work_email', 'is_staff'])
        resp = self.client.post(reverse('request-password-reset'),
                                {'email': 'm@mmsr.gov'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mailmod.outbox), 1)
        # Reset links are personal-mail only, even when the work login was used.
        self.assertEqual(mailmod.outbox[0].to, ['m@personal.com'])

    # ── work-email conflicts and duplicate invites ─────────────────────

    def test_work_email_matching_another_users_personal_email_rejected(self):
        User.objects.create_user(email='someone@other.org', password='S0me-Pass!x')
        resp = self.invite({'email': 'someone@other.org',
                            'personal_email': 'brand.new@x.com', 'full_name': 'New Person'})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', resp.data)
        self.assertFalse(AdminInvitation.objects.exists())

    def test_work_email_already_used_by_another_admin_rejected(self):
        first = self.invite({'user_id': User.objects.create_user(
            email='a@personal.com', password='A1-Pass!x').id,
            'email': 'shared-work@mmsr.gov', 'full_name': 'A One', 'permissions': perm_map()})
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        second = self.invite({'user_id': User.objects.create_user(
            email='b@personal.com', password='B1-Pass!x').id,
            'email': 'shared-work@mmsr.gov', 'full_name': 'B Two', 'permissions': perm_map()})
        # Before A accepts, the clash surfaces as the pending-invitation
        # conflict; after acceptance it is the 400 work-email ownership error.
        self.assertIn(second.status_code,
                      [status.HTTP_400_BAD_REQUEST, status.HTTP_409_CONFLICT])

    def test_second_submission_of_delivered_pending_invitation_returns_409(self):
        reader = User.objects.create_user(email='c@personal.com', password='C1-Pass!x')
        body = {'user_id': reader.id, 'email': 'c-work@mmsr.gov',
                'full_name': 'Cee', 'permissions': perm_map()}
        self.assertEqual(self.invite(body).status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.invite(body).status_code, status.HTTP_409_CONFLICT)

    # ── permissions chosen before sending survive acceptance ───────────

    def test_explicit_permissions_applied_verbatim_not_role_preset(self):
        reader = User.objects.create_user(email='mira@personal.com', password='M1-Pass!x')
        chosen = perm_map(books='read', journals='edit')
        self.assertEqual(self.invite({
            'user_id': reader.id, 'email': 'mira@mmsr.gov',
            'full_name': 'Mira Sen', 'role': 'editorial_admin',
            'permissions': chosen,
        }).status_code, status.HTTP_201_CREATED)
        accept = self.accept()
        self.assertEqual(accept.status_code, status.HTTP_200_OK)
        reader.refresh_from_db()
        self.assertEqual(reader.admin_permissions, chosen)
        self.assertNotEqual(reader.admin_permissions,
                            permissions_for_role('editorial_admin'))  # preset NOT applied
        self.assertEqual(reader.work_email, 'mira@mmsr.gov')
        self.assertEqual(reader.email, 'mira@personal.com')
        self.assertTrue(reader.is_staff and reader.is_active)
        # Invitation status flips to accepted → the UI surfaces this as Active.
        invitation = AdminInvitation.objects.get(user=reader)
        self.assertEqual(invitation.status, AdminInvitation.Status.ACCEPTED)
        self.assertIsNotNone(invitation.accepted_at)

    def test_missing_permission_keys_default_to_none(self):
        resp = self.invite({'email': 'sparse@mmsr.gov', 'full_name': 'Sparse Admin',
                            'permissions': {'books': 'edit'}})
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        stored = resp.data['invitation']['permissions']
        self.assertEqual(stored['books'], 'edit')
        self.assertEqual(stored['journals'], 'none')  # absent key never implies edit
        self.assertEqual(sorted(stored.keys()), sorted(ALL_SECTION_KEYS))
        self.accept()
        user = User.objects.get(email='sparse@mmsr.gov')
        self.assertEqual(user.admin_permissions, stored)

    def test_invalid_permission_section_or_level_rejected(self):
        for bad in ({'nonexistent_section': 'read'}, {'books': 'owner'}):
            resp = self.invite({'email': 'bad-perm@mmsr.gov', 'full_name': 'Bad Perm',
                                'permissions': bad})
            self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    # ── work-email login compatibility ─────────────────────────────────

    def test_work_email_login_after_activation(self):
        reader = User.objects.create_user(email='dee@personal.com', password='D1-Pass!x')
        self.invite({'user_id': reader.id, 'email': 'dee@mmsr.gov',
                     'full_name': 'Dee Ay', 'permissions': perm_map(users='read')})
        password = 'Str0ng-Act1vate-Pw!'
        self.accept(password=password)
        # Work email → admin login works
        login = self.client.post(reverse('admin-login'),
                                 {'email': 'dee@mmsr.gov', 'password': password}, format='json')
        self.assertEqual(login.status_code, status.HTTP_200_OK)
        self.assertTrue(login.data['user']['is_staff'])
        self.assertEqual(login.data['user']['work_email'], 'dee@mmsr.gov')
        # Personal email keeps working too (public login path)
        personal = self.client.post(reverse('user-login'),
                                    {'email': 'dee@personal.com', 'password': password},
                                    format='json')
        self.assertEqual(personal.status_code, status.HTTP_200_OK)
        # Case-insensitive work email as well
        mixed = self.client.post(reverse('admin-login'),
                                 {'email': 'Dee@MMSR.gov', 'password': password}, format='json')
        self.assertEqual(mixed.status_code, status.HTTP_200_OK)

    def test_inactive_account_cannot_log_in_with_work_email_before_activation(self):
        reader = User.objects.create_user(email='eve@personal.com', password='E1-Pass!x')
        self.invite({'user_id': reader.id, 'email': 'eve@mmsr.gov',
                     'full_name': 'Eve Two', 'permissions': perm_map()})
        resp = self.client.post(reverse('admin-login'),
                                {'email': 'eve@mmsr.gov', 'password': 'whatever'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_existing_public_user_login_unchanged(self):
        # A regular reader with no invitation at all logs in exactly as before.
        User.objects.create_user(email='plain@reader.com', password='Pl4in-Pass!x')
        resp = self.client.post(reverse('user-login'),
                                {'email': 'plain@reader.com', 'password': 'Pl4in-Pass!x'},
                                format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    # ── honest retry when delivery failed ──────────────────────────────

    @patch('users.views.send_invitation_email', return_value=False)
    def test_resubmit_after_delivery_failure_reuses_pending_invitation(self, _mock):
        resp = self.invite({'email': 'retry@mmsr.gov', 'full_name': 'Retry Admin',
                            'permissions': perm_map()})
        self.assertEqual(resp.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertEqual(AdminInvitation.objects.count(), 1)
        old_hash = AdminInvitation.objects.get().token_hash
        with patch('users.views.send_invitation_email', return_value=True):
            retry = self.invite({'email': 'retry@mmsr.gov', 'full_name': 'Retry Admin',
                                 'permissions': perm_map()})
        self.assertEqual(retry.status_code, status.HTTP_201_CREATED)
        self.assertEqual(AdminInvitation.objects.count(), 1)  # no duplicate
        self.assertEqual(User.objects.filter(email='retry@mmsr.gov').count(), 1)
        invitation = AdminInvitation.objects.get()
        self.assertIsNotNone(invitation.sent_at)
        self.assertNotEqual(invitation.token_hash, old_hash)  # fresh single-use link


class SectionEnforcementMiddlewareTests(InviteTestBase):
    """Server-authoritative None/Read/Edit enforcement on the API itself —
    hiding sidebar items or disabling buttons is not the defence."""

    def make_staff(self, email, permissions, password='St4ff-Pass!x'):
        return User.objects.create_user(email=email, password=password,
                                        is_staff=True, admin_permissions=permissions)

    def jwt_client(self, email, password):
        login = self.client.post(reverse('admin-login'),
                                 {'email': email, 'password': password}, format='json')
        self.assertEqual(login.status_code, status.HTTP_200_OK)
        return bearer(make_client(), login.data['tokens']['access'])

    def test_read_level_allows_reads_and_blocks_writes(self):
        staff = self.make_staff('read-only@mmsr.com', perm_map(users='read'))
        client = self.jwt_client('read-only@mmsr.com', 'St4ff-Pass!x')
        self.assertEqual(client.get('/api/users/').status_code, status.HTTP_200_OK)
        other = User.objects.create_user(email='target@x.com', password='T1-Pass!x')
        resp = client.patch(f'/api/users/{other.id}/', {'first_name': 'Hacked'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(staff.is_staff)

    def test_none_level_blocks_even_direct_url_calls(self):
        self.make_staff('blind@mmsr.com', perm_map(users='none'))
        client = self.jwt_client('blind@mmsr.com', 'St4ff-Pass!x')
        self.assertEqual(client.get('/api/users/').status_code, status.HTTP_403_FORBIDDEN)
        # A completely different unmapped-to-their-grant section also blocks.
        self.assertEqual(client.get('/api/publications/books/').status_code,
                         status.HTTP_403_FORBIDDEN)

    def test_edit_level_permits_supported_writes(self):
        staff = self.make_staff('writer@mmsr.com', perm_map(users='edit'))
        client = self.jwt_client('writer@mmsr.com', 'St4ff-Pass!x')
        other = User.objects.create_user(email='edity@x.com', password='E2-Pass!x')
        resp = client.patch(f'/api/users/{other.id}/', {'first_name': 'Renamed'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(staff.admin_permissions.get('users'), 'edit')

    def test_superuser_access_unchanged(self):
        client = self.jwt_client('chief@mmsr.com', 'Str3ng-Chief-Pass!')
        self.assertEqual(client.get('/api/users/').status_code, status.HTTP_200_OK)
        self.assertEqual(client.get('/api/publications/books/').status_code, status.HTTP_200_OK)

    def test_missing_section_entry_denies_access(self):
        """SECURITY-QA-REPORT L-2 — an unmapped section is no longer full access.

        The middleware used to treat "this section is not in the map" as "no
        override ⇒ legacy full staff access", so an account created straight in
        the Django admin — a path that seeded nothing at all — could read and
        write the entire CMS. Only what is written down may now be used.
        """
        self.make_staff('partial@mmsr.com', {'users': 'read'})
        client = self.jwt_client('partial@mmsr.com', 'St4ff-Pass!x')
        # Its one explicit grant still works…
        self.assertEqual(client.get('/api/users/').status_code, status.HTTP_200_OK)
        # …and every other section, absent from the map, is refused.
        self.assertEqual(client.get('/api/publications/journals/').status_code,
                         status.HTTP_403_FORBIDDEN)

        # A wizard-style full map expresses the same intent explicitly.
        user = User.objects.get(email='partial@mmsr.com')
        user.admin_permissions = perm_map(users='read', journals='none')
        user.save()
        self.assertEqual(client.get('/api/publications/journals/').status_code,
                         status.HTTP_403_FORBIDDEN)

    def test_account_with_no_map_at_all_is_locked_out(self):
        """A staff account with an empty grant map reaches no CMS section."""
        self.make_staff('blank-map@mmsr.com', {})
        client = self.jwt_client('blank-map@mmsr.com', 'St4ff-Pass!x')
        for url in ('/api/users/', '/api/publications/books/', '/api/commerce/'):
            self.assertEqual(client.get(url).status_code, status.HTTP_403_FORBIDDEN, url)

    def test_add_admin_form_seeds_a_complete_map(self):
        """The Django-admin "add admin" path can no longer create a permission-less
        (or, under the old fallback, all-powerful) staff account."""
        from users.admin import AddAdminForm

        form = AddAdminForm(data={
            'first_name': 'Nadia', 'last_name': 'Editor',
            'email': 'nadia@mmsr.com', 'password': 'Adm1n-Pass!x',
            'cms_role': 'editorial_admin',
        })
        self.assertTrue(form.is_valid(), form.errors)
        user = form.save()
        self.assertTrue(user.is_staff)
        self.assertEqual(user.admin_permissions, permissions_for_role('editorial_admin'))
        self.assertEqual(user.admin_role, 'editorial_admin')

        # No role chosen ⇒ every section explicitly none, never an implicit grant.
        plain = AddAdminForm(data={
            'first_name': 'Plain', 'last_name': 'Staff',
            'email': 'plain@mmsr.com', 'password': 'Adm1n-Pass!x',
        })
        self.assertTrue(plain.is_valid(), plain.errors)
        seeded = plain.save()
        self.assertEqual(seeded.admin_permissions,
                         {key: 'none' for key in ALL_SECTION_KEYS})

    def test_migration_backfills_legacy_staff_with_edit(self):
        """users/0009 turns the old implicit full access into a written grant."""
        import importlib
        from django.apps import apps as global_apps
        seed_module = importlib.import_module(
            'users.migrations.0009_seed_staff_admin_permissions')

        legacy = User.objects.create_user(email='legacy@mmsr.com',
                                          password='L3gacy-Pass!x', is_staff=True)
        partial = User.objects.create_user(email='half@mmsr.com',
                                           password='H4lf-Pass!x', is_staff=True,
                                           admin_permissions={'books': 'read'})
        seed_module.seed_explicit_grants(global_apps, None)

        legacy.refresh_from_db()
        self.assertEqual(legacy.admin_permissions,
                         {key: 'edit' for key in ALL_SECTION_KEYS})
        partial.refresh_from_db()
        # An explicit grant is never widened by the backfill.
        self.assertEqual(partial.admin_permissions['books'], 'read')
        self.assertEqual(partial.admin_permissions['orders'], 'edit')


@override_settings(THROTTLE_RATES=NO_THROTTLE_RATES, FRONTEND_URL='https://app.mmsrpublications.test')
class EmailDeliveryHonestyTests(InviteTestBase):
    """SMTP vs development-backend behaviour of the invitation send path.

    The test runner's locmem backend stands in for "a backend that accepts
    messages but cannot deliver off-server"; real SMTP success/failure is
    exercised by patching send_invitation_email (no network in tests).
    """

    def test_real_email_flag_only_for_offserver_backends(self):
        from users.views import _real_email_configured
        with override_settings(EMAIL_BACKEND='django.core.mail.backends.smtp.EmailBackend'):
            self.assertTrue(_real_email_configured())
        for dev_backend in (
            'django.core.mail.backends.console.EmailBackend',
            'django.core.mail.backends.locmem.EmailBackend',
            'django.core.mail.backends.filebased.EmailBackend',
        ):
            with override_settings(EMAIL_BACKEND=dev_backend):
                self.assertFalse(_real_email_configured())

    def test_dev_backend_success_message_states_not_delivered(self):
        # locmem (test default) accepts the send, so the API must still
        # report honestly that no inbox delivery happened.
        resp = self.invite()
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertFalse(resp.data['real_email_configured'])
        self.assertIn('Invitation sent', resp.data['message'])
        self.assertIn('not delivered to an inbox', resp.data['message'])

    @patch('users.views.send_invitation_email', return_value=True)
    def test_smtp_backend_message_claims_real_delivery(self, _mock):
        with override_settings(EMAIL_BACKEND='django.core.mail.backends.smtp.EmailBackend'):
            resp = self.invite()
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(resp.data['real_email_configured'])
        self.assertIn('Invitation sent to priya@institution.edu.', resp.data['message'])
        self.assertNotIn('not delivered', resp.data['message'])

    @patch('users.views.send_invitation_email', return_value=False)
    def test_smtp_rejection_never_reports_success(self, _mock):
        # Configured SMTP that rejects (bad credentials/network) → 502, no
        # success message, and sent_at stays null so the UI shows the truth.
        resp = self.invite()
        self.assertEqual(resp.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertNotIn('message', resp.data)
        invitation = AdminInvitation.objects.get(pk=resp.data['invitation_id'])
        self.assertIsNone(invitation.sent_at)
        self.assertEqual(invitation.status, AdminInvitation.Status.PENDING)

    def test_email_contains_activation_link_expiry_and_single_use_wording(self):
        import django.core.mail as mailmod
        mailmod.outbox = []
        self.invite()
        self.assertEqual(len(mailmod.outbox), 1)
        mail = mailmod.outbox[0]
        # Text part carries the canonical single-use link + expiry info.
        self.assertIn('https://app.mmsrpublications.test/admin/accept-invitation?token=', mail.body)
        self.assertIn('link valid until', mail.body)
        self.assertIn('single-use', mail.body)
        self.assertTrue(TOKEN_RE.search(mail.body))
        # HTML part mirrors them.
        html = mail.alternatives[0][0]
        self.assertIn('/admin/accept-invitation?token=', html)
        self.assertIn('valid until', html)
        self.assertIn('once', html)


# ── Google Identity Services (public customer sign-in) ────────────────────
# The backend verifies the Google-issued ID token server-side; these tests
# stub google-auth's verify_oauth2_token so no network round-trip happens.
GOOGLE_CLIENT_ID = '1086672852735-test.apps.googleusercontent.com'


def google_idinfo(sub='g-123', email='author@example.edu', **overrides):
    """A decoded Google ID-token payload shaped like GIS actually returns."""
    info = {
        'iss': 'https://accounts.google.com',
        'aud': GOOGLE_CLIENT_ID,
        'sub': sub,
        'email': email,
        'email_verified': True,
        'given_name': 'Ada',
        'family_name': 'Lovelace',
        'exp': 2_000_000_000,
    }
    info.update(overrides)
    return info


@override_settings(GOOGLE_OAUTH_CLIENT_ID=GOOGLE_CLIENT_ID)
class GoogleAuthViewTests(TestCase):
    """POST /api/users/auth/google/ — Google customer sign-in + safety rules."""

    def setUp(self):
        self.client = make_client()
        self.url = reverse('google-auth')

    def _post(self, token='fake-id-token'):
        return self.client.post(self.url, {'token': token}, format='json')

    def test_missing_client_id_returns_503(self):
        # Without an audience the token's aud claim can't be authenticated, so
        # the endpoint must refuse rather than accept an arbitrary Google token.
        with override_settings(GOOGLE_OAUTH_CLIENT_ID=''):
            res = self._post()
        self.assertEqual(res.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)

    @patch('users.views.id_token.verify_oauth2_token')
    def test_new_customer_created_without_privileges(self, mock_verify):
        mock_verify.return_value = google_idinfo()
        res = self._post()
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('access', res.data['tokens'])
        self.assertIn('refresh', res.data['tokens'])
        user = User.objects.get(email='author@example.edu')
        self.assertEqual(user.google_id, 'g-123')
        self.assertFalse(user.is_staff)      # never a staff/admin path
        self.assertFalse(user.is_superuser)
        self.assertFalse(user.has_usable_password())

    @patch('users.views.id_token.verify_oauth2_token')
    def test_existing_email_account_is_not_autolinked(self, mock_verify):
        # A password account sharing the email must NOT be handed over or
        # silently linked just because the Google email matches.
        existing = User.objects.create_user(
            email='author@example.edu', password='Str0ng-Pass!x')
        mock_verify.return_value = google_idinfo()
        res = self._post()
        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(res.data.get('code'), 'email_exists')
        existing.refresh_from_db()
        self.assertIsNone(existing.google_id)
        self.assertNotIn('tokens', res.data)

    @patch('users.views.id_token.verify_oauth2_token')
    def test_linked_customer_can_sign_in(self, mock_verify):
        User.objects.create_user(
            email='author@example.edu', password=None, google_id='g-123')
        mock_verify.return_value = google_idinfo()
        res = self._post()
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('access', res.data['tokens'])

    @patch('users.views.id_token.verify_oauth2_token')
    def test_staff_account_denied(self, mock_verify):
        User.objects.create_user(
            email='editor@mmsr.com', password='x', google_id='g-123', is_staff=True)
        mock_verify.return_value = google_idinfo(sub='g-123', email='editor@mmsr.com')
        res = self._post()
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertNotIn('tokens', res.data)

    @patch('users.views.id_token.verify_oauth2_token')
    def test_inactive_account_denied(self, mock_verify):
        User.objects.create_user(
            email='author@example.edu', password=None, google_id='g-123', is_active=False)
        mock_verify.return_value = google_idinfo()
        res = self._post()
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    @patch('users.views.id_token.verify_oauth2_token')
    def test_invalid_token_returns_400(self, mock_verify):
        mock_verify.side_effect = ValueError('signature mismatch')
        res = self._post()
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('users.views.id_token.verify_oauth2_token')
    def test_wrong_audience_rejected(self, mock_verify):
        mock_verify.return_value = google_idinfo(aud='someone-else.apps.googleusercontent.com')
        res = self._post()
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('users.views.id_token.verify_oauth2_token')
    def test_unverified_email_rejected(self, mock_verify):
        mock_verify.return_value = google_idinfo(email_verified=False)
        res = self._post()
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


@override_settings(THROTTLE_RATES={
    'invitation-validate': '100000/min',
    'invitation-accept': '100000/min',
    'password-reset': '100000/min',
    'login': '3/5m',
    'login-admin': '3/5m',
})
class LoginThrottleTests(TestCase):
    """Audit H-1: repeated FAILED logins must be rate limited per (IP, email),
    while successes never count and one scope cannot exhaust another."""

    def setUp(self):
        from django.core.cache import cache
        cache.clear()  # throttle counters are process-global; isolate tests
        self.client = make_client()
        self.victim = User.objects.create_user(
            email='throttle-target@mmsr.com', password='Corr3ct-Horse-Pass!')
        self.other = User.objects.create_user(
            email='throttle-bystander@mmsr.com', password='An0ther-Correct-Pass!')

    def _fail_login(self, email, password='wrong-password', url='/api/users/auth/login/'):
        return self.client.post(url, {'email': email, 'password': password}, format='json')

    def test_three_failures_allowed_then_fourth_is_429(self):
        for _ in range(3):
            res = self._fail_login('throttle-target@mmsr.com')
            self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
        blocked = self._fail_login('throttle-target@mmsr.com')
        self.assertEqual(blocked.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        # 429 body must not reveal anything about the account.
        body = str(blocked.data).lower()
        self.assertNotIn('throttle-target', body)

    def test_correct_login_after_limit_is_blocked_too(self):
        """Throttling must gate the credential check itself — an attacker
        cannot ride a warm window with the real password."""
        for _ in range(3):
            self._fail_login('throttle-target@mmsr.com')
        res = self.client.post('/api/users/auth/login/', {
            'email': 'throttle-target@mmsr.com', 'password': 'Corr3ct-Horse-Pass!'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_success_resets_the_failure_counter(self):
        self._fail_login('throttle-target@mmsr.com')
        self._fail_login('throttle-target@mmsr.com')
        ok = self.client.post('/api/users/auth/login/', {
            'email': 'throttle-target@mmsr.com', 'password': 'Corr3ct-Horse-Pass!'}, format='json')
        self.assertEqual(ok.status_code, status.HTTP_200_OK)
        # Counter cleared: two more failures still stay under the 3/5m limit.
        self.assertEqual(self._fail_login('throttle-target@mmsr.com').status_code, 401)
        self.assertEqual(self._fail_login('throttle-target@mmsr.com').status_code, 401)

    def test_other_emails_from_same_ip_are_unaffected(self):
        for _ in range(3):
            self._fail_login('throttle-target@mmsr.com')
        res = self._fail_login('throttle-bystander@mmsr.com')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_same_email_from_other_ip_is_unaffected(self):
        for _ in range(3):
            self._fail_login('throttle-target@mmsr.com')
        fresh_ip = APIClient(HTTP_HOST='localhost')
        res = fresh_ip.post('/api/users/auth/login/',
                            {'email': 'throttle-target@mmsr.com', 'password': 'wrong-password'},
                            format='json', REMOTE_ADDR='10.9.8.7')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_customer_and_admin_scopes_are_separate(self):
        """Exhausting the customer login budget cannot lock the admin portal
        (and vice versa) — the two scopes keep independent counters."""
        for _ in range(3):
            self._fail_login('throttle-target@mmsr.com')
        self.assertEqual(self._fail_login('throttle-target@mmsr.com').status_code, 429)
        admin_res = self._fail_login(
            'throttle-target@mmsr.com', url='/api/users/auth/admin/login/')
        self.assertEqual(admin_res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_unknown_email_blocked_identically_to_known_email(self):
        """No enumeration leak: throttling behaves the same whether or not
        the account exists — identical status AND identical body."""
        for _ in range(3):
            self._fail_login('ghost-account@mmsr.com')
        blocked_ghost = self._fail_login('ghost-account@mmsr.com')
        for _ in range(3):
            self._fail_login('throttle-target@mmsr.com')
        blocked_real = self._fail_login('throttle-target@mmsr.com')
        self.assertEqual(blocked_ghost.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(blocked_real.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(blocked_ghost.data, blocked_real.data)

    def test_window_expiry_allows_attempts_again(self):
        """After the throttle window rolls over, the correct password works
        again (limit is temporary, not a permanent lockout)."""
        import time as _time
        with self.settings(THROTTLE_RATES={'login': '2/second', 'login-admin': '2/second',
                                           'invitation-validate': '100000/min',
                                           'invitation-accept': '100000/min',
                                           'password-reset': '100000/min'}):
            # Fixed windows can roll over mid-test at 1s granularity; retry
            # the burst until one 429 lands inside a full window.
            deadline = _time.time() + 15
            while True:
                self._fail_login('throttle-target@mmsr.com')
                self._fail_login('throttle-target@mmsr.com')
                blocked = self._fail_login('throttle-target@mmsr.com')
                if blocked.status_code == 429 or _time.time() > deadline:
                    break
            self.assertEqual(blocked.status_code, 429)
            _time.sleep(1.3)  # fixed window keyed on epoch//duration — wait for rollover
            res = self.client.post('/api/users/auth/login/', {
                'email': 'throttle-target@mmsr.com', 'password': 'Corr3ct-Horse-Pass!'}, format='json')
            self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_redis_cache_failure_still_enforces_throttle_via_process_fallback(self):
        """Audit safety verification: If Redis/cache raises an Exception (outage),
        the login throttle must fall back to in-process memory and STILL block
        brute-force attacks with HTTP 429 rather than failing 100% open."""
        from unittest.mock import patch
        from users.throttles import _PROCESS_FALLBACK_FAILURES
        _PROCESS_FALLBACK_FAILURES.clear()
        with patch('django.core.cache.cache.get', side_effect=Exception('Redis connection refused')):
            with patch('django.core.cache.cache.set', side_effect=Exception('Redis connection refused')):
                # Even though primary cache throws connection errors, 3 failures are recorded in fallback
                for _ in range(3):
                    res = self._fail_login('throttle-target@mmsr.com')
                    self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
                # 4th failure is throttled with 429
                blocked = self._fail_login('throttle-target@mmsr.com')
                self.assertEqual(blocked.status_code, status.HTTP_429_TOO_MANY_REQUESTS)


class LogoutRevocationTests(TestCase):
    """Audit M-7: logout must revoke the refresh token; rotation must retire
    the previous one; the endpoint must be idempotent and never leak."""

    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        self.client = make_client()
        self.user = User.objects.create_user(
            email='logout-user@mmsr.com', password='Lo90ut-User-Pass!')

    def _tokens(self):
        refresh = RefreshToken.for_user(self.user)
        return str(refresh), str(refresh.access_token)

    def test_logout_blacklists_the_refresh_token(self):
        refresh, _access = self._tokens()
        res = self.client.post('/api/users/auth/logout/', {'refresh': refresh}, format='json')
        self.assertIn(res.status_code, (status.HTTP_200_OK, status.HTTP_205_RESET_CONTENT))
        reuse = self.client.post('/api/users/auth/token/refresh/', {'refresh': refresh}, format='json')
        self.assertEqual(reuse.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_is_idempotent(self):
        refresh, _access = self._tokens()
        first = self.client.post('/api/users/auth/logout/', {'refresh': refresh}, format='json')
        second = self.client.post('/api/users/auth/logout/', {'refresh': refresh}, format='json')
        self.assertIn(first.status_code, (200, 205))
        self.assertIn(second.status_code, (200, 205))

    def test_logout_with_expired_or_malformed_token_still_succeeds(self):
        for bad in ('garbage-not-a-jwt', 'a.b.c'):
            res = self.client.post('/api/users/auth/logout/', {'refresh': bad}, format='json')
            self.assertIn(res.status_code, (200, 205))

    def test_logout_without_refresh_is_400(self):
        res = self.client.post('/api/users/auth/logout/', {}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_refresh_rotation_blacklists_the_previous_token(self):
        refresh, _access = self._tokens()
        rotated = self.client.post('/api/users/auth/token/refresh/', {'refresh': refresh}, format='json')
        self.assertEqual(rotated.status_code, status.HTTP_200_OK)
        self.assertIn('access', rotated.data)
        replay = self.client.post('/api/users/auth/token/refresh/', {'refresh': refresh}, format='json')
        self.assertEqual(replay.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_logout_round_trip_with_real_credentials(self):
        """Full flow: login works, the issued refresh token stops working
        after logout, and a fresh login succeeds (throttle was reset)."""
        login = self.client.post('/api/users/auth/login/', {
            'email': 'logout-user@mmsr.com', 'password': 'Lo90ut-User-Pass!'}, format='json')
        self.assertEqual(login.status_code, status.HTTP_200_OK)
        refresh = login.data['tokens']['refresh']
        out = self.client.post('/api/users/auth/logout/', {'refresh': refresh}, format='json')
        self.assertIn(out.status_code, (200, 205))
        reuse = self.client.post('/api/users/auth/token/refresh/', {'refresh': refresh}, format='json')
        self.assertEqual(reuse.status_code, status.HTTP_401_UNAUTHORIZED)
        again = self.client.post('/api/users/auth/login/', {
            'email': 'logout-user@mmsr.com', 'password': 'Lo90ut-User-Pass!'}, format='json')
        self.assertEqual(again.status_code, status.HTTP_200_OK)



