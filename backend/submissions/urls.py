from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SubmissionViewSet, PublishedVolumeViewSet

router = DefaultRouter()
router.register(r'volumes', PublishedVolumeViewSet, basename='volume')
router.register(r'', SubmissionViewSet, basename='submission')

urlpatterns = [
    path('', include(router.urls)),
]
