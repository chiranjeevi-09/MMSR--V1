"""Production health-check endpoint for load balancers, uptime monitors, and Kubernetes."""
from django.db import connection
from django.core.cache import cache
from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework import status


class HealthCheckView(APIView):
    """Liveness & readiness probe verifying database and cache connectivity."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        overall_healthy = True

        # Check database
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1;")
                cursor.fetchone()
        except Exception:
            overall_healthy = False

        # Check cache / Redis
        try:
            cache_key = "_health_ping"
            cache.set(cache_key, "1", timeout=10)
            if cache.get(cache_key) != "1":
                overall_healthy = False
        except Exception:
            overall_healthy = False

        if overall_healthy:
            return JsonResponse({"status": "ok"}, status=status.HTTP_200_OK)
        else:
            return JsonResponse({"status": "unhealthy"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
