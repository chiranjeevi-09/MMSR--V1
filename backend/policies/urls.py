from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    PolicyViewSet,
    PolicyVersionDetailView,
    PolicyAcceptanceViewSet,
    PublicPolicyListView,
    PublicPolicyDetailView,
)

router = DefaultRouter()
router.register(r'acceptances', PolicyAcceptanceViewSet, basename='policy-acceptance')
router.register(r'policies', PolicyViewSet, basename='policy')

urlpatterns = [
    # Public (published content only)
    path('public/', PublicPolicyListView.as_view(), name='policy-public-list'),
    path('public/<str:policy_type>/', PublicPolicyDetailView.as_view(), name='policy-public-detail'),

    # Admin
    path('versions/<uuid:pk>/', PolicyVersionDetailView.as_view(), name='policy-version-detail'),
    path('', include(router.urls)),
]
