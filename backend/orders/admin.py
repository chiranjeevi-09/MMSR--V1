from django.contrib import admin
from django.utils.html import format_html
import urllib.parse
from .models import Order, OrderItem

class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ('book', 'journal_issue', 'journal_subscription', 'quantity', 'price')
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        'order_id', 
        'user', 
        'full_name', 
        'phone_number', 
        'total_amount', 
        'status', 
        'send_message', 
        'download_invoice', 
        'created_at'
    )
    list_display_links = ('order_id',)
    list_filter = ('status', 'created_at')
    search_fields = ('user__email', 'id', 'transaction_id', 'full_name', 'phone_number')
    inlines = [OrderItemInline]
    readonly_fields = ('created_at', 'updated_at')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
    # 1. Custom column for Order ID
    def order_id(self, obj):
        return obj.custom_order_id or f"#{obj.id}"
    order_id.short_description = 'Order ID'
    order_id.admin_order_field = 'id'

    # 2. Custom column to Send Message to WhatsApp
    def send_message(self, obj):
        status_display = obj.get_status_display()
        order_identifier = obj.custom_order_id or f"#{obj.id}"
        message = f"Hello! Your MMSR order {order_identifier} status is currently: {status_display}."
        encoded_message = urllib.parse.quote(message)
        # Clean phone number (extract digits only)
        phone = "".join([c for c in obj.phone_number if c.isdigit()])
        
        # Prepend country code '91' if length is 10 digits
        if len(phone) == 10:
            phone = "91" + phone
            
        whatsapp_url = f"https://wa.me/{phone}?text={encoded_message}"
        
        return format_html(
            '<a class="button" href="{}" target="_blank" style="background-color: #25D366; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold; text-decoration: none; font-size: 11px; display: inline-block;">Send</a>',
            whatsapp_url
        )
    send_message.short_description = 'Send Message'

    # 3. Custom column to Download Invoice
    def download_invoice(self, obj):
        if obj.status == 'paid' or obj.invoice_pdf:
            invoice_url = f"/api/commerce/orders/{obj.id}/invoice/"
            return format_html(
                '<a class="button" href="{}" download style="background-color: #0077b6; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold; text-decoration: none; font-size: 11px; display: inline-block;">Download</a>',
                invoice_url
            )
        else:
            return format_html(
                '<a class="button" href="#" onclick="alert(\'Invoice not available for this order.\'); return false;" style="background-color: #ef4444; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold; text-decoration: none; font-size: 11px; display: inline-block;">Download</a>'
            )
    download_invoice.short_description = 'Download Invoice'

