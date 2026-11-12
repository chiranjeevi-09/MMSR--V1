from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import ConferenceViewSet, ConferenceSubmissionViewSet

router = DefaultRouter()
router.register(r'conferences', ConferenceViewSet, basename='conference')
router.register(r'conference-submissions', ConferenceSubmissionViewSet, basename='conference-submission')

# Allow /api/conferences/<slug-or-id>/ detail lookup by slug as well
urlpatterns = [
    path('', include(router.urls)),
]
