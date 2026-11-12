import hashlib
import logging
import secrets
from datetime import timedelta

from django.db import transaction, IntegrityError
from django.utils import timezone
from rest_framework import status, generics, permissions, viewsets, filters
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from core.mail import send_mail_logged
from google.oauth2 import id_token
from google.auth.transport import requests
from django.conf import settings
from .models import AdminInvitation, AdminAuditEvent
from .roles import permissions_for_role, ALL_SECTION_KEYS
from .emails import send_invitation_email, invitation_delivery_address
from .throttles import InvitationValidateThrottle, InvitationAcceptThrottle, PasswordResetRequestThrottle, UserLoginThrottle, AdminLoginThrottle
from .serializers import (
    UserSerializer,
    UserRegistrationSerializer,
    GoogleAuthSerializer,
    LoginSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
    ChangePasswordSerializer,
    VerifyPasswordSerializer,
    AdminUserSerializer,
    AdminInvitationSerializer,
    AdminInvitationCreateSerializer,
    InvitationAcceptSerializer,
)
from config.security_mixins import AlwaysPrivateResponseHeadersMixin
from core.api import PublicIDLookupMixin

User = get_user_model()

logger = logging.getLogger(__name__)


class IsSuperAdmin(permissions.BasePermission):
    """Grants access only to Django superusers — admin-creation endpoints."""
    message = 'Super Admin access is required for this operation.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)


def _hash_invitation_token(raw_token):
    # SHA-256 of the single-use token; the raw value is never stored.
    return hashlib.sha256(raw_token.encode()).hexdigest()


def _new_invitation_token():
    return secrets.token_urlsafe(48)


def _invitation_expiry():
    hours = getattr(settings, 'ADMIN_INVITATION_EXPIRY_HOURS', 24)
    return timezone.now() + timedelta(hours=hours)


def _real_email_configured():
    """True only when the active email backend can deliver off-server.

    Django's default console/file backends accept and "send" messages (so
    ``send()`` returns True) but never reach a real inbox. Surfacing this lets
    the UI distinguish "backend accepted the message" from "a real invitation
    email can actually be delivered", instead of reporting a misleading success.
    """
    backend = getattr(settings, 'EMAIL_BACKEND', '')
    return 'console' not in backend and 'locmem' not in backend and 'file' not in backend


def _delivery_caveat():
    """Suffix for send-success messages when no off-server backend is set.

    Console/locmem/file backends accept messages (send() succeeds) but nothing
    reaches an inbox, so the API must never imply real delivery in that mode.
    """
    if _real_email_configured():
        return ''
    return (' Note: a development email backend is active (console/in-memory) — '
            'the message was written to the server log, not delivered to an inbox.')


def _audit(action, actor, target, result=AdminAuditEvent.Result.SUCCESS, detail=None, target_email=''):
    """Append a security event. NEVER pass passwords or raw tokens in detail."""
    AdminAuditEvent.objects.create(
        actor=actor if getattr(actor, 'pk', None) else None,
        actor_email=(getattr(actor, 'email', '') or ''),
        target=target if getattr(target, 'pk', None) else None,
        target_email=target_email or (getattr(target, 'email', '') or ''),
        action=action,
        result=result,
        detail=detail or {},
    )


INVITATION_INVALID_MSG = 'This invitation link is invalid, expired, or has already been used.'

class GoogleAuthView(APIView):
    """Google Identity Services sign-in for public customers.

    Verifies the ID token server-side (signature, issuer, audience, expiry),
    then authenticates the matching MMSR customer through the existing SimpleJWT
    mechanism. Deliberately does NOT auto-link accounts purely on an email match
    and NEVER grants staff/admin privileges through this consumer entry point.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = GoogleAuthSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.validated_data['token']

        client_id = getattr(settings, 'GOOGLE_OAUTH_CLIENT_ID', '') or ''
        if not client_id:
            # Refuse to verify with a missing audience: without it the token's
            # `aud` claim is unauthenticated and any Google client's token would
            # be accepted. This is a server misconfiguration, not a user error.
            return Response(
                {'error': 'Google sign-in is not configured on the server. Set GOOGLE_OAUTH_CLIENT_ID in the backend environment.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # verify_oauth2_token validates the cryptographic signature against
        # Google's keys, the expiry, and (via audience=) the `aud` claim.
        try:
            idinfo = id_token.verify_oauth2_token(token, requests.Request(), audience=client_id)
        except ValueError:
            return Response({'error': 'Invalid or expired Google credential.'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response({'error': 'Could not verify the Google credential. Please try again.'}, status=status.HTTP_400_BAD_REQUEST)

        # Defense-in-depth: re-assert the security-critical claims ourselves.
        if idinfo.get('iss') not in ('https://accounts.google.com', 'accounts.google.com'):
            return Response({'error': 'Google credential has an unexpected issuer.'}, status=status.HTTP_400_BAD_REQUEST)
        if idinfo.get('aud') != client_id:
            return Response({'error': 'Google credential was not issued for this site.'}, status=status.HTTP_400_BAD_REQUEST)

        google_id = idinfo.get('sub')
        email = (idinfo.get('email') or '').strip().lower()
        if not google_id or not email:
            return Response({'error': 'Google credential is missing a stable account id or email.'}, status=status.HTTP_400_BAD_REQUEST)
        if idinfo.get('email_verified') is False:
            return Response({'error': 'The Google account email address is not verified.'}, status=status.HTTP_400_BAD_REQUEST)

        first_name = idinfo.get('given_name', '') or ''
        last_name = idinfo.get('family_name', '') or ''

        # 1) Only ever trust an existing link: match on the stored google_id.
        user = User.objects.filter(google_id=google_id).first()

        # 2) Never auto-link on email alone. If a different (password) account
        #    already owns this email, force the normal sign-in so we can't hand
        #    over an existing account just because someone knows the address.
        if not user:
            if User.objects.filter(email__iexact=email).exists():
                return Response(
                    {
                        'error': 'An MMSR account already exists for this email. Please sign in with your password, then connect Google from your profile.',
                        'code': 'email_exists',
                    },
                    status=status.HTTP_409_CONFLICT,
                )
            # 3) Brand-new customer: create a least-privilege public account.
            try:
                with transaction.atomic():
                    user = User.objects.create_user(
                        email=email,
                        password=None,  # unusable password; Google-only account
                        first_name=first_name,
                        last_name=last_name,
                        google_id=google_id,
                        is_staff=False,
                        is_superuser=False,
                    )
            except IntegrityError:
                # Lost a race against a concurrent signup for the same email.
                return Response(
                    {
                        'error': 'An MMSR account already exists for this email. Please sign in with your password.',
                        'code': 'email_exists',
                    },
                    status=status.HTTP_409_CONFLICT,
                )

        # 4) A previously linked account must be an ACTIVE, NON-PRIVILEGED customer.
        #    Staff/superusers must use the admin portal — Google login never
        #    becomes a path to the CMS.
        if user.is_staff or user.is_superuser:
            return Response(
                {'error': 'Administrator accounts must sign in through the admin portal.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not user.is_active:
            return Response(
                {'error': 'This account is disabled. Please contact support.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Refresh name details only when currently empty (never overwrite edits).
        update_fields = []
        if not user.first_name and first_name:
            user.first_name = first_name
            update_fields.append('first_name')
        if not user.last_name and last_name:
            user.last_name = last_name
            update_fields.append('last_name')
        if update_fields:
            user.save(update_fields=update_fields)

        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_200_OK)

class AdminLoginView(APIView):
    """Admin login with email and password"""
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        email = serializer.validated_data['email']
        password = serializer.validated_data['password']
        
        # Brute-force protection (audit H-1) — only FAILED attempts count.
        throttle = AdminLoginThrottle()
        if not throttle.allow_request(request, self):
            return Response(
                {'error': 'Too many failed login attempts. Please try again later.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )
        
        # Authenticate user
        user = authenticate(request, email=email, password=password)
        
        if user is None:
            throttle.register_failure()
            return Response(
                {'error': 'Invalid credentials'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Check if user is staff
        if not user.is_staff:
            throttle.register_failure()
            return Response(
                {'error': 'Access denied. Admin privileges required.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        throttle.reset()
        
        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_200_OK)

class UserLoginView(APIView):
    """Regular user login with email and password"""
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        email = serializer.validated_data['email']
        password = serializer.validated_data['password']
        
        # Brute-force protection (audit H-1) — only FAILED attempts count.
        throttle = UserLoginThrottle()
        if not throttle.allow_request(request, self):
            return Response(
                {'error': 'Too many failed login attempts. Please try again later.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )
        
        # Authenticate user
        user = authenticate(request, email=email, password=password)
        
        if user is None:
            throttle.register_failure()
            return Response(
                {'error': 'Invalid credentials'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        throttle.reset()
        
        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_200_OK)

class UserRegistrationView(generics.CreateAPIView):
    """User registration endpoint"""
    queryset = User.objects.all()
    permission_classes = [permissions.AllowAny]
    serializer_class = UserRegistrationSerializer


class LogoutView(APIView):
    """Revoke the caller's refresh token on logout (audit M-7).

    With token_blacklist + BLACKLIST_AFTER_ROTATION the presented refresh
    token can never mint new access tokens again. Documented limitation of
    stateless JWTs: an already-issued ACCESS token stays usable until its own
    expiry (max 1 hour here) — logout is instant for re-authentication, not
    for in-flight access tokens.

    Idempotent and enumeration-safe: expired, malformed or already-revoked
    tokens return the same success; a logout never fails the client.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        raw = request.data.get('refresh') if hasattr(request.data, 'get') else None
        if not raw or not isinstance(raw, str):
            return Response(
                {'error': 'A refresh token is required to log out.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            token = RefreshToken(raw)
            token.blacklist()
        except TokenError:
            # Expired / already blacklisted / invalid signature — the token
            # is unusable either way, so the logout goal is already met.
            pass
        except Exception as db_err:  # blacklist table missing etc. must not 500 the UI
            logger.error(f"Logout blacklisting failed: {db_err}")
        return Response({'message': 'Logged out.'}, status=status.HTTP_205_RESET_CONTENT)

class UserProfileView(AlwaysPrivateResponseHeadersMixin, generics.RetrieveUpdateAPIView):
    """Get and update user profile"""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserSerializer
    
    def get_object(self):
        return self.request.user


class PasswordResetRequestView(APIView):
    """Request a password reset email. Always returns same success message to prevent email enumeration."""
    permission_classes = [permissions.AllowAny]
    throttle_classes = [PasswordResetRequestThrottle]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']
        success_message = {
            'message': 'If an account exists for this email, a password reset link has been sent.'
        }

        # Match either sign-in identity (personal email) or the admin work
        # login, but the reset link below always goes to the account's
        # personal email (User.email) — never to the work mailbox alone.
        user = (
            User.objects.filter(email__iexact=email).first()
            or User.objects.filter(work_email__iexact=email).first()
        )
        if not user:
            # Always return success to prevent email enumeration
            return Response(success_message, status=status.HTTP_200_OK)

        # Build reset link
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        reset_link = f"{frontend_url}/reset-password?uid={uid}&token={token}"

        # Send email.
        # SECURITY-QA-REPORT M-8: this used to be fail_silently=True inside a
        # bare `except Exception: pass`, so a dropped reset link left no trace
        # anywhere — the user just waited for an email that never existed. The
        # response must stay generic (a real 500 would confirm the address is
        # registered), but the failure is now logged and recorded in the audit
        # trail so support can tell "not sent" from "delivered, ignored".
        delivered = send_mail_logged(
            subject='Reset Your MMSR Publications Password',
            message=(
                f"Hello {user.first_name or 'there'},\n\n"
                f"You requested a password reset for your MMSR Publications account.\n\n"
                f"Click the link below to reset your password (valid for 24 hours):\n"
                f"{reset_link}\n\n"
                f"If you did not request this, please ignore this email.\n\n"
                f"— MMSR Publications Team"
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            context='password reset link',
        )

        _audit(
            AdminAuditEvent.Action.PASSWORD_RESET_REQUESTED,
            actor=None,
            target=user,
            detail={'via': 'forgot-password', 'email_delivered': delivered},
        )
        return Response(success_message, status=status.HTTP_200_OK)


class PasswordResetConfirmView(APIView):
    """Confirm password reset with uid and token, then set new password."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        uid = serializer.validated_data['uid']
        token = serializer.validated_data['token']
        new_password = serializer.validated_data['new_password']

        try:
            user_pk = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_pk)
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            return Response(
                {'error': 'Invalid or expired password reset link.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not default_token_generator.check_token(user, token):
            return Response(
                {'error': 'Invalid or expired password reset link.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user.set_password(new_password)
        user.save()

        _audit(
            AdminAuditEvent.Action.PASSWORD_RESET_COMPLETED,
            actor=None,
            target=user,
            detail={'via': 'forgot-password'},
        )
        return Response(
            {'message': 'Your password has been reset successfully. You can now log in.'},
            status=status.HTTP_200_OK
        )


class ChangePasswordView(APIView):
    """Authenticated users (incl. admins) change their own password."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        if not user.check_password(serializer.validated_data['current_password']):
            _audit(
                AdminAuditEvent.Action.PASSWORD_CHANGED,
                actor=user,
                target=user,
                result=AdminAuditEvent.Result.FAILED,
                detail={'reason': 'current password mismatch'},
            )
            return Response(
                {'current_password': ['Your current password is incorrect.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(serializer.validated_data['new_password'])
        user.save()
        _audit(AdminAuditEvent.Action.PASSWORD_CHANGED, actor=user, target=user)
        return Response({'message': 'Your password has been changed successfully.'}, status=status.HTTP_200_OK)


class VerifyPasswordView(APIView):
    """Confirm the authenticated account's current password.

    Used as the first gate of the two-step password change flow: the UI keeps
    the new-password fields locked until this returns valid=true. Never leaks
    any password material and logs failures as a security audit event.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = VerifyPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if not request.user.check_password(serializer.validated_data['current_password']):
            _audit(
                AdminAuditEvent.Action.PASSWORD_CHANGED,
                actor=request.user,
                target=request.user,
                result=AdminAuditEvent.Result.FAILED,
                detail={'reason': 'current password mismatch (verify)'},
            )
            return Response({'valid': False, 'message': 'Your current password is incorrect.'},
                            status=status.HTTP_400_BAD_REQUEST)

        return Response({'valid': True}, status=status.HTTP_200_OK)


class AdminUserViewSet(AlwaysPrivateResponseHeadersMixin, PublicIDLookupMixin, viewsets.ModelViewSet):
    """Staff-only user management for /api/users/ (list, detail, profile edits).

    Registration and login stay the public entry points; this viewset exists
    for the admin dashboard/users page only. Create/delete are deliberately
    disabled via http_method_names.
    """
    serializer_class = AdminUserSerializer
    permission_classes = [permissions.IsAdminUser]
    http_method_names = ['get', 'patch', 'head', 'options']
    # admin_profile is joined so the ADM identity comes with the row (spec §2
    # mapping) instead of one query per user in the table.
    queryset = User.objects.select_related('admin_profile').all().order_by('-date_joined')
    filter_backends = [filters.SearchFilter]
    search_fields = ['email', 'work_email', 'first_name', 'last_name',
                     'public_id', 'admin_profile__public_id']

    # Fields that decide WHO has CMS power; mutating them is super-user work
    # only — a plain staff editor must not promote themselves or others.
    ROLE_FIELDS = ('is_staff', 'admin_permissions', 'admin_role', 'department', 'is_active')

    def _guard_role_changes(self, request):
        if not any(field in request.data for field in self.ROLE_FIELDS):
            return None
        if not request.user.is_superuser:
            raise PermissionDenied('Only Super Admins can change staff access, roles or account status.')
        if self.get_object() == request.user:
            raise PermissionDenied('You cannot change your own staff access — ask another Super Admin.')
        return self.get_object()

    def _audit_role_changes(self, request, obj, changed_fields):
        if not any(field in changed_fields for field in self.ROLE_FIELDS):
            return  # ordinary profile edits are not security events
        if 'is_active' in changed_fields:
            action = (
                AdminAuditEvent.Action.ACCOUNT_REACTIVATED if obj.is_active
                else AdminAuditEvent.Action.ACCOUNT_DEACTIVATED
            )
        elif 'admin_permissions' in changed_fields:
            action = AdminAuditEvent.Action.PERMISSIONS_CHANGED
        else:
            action = AdminAuditEvent.Action.ROLE_CHANGED
        _audit(action, actor=request.user, target=obj, detail={'changed_fields': sorted(changed_fields)})

    def update(self, request, *args, **kwargs):
        self._guard_role_changes(request)
        response = super().update(request, *args, **kwargs)
        self._audit_role_changes(request, self.get_object(), set(request.data.keys()))
        return response

    def partial_update(self, request, *args, **kwargs):
        self._guard_role_changes(request)
        response = super().partial_update(request, *args, **kwargs)
        self._audit_role_changes(request, self.get_object(), set(request.data.keys()))
        return response


class AdminStatsView(AlwaysPrivateResponseHeadersMixin, APIView):
    """Admin headcount for the dashboard 'Admin Team & Access' section.

    Computed server-side so the numbers stay correct regardless of pagination
    or filters on the users list endpoint.
    """
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        from publications.models import Book, Journal
        from conferences.models import Conference
        from submissions.models import Submission
        from django.utils import timezone

        staff = User.objects.filter(is_staff=True)
        total = staff.count()
        active = staff.filter(is_active=True).count()
        supers = staff.filter(is_superuser=True)
        super_count = supers.count()
        active_super = supers.filter(is_active=True).count()

        today = timezone.localdate()
        return Response({
            'total_admins': total,
            'active_admins': active,
            'inactive_admins': total - active,
            'super_admins': super_count,
            'editorial_admins': total - super_count,
            'active_super_admins': active_super,
            'active_editorial_admins': active - active_super,
            'users_total': User.objects.count(),
            'books_total': Book.objects.count(),
            'journals_total': Journal.objects.count(),
            'conferences_total': Conference.objects.count(),
            'submissions_pending': Submission.objects.filter(status__in=['pending', 'under_review', 'editorial_screening']).count(),
            'submissions_published': Submission.objects.filter(status='published').count(),
            'submissions_screening': Submission.objects.filter(status='pending').count(),
            'submissions_under_review': Submission.objects.filter(status__in=['editorial_screening', 'under_review']).count(),
            'submissions_revision': Submission.objects.filter(status__in=['revision_requested', 'revision_required']).count(),
            'submissions_accepted_today': Submission.objects.filter(status='accepted', submitted_at__date=today).count(),
            'submissions_rejected': Submission.objects.filter(status='rejected').count(),
        })


class AdminNotificationsView(AlwaysPrivateResponseHeadersMixin, APIView):
    """Real-time live notifications for admin staff.

    Aggregates the latest operational events across submissions, orders,
    conference paper registrations, and user sign-ups.
    """
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        import logging
        from django.utils import timezone
        from submissions.models import Submission
        from orders.models import Order
        from conferences.models import ConferenceSubmission

        logger = logging.getLogger(__name__)
        notifications = []

        # 1. Recent manuscript submissions (book & journal)
        try:
            subs = (
                Submission.objects
                .select_related('author')
                .order_by('-submitted_at')[:15]
            )
            for s in subs:
                author_name = (s.author.get_full_name() or s.author.email) if s.author else 'Author'
                is_journal = (s.submission_type == 'journal_article')
                ref = s.public_id or f'SUB-{s.id:04d}'
                clean_title = (s.title[:60] + '...') if len(s.title) > 60 else s.title
                notifications.append({
                    'id': f'sub-{s.public_id or s.id}',
                    'title': f'New {"Journal" if is_journal else "Book"} Manuscript',
                    'message': f'{author_name} submitted "{clean_title}" (Ref: {ref}).',
                    'timestamp': s.submitted_at.isoformat() if s.submitted_at else timezone.now().isoformat(),
                    'category': 'submission',
                    'section': 'submissions',
                    'linkUrl': '/admin/journal-submissions' if is_journal else '/admin/book-submissions',
                    '_sort_key': s.submitted_at or timezone.now(),
                })
        except Exception as e:
            logger.warning('Failed to load submission notifications: %s', e)

        # 2. Recent book orders
        try:
            orders = (
                Order.objects
                .select_related('user')
                .order_by('-created_at')[:15]
            )
            for o in orders:
                ref = o.custom_order_id or o.public_id or f'ORD-{o.id:04d}'
                buyer = o.full_name or o.email or 'Customer'
                is_paid = o.status in Order.PAID_STATUSES
                notifications.append({
                    'id': f'ord-{o.custom_order_id or o.public_id or o.id}',
                    'title': 'Book Order Payment Received' if is_paid else f'New Book Order ({o.get_status_display()})',
                    'message': f'Order #{ref} by {buyer} (₹{o.total_amount}).',
                    'timestamp': o.created_at.isoformat() if o.created_at else timezone.now().isoformat(),
                    'category': 'order',
                    'section': 'orders',
                    'linkUrl': '/admin/orders',
                    '_sort_key': o.created_at or timezone.now(),
                })
        except Exception as e:
            logger.warning('Failed to load order notifications: %s', e)

        # 3. Recent conference submissions
        try:
            confs = (
                ConferenceSubmission.objects
                .select_related('conference')
                .order_by('-submitted_at')[:15]
            )
            for c in confs:
                conf_title = c.conference.title[:30] if c.conference else 'Conference'
                clean_title = (c.title[:50] + '...') if len(c.title) > 50 else c.title
                ref = c.public_id or f'CONF-{c.id:04d}'
                notifications.append({
                    'id': f'conf-{c.public_id or c.id}',
                    'title': 'New Conference Paper Registered',
                    'message': f'Paper for {conf_title}: "{clean_title}" ({ref}).',
                    'timestamp': c.submitted_at.isoformat() if c.submitted_at else timezone.now().isoformat(),
                    'category': 'conference',
                    'section': 'conferences',
                    'linkUrl': '/admin/conference-submissions',
                    '_sort_key': c.submitted_at or timezone.now(),
                })
        except Exception as e:
            logger.warning('Failed to load conference notifications: %s', e)

        # 4. Recent author/user registrations (non-staff)
        try:
            users = (
                User.objects
                .filter(is_staff=False)
                .order_by('-date_joined')[:10]
            )
            for u in users:
                name = u.get_full_name() or u.email
                notifications.append({
                    'id': f'usr-{u.id}',
                    'title': 'New Author Registration',
                    'message': f'{name} created an author account.',
                    'timestamp': u.date_joined.isoformat() if u.date_joined else timezone.now().isoformat(),
                    'category': 'user',
                    'section': 'users',
                    'linkUrl': '/admin/users',
                    '_sort_key': u.date_joined or timezone.now(),
                })
        except Exception as e:
            logger.warning('Failed to load user notifications: %s', e)

        notifications.sort(key=lambda x: x.get('_sort_key') or timezone.now(), reverse=True)

        results = []
        for n in notifications[:30]:
            n.pop('_sort_key', None)
            results.append(n)

        return Response(results)


class AdminInvitationView(AlwaysPrivateResponseHeadersMixin, APIView):
    """GET list / POST create for admin invitations (Super Admins only)."""
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        invitations = (
            AdminInvitation.objects
            .select_related('user', 'created_by')
            .order_by('-created_at')[:300]
        )
        return Response(AdminInvitationSerializer(invitations, many=True).data)

    def post(self, request):
        serializer = AdminInvitationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        work_email = data['email'].strip()
        personal_email = (data.get('personal_email') or '').strip()
        user_id = data.get('user_id')
        explicit_perms = data.get('permissions')
        # Full 13-key map when the wizard sent one: a section missing from it
        # is "none" — an absent key can never imply "edit" for new staff.
        # Omitted field = legacy single-email caller → seed preset on accept.
        permissions_map = (
            {key: explicit_perms.get(key, 'none') for key in ALL_SECTION_KEYS}
            if explicit_perms is not None else {}
        )

        with transaction.atomic():
            if user_id is not None:
                # ── Existing-user mode: reuse the account, never duplicate ──
                user = User.objects.filter(pk=user_id).first()
                if not user:
                    return Response(
                        {'user_id': ['The selected user no longer exists.']},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if user.is_staff or user.is_superuser:
                    return Response(
                        {'user_id': ['This person already has an admin account. Adjust their access in the table instead.']},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            else:
                # ── New-staff mode. Legacy callers omit personal_email, in
                #    which case the work email doubles as the account identity
                #    exactly as before. The account itself is only created
                #    once every check below has passed. ──
                identity_email = personal_email or work_email
                user = User.objects.filter(email__iexact=identity_email).first()
                if user and user.is_staff:
                    return Response(
                        {'email': ['This person already has an admin account. Adjust their access in the table instead.']},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            # ── Work-email uniqueness across both identifier columns ────────
            work_conflicts = User.objects.filter(work_email__iexact=work_email)
            email_conflicts = User.objects.filter(email__iexact=work_email)
            if user is not None:
                work_conflicts = work_conflicts.exclude(pk=user.pk)
                email_conflicts = email_conflicts.exclude(pk=user.pk)
            if work_conflicts.exists():
                return Response(
                    {'email': ['This work email already belongs to another admin account.']},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if email_conflicts.exists():
                return Response(
                    {'email': ["This work email is another user's personal email — pick the staff member's own work address."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            pending = (
                AdminInvitation.objects.filter(user=user, status=AdminInvitation.Status.PENDING).first()
                if user is not None else None
            )
            if pending and pending.sent_at and not pending.is_expired:
                return Response(
                    {'email': ['An invitation for this email is already pending — use Resend to deliver a fresh link.']},
                    status=status.HTTP_409_CONFLICT,
                )
            pending_email_conflict = AdminInvitation.objects.filter(
                email__iexact=work_email, status=AdminInvitation.Status.PENDING)
            if user is not None:
                pending_email_conflict = pending_email_conflict.exclude(user=user)
            if pending_email_conflict.exists():
                return Response(
                    {'email': ['A pending invitation already exists for this work email.']},
                    status=status.HTTP_409_CONFLICT,
                )

            if user is None:
                # Active reader or previously-revoked invitee is reused above;
                # a brand-new account is deliberately inactive with an
                # unusable password until the invitation is accepted.
                user = User.objects.create(email=User.objects.normalize_email(identity_email), is_active=False)
                user.set_unusable_password()
                user.save()

            if pending:
                # Never-delivered or expired pending row: reuse it safely and
                # issue a brand-new single-use link below (no duplicates).
                invitation = pending
            else:
                invitation = AdminInvitation(user=user, created_by=request.user)

            invitation.email = work_email
            invitation.personal_email = user.email
            invitation.full_name = data['full_name']
            invitation.role = data['role']
            invitation.department = data.get('department', '')
            invitation.phone = data.get('phone', '')
            invitation.notes = data.get('notes', '')
            invitation.permissions = permissions_map
            raw_token = _new_invitation_token()
            invitation.token_hash = _hash_invitation_token(raw_token)
            invitation.expires_at = _invitation_expiry()
            invitation.status = AdminInvitation.Status.PENDING
            invitation.sent_at = None
            invitation.save()
            _audit(
                AdminAuditEvent.Action.INVITATION_CREATED,
                actor=request.user, target=user,
                detail={'role': invitation.role, 'invitation_id': invitation.id,
                        'mode': 'existing_user' if user_id is not None else 'new_staff'},
            )

        sent = send_invitation_email(invitation, raw_token)
        if sent:
            invitation.sent_at = timezone.now()
            invitation.save(update_fields=['sent_at'])
            _audit(AdminAuditEvent.Action.INVITATION_SENT, actor=request.user, target=user,
                   detail={'invitation_id': invitation.id})
            return Response(
                {'message': f'Invitation sent to {invitation_delivery_address(invitation)}.' + _delivery_caveat(),
                 'real_email_configured': _real_email_configured(),
                 'invitation': AdminInvitationSerializer(invitation).data},
                status=status.HTTP_201_CREATED,
            )

        _audit(
            AdminAuditEvent.Action.INVITATION_SEND_FAILED,
            actor=request.user, target=user,
            result=AdminAuditEvent.Result.FAILED,
            detail={'invitation_id': invitation.id},
        )
        return Response(
            {
                'error': ('The admin account was created but the invitation email could NOT be delivered. '
                          'Use Resend Invitation once email delivery is configured — no duplicate account will be created.'),
                'invitation_id': invitation.id,
            },
            status=status.HTTP_502_BAD_GATEWAY,
        )


class AdminInvitationResendView(APIView):
    """POST — issue a brand-new single-use link, invalidating the previous one."""
    permission_classes = [IsSuperAdmin]

    def post(self, request, pk):
        invitation = generics.get_object_or_404(AdminInvitation, pk=pk)
        if invitation.status == AdminInvitation.Status.ACCEPTED:
            return Response({'error': 'This invitation was already accepted.'}, status=status.HTTP_400_BAD_REQUEST)
        if invitation.status == AdminInvitation.Status.REVOKED:
            return Response({'error': 'This invitation was revoked; create a new one instead.'}, status=status.HTTP_400_BAD_REQUEST)

        raw_token = _new_invitation_token()  # old hash is replaced → old link dead
        invitation.token_hash = _hash_invitation_token(raw_token)
        invitation.expires_at = _invitation_expiry()
        invitation.status = AdminInvitation.Status.PENDING
        invitation.save(update_fields=['token_hash', 'expires_at', 'status'])

        sent = send_invitation_email(invitation, raw_token)
        if sent:
            invitation.sent_at = timezone.now()
            invitation.save(update_fields=['sent_at'])
            _audit(AdminAuditEvent.Action.INVITATION_RESENT, actor=request.user, target=invitation.user,
                   detail={'invitation_id': invitation.id})
            return Response({'message': f'A fresh invitation link was sent to {invitation_delivery_address(invitation)}.' + _delivery_caveat(),
                             'real_email_configured': _real_email_configured(),
                             'invitation': AdminInvitationSerializer(invitation).data})

        _audit(AdminAuditEvent.Action.INVITATION_RESENT, actor=request.user, target=invitation.user,
               result=AdminAuditEvent.Result.FAILED, detail={'invitation_id': invitation.id})
        return Response(
            {'error': 'Resend failed: the email service did not accept the message. Try again once email delivery works.'},
            status=status.HTTP_502_BAD_GATEWAY,
        )


class AdminInvitationRevokeView(APIView):
    """POST — cancel a pending invitation immediately; history is preserved."""
    permission_classes = [IsSuperAdmin]

    def post(self, request, pk):
        invitation = generics.get_object_or_404(AdminInvitation, pk=pk)
        if invitation.status == AdminInvitation.Status.ACCEPTED:
            return Response({'error': 'Accepted invitations cannot be revoked — deactivate the account instead.'},
                            status=status.HTTP_400_BAD_REQUEST)
        invitation.status = AdminInvitation.Status.REVOKED
        invitation.token_hash = ''  # link is dead even before expiry
        invitation.revoked_at = timezone.now()
        invitation.save(update_fields=['status', 'token_hash', 'revoked_at'])
        _audit(AdminAuditEvent.Action.INVITATION_REVOKED, actor=request.user, target=invitation.user,
               detail={'invitation_id': invitation.id})
        return Response({'message': 'Invitation revoked.', 'invitation': AdminInvitationSerializer(invitation).data})


class InvitationValidateView(APIView):
    """GET ?token= — public, throttled. Echoes invitee details for the activation page."""
    permission_classes = [permissions.AllowAny]
    throttle_classes = [InvitationValidateThrottle]

    def get(self, request):
        raw_token = request.query_params.get('token', '')
        invitation = (
            AdminInvitation.objects
            .filter(token_hash=_hash_invitation_token(raw_token) if raw_token else '!')
            .select_related('user')
            .first()
        )
        if not invitation or invitation.status != AdminInvitation.Status.PENDING or invitation.is_expired:
            return Response({'error': INVITATION_INVALID_MSG}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'valid': True,
            'full_name': invitation.full_name,
            'email': invitation.email,
            'work_email': invitation.email,
            'personal_email': invitation.personal_email,
            'role': invitation.role,
            'role_display': invitation.get_role_display(),
            'department': invitation.department,
            'expires_at': invitation.expires_at,
        })


class InvitationAcceptView(APIView):
    """POST — public, throttled, single-use. Sets the password and activates
    the admin account atomically so concurrent activations can't both pass."""
    permission_classes = [permissions.AllowAny]
    throttle_classes = [InvitationAcceptThrottle]

    def post(self, request):
        serializer = InvitationAcceptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        raw_token = serializer.validated_data['token']
        password = serializer.validated_data['password']

        with transaction.atomic():
            invitation = (
                AdminInvitation.objects
                .select_for_update()
                .filter(token_hash=_hash_invitation_token(raw_token), status=AdminInvitation.Status.PENDING)
                .first()
            )
            if not invitation or invitation.is_expired:
                return Response({'error': INVITATION_INVALID_MSG}, status=status.HTTP_400_BAD_REQUEST)

            # Flip the invitation first; the conditional status below makes
            # double-activation of the same row impossible even on backends
            # without row locking.
            updated = AdminInvitation.objects.filter(
                pk=invitation.pk, status=AdminInvitation.Status.PENDING
            ).update(status=AdminInvitation.Status.ACCEPTED, accepted_at=timezone.now())
            if not updated:
                return Response({'error': INVITATION_INVALID_MSG}, status=status.HTTP_400_BAD_REQUEST)

            user = invitation.user
            names = invitation.full_name.split(maxsplit=1)
            user.first_name = names[0] if names else ''
            user.last_name = names[1] if len(names) > 1 else ''
            user.set_password(password)
            user.is_active = True
            user.is_staff = True
            user.admin_role = invitation.role
            user.department = invitation.department
            # The work email becomes the administrative login identifier; the
            # personal email in User.email is deliberately left untouched.
            user.work_email = invitation.email or user.work_email
            # The Super Admin's explicit pre-send selections win over the role
            # seed; legacy invitations without a stored map still seed presets.
            user.admin_permissions = invitation.permissions or permissions_for_role(invitation.role)
            if invitation.role == 'super_admin':
                user.is_superuser = True
            if invitation.phone.isdigit() and len(invitation.phone) == 10:
                user.phone_number = invitation.phone
            try:
                user.save()
            except IntegrityError:
                # Work-email unique clash raised mid-race: roll the whole
                # activation back so the invitation stays usable/resentable.
                transaction.set_rollback(True)
                return Response(
                    {'error': "This invitation's work email is already in use by another account. Ask a Super Admin to correct the invitation."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        _audit(AdminAuditEvent.Action.ACCOUNT_ACTIVATED, actor=None, target=user,
               detail={'role': invitation.role, 'invitation_id': invitation.id},
               target_email=user.email)
        return Response({
            'message': 'Account activated. You can now sign in to the admin portal with your work email.',
            'email': invitation.email or user.email,
            'personal_email': user.email,
        })
