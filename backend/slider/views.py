from rest_framework import viewsets, permissions
from core.caching import cache_public_api
from core.api import PublicIDLookupMixin
from .models import SliderImage
from .serializers import SliderImageSerializer

class SliderImageViewSet(PublicIDLookupMixin, viewsets.ModelViewSet):
    """
    ViewSet for Homepage Slider Images.
    Public: List (Active only)
    Admin: CRUD (All)
    """
    queryset = SliderImage.objects.all()
    serializer_class = SliderImageSerializer
    
    @cache_public_api(timeout=60, prefix="slider_list")
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        if self.request.user.is_staff:
            return SliderImage.objects.all()
        return SliderImage.objects.filter(is_active=True).order_by('order', '-created_at')

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        # SECURITY-QA-REPORT H-1: this used to be IsAuthenticated, which meant
        # any registered customer could POST a slide (caption + destination URL)
        # straight onto the public homepage, patch an official one, or delete
        # it — persistent defacement/phishing reachable with a free account.
        # ``AdminSectionAccessMiddleware`` cannot catch it: it skips every
        # caller who is not staff. Writes are admin-only, like every other CMS
        # section (see AdminTestimonialViewSet).
        return [permissions.IsAdminUser()]
