from django.urls import path
from . import payment_views

urlpatterns = [
    path('success/', payment_views.payment_success, name='payment_success'),
    path('failed/', payment_views.payment_failed, name='payment_failed'),
    path('pending/', payment_views.payment_pending, name='payment_pending'),
]
