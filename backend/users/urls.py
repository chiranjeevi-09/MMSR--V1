from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    GoogleAuthView,
    AdminLoginView,
    UserLoginView,
    LogoutView,
    UserRegistrationView,
    UserProfileView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
    ChangePasswordView,
    VerifyPasswordView,
    AdminUserViewSet,
    AdminStatsView,
    AdminNotificationsView,
    AdminInvitationView,
    AdminInvitationResendView,
    AdminInvitationRevokeView,
    InvitationValidateView,
    InvitationAcceptView,
)

router = DefaultRouter()
router.register(r'', AdminUserViewSet, basename='admin-user')

urlpatterns = [
    path('auth/google/', GoogleAuthView.as_view(), name='google-auth'),
    path('auth/admin/login/', AdminLoginView.as_view(), name='admin-login'),
    path('auth/login/', UserLoginView.as_view(), name='user-login'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/register/', UserRegistrationView.as_view(), name='register'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/request-password-reset/', PasswordResetRequestView.as_view(), name='request-password-reset'),
    path('auth/confirm-password-reset/', PasswordResetConfirmView.as_view(), name='confirm-password-reset'),
    path('auth/change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('auth/verify-password/', VerifyPasswordView.as_view(), name='verify-password'),

    path('profile/', UserProfileView.as_view(), name='user-profile'),

    # Admin headcount for the dashboard (must stay above the router include,
    # otherwise the router's <pk> detail lookup would swallow this segment).
    path('admin-stats/', AdminStatsView.as_view(), name='admin-stats'),
    path('admin-notifications/', AdminNotificationsView.as_view(), name='admin-notifications'),

    # Admin invitation endpoints (Super Admins only; the accept/validate
    # pair is public + throttled because invitees are not signed in yet).
    path('invitations/', AdminInvitationView.as_view(), name='admin-invitations'),
    path('invitations/validate/', InvitationValidateView.as_view(), name='invitation-validate'),
    path('invitations/accept/', InvitationAcceptView.as_view(), name='invitation-accept'),
    path('invitations/<int:pk>/resend/', AdminInvitationResendView.as_view(), name='invitation-resend'),
    path('invitations/<int:pk>/revoke/', AdminInvitationRevokeView.as_view(), name='invitation-revoke'),

    # Staff management endpoints (/api/users/ list + /api/users/<id>/ PATCH).
    # Included last so the explicit routes above keep priority over the
    # router's generic <pk> detail lookup.
    path('', include(router.urls)),
]
