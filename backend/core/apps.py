from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'
    verbose_name = 'Core Services'

    def ready(self):
        # Keep the ADM public ID (spec §2) attached to any account that holds
        # staff access, whichever code path granted it.
        from django.conf import settings
        from django.db.models.signals import post_save

        from core.handlers import assign_admin_profile

        app_label, model_name = settings.AUTH_USER_MODEL.split('.')
        user_model = self.apps.get_model(app_label, model_name)
        post_save.connect(
            assign_admin_profile, sender=user_model,
            dispatch_uid='core.assign_admin_profile',
        )

        # Register post-save signals for WebP image variant generation.
        import core.image_signals  # noqa: F401

        # Register cache invalidation signals for public read caches so admin deletes & edits reflect instantly
        from django.db.models.signals import post_delete
        from core.caching import invalidate_public_api_cache

        models_to_monitor = [
            ('publications', 'Book'),
            ('publications', 'Category'),
            ('publications', 'Journal'),
            ('publications', 'JournalIssue'),
            ('publications', 'JournalArticle'),
            ('publications', 'BookChapter'),
            ('publications', 'Testimonial'),
            ('conferences', 'Conference'),
            ('slider', 'SliderImage'),
            ('policies', 'Policy'),
        ]

        def _invalidation_handler(sender, **kwargs):
            invalidate_public_api_cache()

        for app_lbl, mdl_name in models_to_monitor:
            try:
                mdl = self.apps.get_model(app_lbl, mdl_name)
                post_save.connect(_invalidation_handler, sender=mdl, weak=False, dispatch_uid=f'core_invalidate_save_{app_lbl}_{mdl_name}')
                post_delete.connect(_invalidation_handler, sender=mdl, weak=False, dispatch_uid=f'core_invalidate_del_{app_lbl}_{mdl_name}')
            except (LookupError, Exception):
                pass
