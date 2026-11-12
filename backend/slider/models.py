from django.db import models

from core.models import PublicIDTrackable


class SliderImage(PublicIDTrackable):
    public_id_prefix = 'SLD'  # MMSR-SLD-1931-NNNNNN (spec §3)
    title = models.CharField(max_length=255, blank=True)
    image = models.ImageField(upload_to='slider/', blank=True, null=True)
    link = models.URLField(blank=True, help_text="URL to redirect when clicked")
    caption = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0, db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', '-created_at']
        indexes = [
            models.Index(fields=['is_active', 'order', '-created_at']),
        ]

    def __str__(self):
        return self.title or f"Slide {self.public_id or self.pk}"
