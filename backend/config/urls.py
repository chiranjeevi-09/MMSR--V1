"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from core.dev_media import serve_public_media
from core.health import HealthCheckView

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # API Endpoints
    path('api/users/', include('users.urls')),
    path('api/publications/', include('publications.urls')),
    path('api/commerce/', include('orders.urls')),
    path('api/slider/', include('slider.urls')),
    path('api/submissions/', include('submissions.urls')),
    path('api/policies/', include('policies.urls')),
    path('api/', include('conferences.urls')),
    
    # Authentication
    path('api-auth/', include('rest_framework.urls')),
    
    # System Health Check
    path('api/health/', HealthCheckView.as_view(), name='health-check'),
    
    # Payment Result Pages
    path('payment/', include('orders.payment_urls')),
]

# SECURITY-QA-REPORT C-1: ``static(MEDIA_URL, ...)`` used to be mounted here,
# which served EVERY file under MEDIA_ROOT to anonymous visitors while DEBUG
# was on — 482 invoice PDFs, 24 author certificates and 70 unpublished
# manuscripts included, all under sequential/guessable names. Customer
# documents now live in PROTECTED_MEDIA_ROOT and are streamed by authorised
# views only; the route that remains is a marketing-asset allowlist
# (core/dev_media.py), so an accidental public upload cannot be walked.
# Production must serve these prefixes from nginx and never this view.
if settings.DEBUG:
    urlpatterns += [
        path('media/<path:path>', serve_public_media, name='public-media'),
    ]
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
