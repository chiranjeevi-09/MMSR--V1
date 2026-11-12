from django.urls import path, include
from rest_framework import permissions
from rest_framework.routers import DefaultRouter
from .views import OrderViewSet
from .webhook_views import RazorpayWebhookView

router = DefaultRouter()
router.register(r'', OrderViewSet, basename='order')

urlpatterns = [
    path('orders/<int:pk>/invoice/', OrderViewSet.as_view({'get': 'invoice'}), name='order-invoice-alt'),
    # Explicit route so /api/commerce/stats/ resolves before the router's
    # generic <pk> detail lookup (the viewset is registered at an empty prefix).
    # permission_classes must be passed here too: a manual as_view() bypasses
    # the router, which is what normally applies the @action's own kwargs.
    path('webhook/', RazorpayWebhookView.as_view(), name='razorpay-webhook'),
    path('razorpay-webhook/', RazorpayWebhookView.as_view(), name='razorpay-webhook-alias'),
    path('stats/', OrderViewSet.as_view({'get': 'admin_stats'}, permission_classes=[permissions.IsAdminUser]), name='order-stats'),
    path('', include(router.urls)),
]
