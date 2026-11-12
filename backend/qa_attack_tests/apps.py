from django.apps import AppConfig


class QaAttackTestsConfig(AppConfig):
    # Pure test app: no models, so no migrations and no default_auto_field
    # warning surface, but the field is set to stay consistent with the rest
    # of the project.
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'qa_attack_tests'
