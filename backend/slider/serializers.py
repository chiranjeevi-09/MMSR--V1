from rest_framework import serializers
from .models import SliderImage
from form_validation import validate_image_file
from core.image_processing import get_variant_url


class SliderImageSerializer(serializers.ModelSerializer):
    image_webp = serializers.SerializerMethodField()

    class Meta:
        model = SliderImage
        fields = '__all__'
        read_only_fields = ('created_at',)

    def get_image_webp(self, obj):
        return get_variant_url(obj.image, variant='webp', request=self.context.get('request'))

    def validate_image(self, value):
        if value:
            return validate_image_file(value)
        return value
