# Data migration: reconcile dispatched_at/delivered_at with the operational
# fulfillment stage on every existing order. The fulfillment_status field is
# the truth the admin Fulfillment desk maintains; stage timestamps are audit
# history. Rows like "fulfillment_status='dispatched' but delivered_at set"
# made the customer dashboard show Delivered while the admin side showed
# Dispatched. This migration strips contradictory timestamps and backfills
# missing ones for stages already reached.
from django.db import migrations
from django.utils import timezone

STAGES = ['not_required', 'pending', 'processing', 'packed', 'dispatched', 'delivered']


def normalize_fulfillment_timestamps(apps, schema_editor):
    Order = apps.get_model('orders', 'Order')
    now = timezone.now()
    for order in Order.objects.all():
        if order.fulfillment_status == 'cancelled':
            continue  # preserve shipping history on cancelled consignments
        rank = STAGES.index(order.fulfillment_status) if order.fulfillment_status in STAGES else 0
        fields = []
        if rank >= 4 and not order.dispatched_at:
            order.dispatched_at = now
            fields.append('dispatched_at')
        if rank >= 5 and not order.delivered_at:
            order.delivered_at = now
            fields.append('delivered_at')
        if rank < 4 and order.dispatched_at:
            order.dispatched_at = None
            fields.append('dispatched_at')
        if rank < 5 and order.delivered_at:
            order.delivered_at = None
            fields.append('delivered_at')
        if fields:
            order.save(update_fields=fields)


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0011_orderitem_article'),
    ]

    operations = [
        migrations.RunPython(normalize_fulfillment_timestamps, migrations.RunPython.noop),
    ]
