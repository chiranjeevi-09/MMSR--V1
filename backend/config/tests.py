"""Configuration regression tests (audit C-2 remediation).

Kept value-free on purpose: these tests prove the SECRET_KEY wiring is
correct without ever printing, comparing against, or committing a real key.
"""
from pathlib import Path

from django.conf import settings
from django.test import SimpleTestCase


class SecretKeyConfigurationTests(SimpleTestCase):

    def test_runtime_secret_key_is_configured(self):
        # A missing key now fails at import time (ImproperlyConfigured), so
        # reaching this assertion at all already proves the key exists.
        self.assertTrue(settings.SECRET_KEY)

    def test_runtime_key_is_not_a_predictable_django_insecure_value(self):
        self.assertNotIn('django-insecure', settings.SECRET_KEY)

    def test_settings_source_contains_no_committed_fallback(self):
        """The old code shipped `config('SECRET_KEY', default='django-insecure-...')`,
        which silently signed JWTs with a key in the repository when the
        environment variable was absent. Fail-fast (`config('SECRET_KEY')`
        with no default) must never be reintroduced."""
        source = (Path(settings.BASE_DIR) / 'config' / 'settings.py').read_text(encoding='utf-8')
        self.assertNotIn("default='django-insecure", source)
        self.assertNotIn('default="django-insecure', source)
        self.assertIn("config('SECRET_KEY')", source)

    def test_secret_values_are_never_hardcoded_in_settings(self):
        """Other secret-bearing settings must default to EMPTY (forcing .env
        configuration), never to a usable credential."""
        source = (Path(settings.BASE_DIR) / 'config' / 'settings.py').read_text(encoding='utf-8')
        for var in ('RAZORPAY_KEY_SECRET', 'EMAIL_HOST_PASSWORD',
                    'GOOGLE_OAUTH_CLIENT_SECRET', 'DB_PASSWORD'):
            for line in source.splitlines():
                if f"config('{var}'" in line:
                    self.assertNotIn(
                        "default='", line.replace("default=''", ''),
                        msg=f'{var} must not have a non-empty committed default',
                    )
