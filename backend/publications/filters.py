from django_filters import rest_framework as filters
from .models import Book

class BookFilter(filters.FilterSet):
    min_price = filters.NumberFilter(field_name="price", lookup_expr='gte')
    max_price = filters.NumberFilter(field_name="price", lookup_expr='lte')

    class Meta:
        model = Book
        fields = ['category', 'is_featured', 'min_price', 'max_price']
