from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.authentication import SessionAuthentication
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.http import FileResponse
from django.conf import settings
from django.db import models, transaction, IntegrityError
from django.utils import timezone
from decimal import Decimal
from .models import Order, OrderItem
from publications.models import Book, Journal, JournalIssue, JournalArticle
from .serializers import OrderSerializer, CreateOrderSerializer
from .utils import generate_invoice, grant_journal_access_for_order, order_reference
from .tasks import enqueue_invoice_job, dispatch_invoice_job
from core.api import PublicIDLookupMixin, is_valid_public_id
from core.downloads import protected_file_response
import razorpay
import logging
import uuid

logger = logging.getLogger(__name__)

INVALID_CART_MESSAGE = (
    "One or more items in your cart are invalid or no longer exist. "
    "Please refresh your cart."
)


class OrderLineError(Exception):
    """A cart line cannot be turned into an order item.

    Every message on this type is written for the customer, which is why the
    view can echo ``str(exc)`` directly; anything unexpected keeps the generic
    INVALID_CART_MESSAGE instead of leaking model detail.
    """


def _resolve_order_line(item_data):
    """Validate one cart line and return the ``OrderItem`` kwargs for it.

    Prices always come from the database, never from the request. Resolving
    every line up front means the write path only starts once the whole cart is
    known to be good, so a hostile payload can no longer fail halfway through
    an order (SECURITY-QA-REPORT H-4).
    """
    book_id = item_data.get('book_id') or item_data.get('book')
    issue_id = item_data.get('journal_issue_id') or item_data.get('journal_issue')
    sub_id = item_data.get('journal_subscription_id') or item_data.get('journal_subscription')
    article_id = item_data.get('article_id') or item_data.get('article')

    # Ensure exactly ONE product reference ID is provided per item
    provided_ids = [p for p in (book_id, issue_id, sub_id, article_id) if p is not None]
    if len(provided_ids) != 1:
        raise OrderLineError("Each order item must reference exactly one product.")

    # The serializer bounds this at 1..99 and the model column is positive;
    # re-checking here covers every other caller of this resolver.
    quantity = item_data.get('quantity', 1)
    if not isinstance(quantity, int) or quantity < 1 or quantity > 99:
        raise OrderLineError("Quantity must be a whole number between 1 and 99.")

    if book_id:
        try:
            book = Book.objects.get(id=book_id)
        except (Book.DoesNotExist, ValueError, TypeError):
            raise OrderLineError(INVALID_CART_MESSAGE)
        return {'book': book, 'price': book.price, 'format': 'print', 'quantity': quantity}

    if issue_id:
        # Issue-level purchasing has been removed. Complete-issue PDF access is
        # granted only via a journal subscription; individual papers via article
        # purchase. Reject any direct attempt to buy an issue (digital/print/bundle).
        raise OrderLineError(
            "Individual issue purchases are no longer offered. Subscribe to the "
            "journal to access its complete issue PDFs, or purchase a specific article."
        )

    if sub_id:
        try:
            journal = Journal.objects.get(id=sub_id)
        except (Journal.DoesNotExist, ValueError, TypeError):
            raise OrderLineError(INVALID_CART_MESSAGE)
        return {
            'journal_subscription': journal,
            'price': journal.subscription_price_annual,
            'format': 'digital',
            'quantity': quantity,
        }

    try:
        article = JournalArticle.objects.get(id=article_id)
    except (JournalArticle.DoesNotExist, ValueError, TypeError):
        raise OrderLineError(INVALID_CART_MESSAGE)

    if article.status != 'published':
        raise OrderLineError(f"Article '{article.title}' is not available for purchase.")

    # Server-side pricing: client never dictates the amount.
    # A Paid Access article MUST have a positive price configured
    # by the admin; otherwise it cannot be sold (prevents a ₹0
    # "purchase" that would unlock a paid download for free).
    if article.access_mode == 'paid':
        if article.price is None or article.price <= 0:
            raise OrderLineError(
                f"Article '{article.title}' has no purchase price configured yet. "
                "Please contact the publisher."
            )
        price = article.price
    else:
        # Open access / preview articles are not purchasable.
        raise OrderLineError(f"Article '{article.title}' is not available for purchase.")

    return {'article': article, 'price': price, 'format': 'digital', 'quantity': quantity}


class OrderViewSet(PublicIDLookupMixin, viewsets.ModelViewSet):
    authentication_classes = [SessionAuthentication, JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def finalize_response(self, request, response, *args, **kwargs):
        """Every response here carries private order/PII data (or the invoice
        PDF): shared caches must never store it, under any circumstance."""
        response = super().finalize_response(request, response, *args, **kwargs)
        response['Cache-Control'] = 'no-store'
        response['Vary'] = 'Authorization, Cookie'
        return response

    # Generic PUT/PATCH/DELETE are deliberately disabled: they let an order's
    # owner rewrite financial/fulfillment fields (total_amount, status, courier
    # data, timestamps) on their own orders or erase order history, and no
    # workflow uses them. Writes go through create() plus the guarded actions
    # (payment endpoints, update_status, update_fulfillment) only.
    http_method_names = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        qs = (
            Order.objects.all() if self.request.user.is_staff else Order.objects.filter(user=self.request.user)
        ).select_related('user').prefetch_related(
            'items__book',
            'items__journal_issue',
            'items__journal_subscription',
            'items__article',
        )
        if self.request.query_params.get('fulfillment_only') == 'true' or self.request.query_params.get('physical_only') == 'true':
            qs = qs.filter(
                models.Q(items__journal_issue__isnull=False, items__format__in=['print', 'bundle']) |
                models.Q(items__book__isnull=False, items__format='print')
            ).distinct()
        f_status = self.request.query_params.get('fulfillment_status')
        if f_status:
            qs = qs.filter(fulfillment_status=f_status)
        return qs.order_by('-created_at')
    
    def get_serializer_class(self):
        if self.action == 'create':
            return CreateOrderSerializer
        return OrderSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        items_data = serializer.validated_data.pop('items')
        # Ignore frontend-provided total_amount for security
        serializer.validated_data.pop('total_amount', None)

        # An empty cart used to create a paid-ready ₹0 (or shipping-only) order.
        if not items_data:
            return Response(
                {"error": "Your cart is empty. Add at least one title before checking out."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Resolve and price EVERY line before a single row is written, so an
        # invalid cart is a plain 400 instead of a half-built order.
        try:
            lines = [_resolve_order_line(item) for item in items_data]
        except OrderLineError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        # SECURITY-QA-REPORT H-4: the order header and its lines are one unit of
        # work. Previously the parent row was committed before the items were
        # written and compensated with order.delete() only for the exception
        # types this code happened to name, so anything else (a CHECK-constraint
        # IntegrityError, a timeout) left a phantom ₹0 order in the
        # admin/fulfilment queues and burned an MMSR-ORD sequence number.
        try:
            with transaction.atomic():
                order = Order.objects.create(user=self.request.user, total_amount=Decimal('0.00'), **serializer.validated_data)

                calculated_total = Decimal('0.00')
                for line in lines:
                    item = OrderItem(order=order, **line)
                    item.save()
                    calculated_total += Decimal(str(item.price)) * Decimal(str(item.quantity))

                # Set Order.total_amount using the server-calculated value
                order.total_amount = calculated_total
                if order.requires_shipping():
                    # Add discounted flat shipping (Rs.40, 50% off Rs.80) for physical orders
                    order.total_amount = calculated_total + order.get_shipping_amount()
                    order.fulfillment_status = 'pending'
                else:
                    order.fulfillment_status = 'not_required'
                # The legacy category-based reference is no longer minted here:
                # Order.save() allocates the standardized MMSR-ORD-1931-NNNNNN
                # public ID and mirrors it into custom_order_id (Phase 5).
                order.save()
        except IntegrityError as exc:
            # The transaction rolled back with it, so nothing is orphaned; the
            # message stays generic because the driver text can name columns.
            logger.error(f"Order creation rejected by the database for user #{self.request.user.id}: {exc}")
            return Response(
                {"error": INVALID_CART_MESSAGE},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def initiate_razorpay(self, request, pk=None):
        order = self.get_object()
        
        # Ensure Razorpay keys are configured
        if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET or settings.RAZORPAY_KEY_ID.startswith('rzp_XXXXXXXXXX') or settings.RAZORPAY_KEY_ID == '':
            return Response({"error": "Razorpay credentials are not configured in the backend environment. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the .env file."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
            # Amount in paise (1 INR = 100 paise)
            amount_in_paise = int(round(order.total_amount * 100))
            
            razorpay_order_data = {
                "amount": amount_in_paise,
                "currency": "INR",
                "receipt": f"receipt_order_{order.id}",
                "payment_capture": 1 # auto capture
            }
            
            razorpay_order = client.order.create(data=razorpay_order_data)
            
            order.razorpay_order_id = razorpay_order['id']
            order.save()
            
            return Response({
                "id": razorpay_order['id'],
                "amount": razorpay_order['amount'],
                "currency": razorpay_order['currency'],
                "key_id": settings.RAZORPAY_KEY_ID,
                "use_mock": False
            })
        except Exception as e:
            logger.error(f"Error creating Razorpay Order: {str(e)}")
            err_str = str(e)
            if 'Authentication' in err_str or 'authentication' in err_str:
                return Response({"error": "Razorpay authentication failed. Your API keys may be invalid or expired. Please update RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the .env file with fresh keys from your Razorpay Dashboard."}, status=status.HTTP_400_BAD_REQUEST)
            # Raw gateway text stays in the log only (audit §4): Razorpay's
            # exception payload can echo payment-entity internals.
            return Response({"error": "Failed to initiate Razorpay order"}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def verify_razorpay(self, request, pk=None):
        order = self.get_object()
        razorpay_payment_id = request.data.get('razorpay_payment_id')
        razorpay_order_id = request.data.get('razorpay_order_id')
        razorpay_signature = request.data.get('razorpay_signature')
        
        if not razorpay_payment_id or not razorpay_order_id or not razorpay_signature:
            return Response({"error": "Missing verification parameters"}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Already paid check - prevent duplicate invoice/email generation & ensure entitlements
        if order.status == 'paid':
            try:
                grant_journal_access_for_order(order)
            except Exception as access_err:
                logger.error(f"Failed to grant journal access on paid check for Order #{order.id}: {str(access_err)}")
            return Response({"status": "success", "message": "Payment already verified"})

        # 2. Prevent same Razorpay payment ID from being used on another order
        if Order.objects.filter(razorpay_payment_id=razorpay_payment_id).exclude(pk=order.pk).exists():
            return Response({"status": "failed", "error": "This payment ID has already been used for another order."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
            
            # Verify signature
            params_dict = {
                'razorpay_order_id': razorpay_order_id,
                'razorpay_payment_id': razorpay_payment_id,
                'razorpay_signature': razorpay_signature
            }
            client.utility.verify_payment_signature(params_dict)
            
            # Verify Razorpay payment amount and currency
            payment = client.payment.fetch(razorpay_payment_id)
            expected_amount_paise = int(round(order.total_amount * 100))
            paid_amount = payment.get('amount')
            
            if paid_amount is not None and int(paid_amount) != expected_amount_paise:
                logger.error(f"Razorpay verification failed for Order #{order.id}: Amount mismatch (Expected {expected_amount_paise} paise, got {paid_amount} paise)")
                return Response({"status": "failed", "error": "Payment amount mismatch"}, status=status.HTTP_400_BAD_REQUEST)
                
            currency = payment.get('currency', 'INR')
            if currency and str(currency).upper() != 'INR':
                logger.error(f"Razorpay verification failed for Order #{order.id}: Currency mismatch (Expected INR, got {currency})")
                return Response({"status": "failed", "error": "Payment currency mismatch"}, status=status.HTTP_400_BAD_REQUEST)
            
            # Signature, amount and currency valid. Update order atomically under lock (PAY-02).
            flipped = False
            with transaction.atomic():
                locked_order = Order.objects.select_for_update().filter(pk=order.pk).first()
                if not locked_order:
                    return Response({"status": "failed", "error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)

                if locked_order.status in Order.PAID_STATUSES:
                    try:
                        grant_journal_access_for_order(locked_order)
                    except Exception as access_err:
                        logger.error(f"Failed to grant journal access on paid check for Order #{locked_order.id}: {access_err}")
                    return Response({"status": "success", "message": "Payment already verified"})

                if Order.objects.filter(razorpay_payment_id=razorpay_payment_id).exclude(pk=locked_order.pk).exists():
                    return Response({"status": "failed", "error": "This payment ID has already been used for another order."}, status=status.HTTP_400_BAD_REQUEST)

                update_fields = {
                    'status': 'paid',
                    'razorpay_payment_id': razorpay_payment_id,
                    'razorpay_signature': razorpay_signature,
                    'transaction_id': razorpay_payment_id,
                }
                if locked_order.requires_shipping() and locked_order.fulfillment_status == 'not_required':
                    update_fields['fulfillment_status'] = 'pending'

                flipped = bool(Order.objects.filter(pk=locked_order.pk).exclude(status__in=Order.PAID_STATUSES).update(**update_fields))
                locked_order.refresh_from_db()

                if flipped:
                    # Enqueue invoice/email job in DB outbox inside this atomic transaction (PAY-02).
                    from orders.job_models import InvoiceJob as _IJ
                    _job, _ = _IJ.objects.get_or_create(
                        order=locked_order,
                        defaults={'status': _IJ.STATUS_PENDING},
                    )
                    transaction.on_commit(lambda job_id=_job.id: dispatch_invoice_job(job_id))

            if flipped:
                # Grant journal entitlements for eligible items
                try:
                    grant_journal_access_for_order(locked_order)
                except Exception as access_err:
                    logger.error(f"Failed to grant journal access for Order #{locked_order.id}: {str(access_err)}")

            return Response({"status": "success", "message": "Payment verified successfully"})
        except Exception as e:
            # Log the full provider error server-side only. The client gets a
            # generic failure message (audit §4: sensitive payment details must
            # not be leaked in error responses) — never the raw Razorpay/SDK
            # exception text, which can echo payment-entity internals.
            logger.error(f"Razorpay verification failed for Order #{order.id}: {str(e)}")
            order.refresh_from_db()
            if order.status not in Order.PAID_STATUSES:
                order.status = 'cancelled'
                order.save(update_fields=['status'])
            return Response({"status": "failed", "error": "Payment verification failed."}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def simulate_payment(self, request, pk=None):
        """DEV/TEST ONLY: complete an order without charging a card.

        The shared Razorpay test account declines the standard 4111... test Visa
        as "International cards are not supported", which blocks end-to-end
        testing. This endpoint flips the order to paid through the SAME success
        path as a real verified payment, but is hard-gated to Django DEBUG plus a
        Razorpay TEST key so it can never run against a live account.
        """
        if not getattr(settings, 'DEBUG', False):
            return Response({"error": "simulate_payment is only available in a DEBUG environment."}, status=status.HTTP_403_FORBIDDEN)
        key_id = settings.RAZORPAY_KEY_ID or ''
        if not key_id.startswith('rzp_test_'):
            return Response({"error": "simulate_payment requires Razorpay test keys."}, status=status.HTTP_403_FORBIDDEN)

        order = self.get_object()
        if order.status == 'paid':
            return Response({"status": "success", "message": "Order already paid"})

        sim_payment_id = f"pay_sim_{uuid.uuid4().hex[:14]}"
        with transaction.atomic():
            order.razorpay_payment_id = sim_payment_id
            order.razorpay_signature = f"sim_{uuid.uuid4().hex}"
            order.transaction_id = sim_payment_id
            order.status = 'paid'
            if order.requires_shipping() and order.fulfillment_status == 'not_required':
                order.fulfillment_status = 'pending'
            order.save()

            # Enqueue background invoice job in DB outbox inside transaction.
            _sim_job = enqueue_invoice_job(order)
            transaction.on_commit(lambda job_id=_sim_job.id: dispatch_invoice_job(job_id))

        try:
            grant_journal_access_for_order(order)
        except Exception as access_err:
            logger.error(f"[simulate] journal access failed for Order #{order.id}: {str(access_err)}")

        logger.info(f"[simulate] Order #{order.id} marked paid via dev simulate_payment.")
        return Response({"status": "success", "message": "Test payment simulated successfully", "payment_id": sim_payment_id})

    @action(detail=True, methods=['post'])
    def cancel_payment(self, request, pk=None):
        order = self.get_object()
        reason = request.data.get('reason', 'Payment cancelled by user')

        # Only unpaid (pending) orders may be cancelled through this endpoint.
        # Paid orders have captured money and there is no refund workflow, so
        # flipping them to cancelled here would misreport the transaction.
        if order.status in ('paid', 'shipped', 'delivered'):
            return Response(
                {"error": "Paid orders cannot be cancelled: refunds are not yet supported. Contact the publisher to process a refund manually."},
                status=status.HTTP_400_BAD_REQUEST
            )
        if order.status == 'cancelled':
            return Response({"status": "cancelled", "reason": reason, "message": "Order was already cancelled"})
        
        # If Razorpay keys are configured and it's a UPI QR payment, close it
        if settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET and not settings.RAZORPAY_KEY_ID.startswith('rzp_XXXXXXXXXX') and settings.RAZORPAY_KEY_ID != '':
            if order.payment_method == 'upi' and order.razorpay_order_id and order.razorpay_order_id.startswith('qr_'):
                try:
                    import requests
                    auth = (settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
                    res = requests.post(f"https://api.razorpay.com/v1/payments/qr_codes/{order.razorpay_order_id}/close", auth=auth)
                    if res.status_code == 200:
                        logger.info(f"Successfully closed Razorpay QR Code {order.razorpay_order_id}")
                except Exception as e:
                    logger.error(f"Failed to close Razorpay QR Code: {str(e)}")
                    
        order.status = 'cancelled'
        order.save()
        return Response({"status": "cancelled", "reason": reason})

    @action(detail=True, methods=['post'])
    def generate_qr_code(self, request, pk=None):
        order = self.get_object()
        
        # Ensure Razorpay keys are configured
        if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET or settings.RAZORPAY_KEY_ID.startswith('rzp_XXXXXXXXXX') or settings.RAZORPAY_KEY_ID == '':
            return Response({"error": "Razorpay credentials are not configured in the backend environment. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the .env file."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            import time
            import requests
            amount_paise = int(order.total_amount * 100)
            qr_data = {
                "type": "upi_qr",
                "name": "MMSR Publications",
                "usage": "single_use",
                "fixed_amount": True,
                "payment_amount": amount_paise,
                "description": f"Payment for Order {order.public_id or order.custom_order_id or order.id}",
                "close_by": int(time.time() + 120)  # expires in 2 minutes
            }
            
            auth = (settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
            res = requests.post("https://api.razorpay.com/v1/payments/qr_codes", json=qr_data, auth=auth)
            
            if res.status_code != 200 and res.status_code != 201:
                logger.error(f"Razorpay QR Code creation failed: {res.text}")
                # The gateway body is logged, never echoed (audit §4).
                return Response({"error": "Failed to create QR Code in Razorpay"}, status=status.HTTP_400_BAD_REQUEST)
                
            qr_resp = res.json()
            
            order.razorpay_order_id = qr_resp.get('id')
            order.payment_method = 'upi'
            order.save()
            
            return Response({
                "use_mock": False,
                "qr_id": qr_resp.get('id'),
                "image_url": qr_resp.get('image_url') or f"https://api.qrserver.com/v1/create-qr-code/?size=250x250&data={qr_resp.get('image_url')}",
                "amount": float(order.total_amount),
                "order_id": qr_resp.get('id')
            })
            
        except Exception as e:
            logger.error(f"Error initiating Razorpay QR Code: {str(e)}")
            # Generic client message: the raw exception can name internal
            # hosts/connection details (audit §4).
            return Response({"error": "Internal error initiating QR."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def check_qr_payment(self, request, pk=None):
        order = self.get_object()
        
        # If order is already paid, return success directly
        if order.status == 'paid':
            return Response({
                "status": "success",
                "payment_id": order.razorpay_payment_id or order.transaction_id,
                "amount": float(order.total_amount),
                "payment_method": order.payment_method or 'upi'
            })
            
        if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET or settings.RAZORPAY_KEY_ID == '':
            return Response({"error": "Razorpay credentials are not configured in the backend environment. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the .env file."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            import requests
            qr_id = order.razorpay_order_id
            if not qr_id or not qr_id.startswith('qr_'):
                return Response({"status": "pending", "message": "No active QR Code linked"})
                
            auth = (settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
            res = requests.get(f"https://api.razorpay.com/v1/payments/qr_codes/{qr_id}/payments", auth=auth)
            
            if res.status_code == 200:
                payments_resp = res.json()
                items = payments_resp.get('items', [])
                successful_payment = None
                for p in items:
                    if p.get('status') == 'captured':
                        successful_payment = p
                        break
                        
                if successful_payment:
                    # Server-side verification (audit M-2): the QR payments
                    # list is fetched from Razorpay with OUR keys, so a
                    # captured entry is genuinely associated with this
                    # order's single-use QR — but the previous code flipped
                    # the order to paid on status alone. Amount, currency,
                    # payment-ID uniqueness and expected order state must
                    # ALL match before any entitlement is granted.
                    payment_id = successful_payment.get('id')
                    expected_amount_paise = int(round(order.total_amount * 100))
                    paid_amount = successful_payment.get('amount')
                    currency = successful_payment.get('currency') or 'INR'

                    if not payment_id:
                        logger.error(f"QR verification failed for Order #{order.id}: captured payment without id")
                        return Response({"status": "failed", "error": "Malformed payment record from Razorpay."}, status=status.HTTP_400_BAD_REQUEST)

                    if paid_amount is None or int(paid_amount) != expected_amount_paise:
                        logger.error(f"QR verification failed for Order #{order.id}: Amount mismatch (Expected {expected_amount_paise} paise, got {paid_amount})")
                        return Response({"status": "failed", "error": "Payment amount mismatch"}, status=status.HTTP_400_BAD_REQUEST)

                    if str(currency).upper() != 'INR':
                        logger.error(f"QR verification failed for Order #{order.id}: Currency mismatch (Expected INR, got {currency})")
                        return Response({"status": "failed", "error": "Payment currency mismatch"}, status=status.HTTP_400_BAD_REQUEST)

                    if Order.objects.filter(razorpay_payment_id=payment_id).exclude(pk=order.pk).exists():
                        logger.error(f"QR verification failed for Order #{order.id}: payment {payment_id} already used on another order")
                        return Response({"status": "failed", "error": "This payment ID has already been used for another order."}, status=status.HTTP_400_BAD_REQUEST)

                    with transaction.atomic():
                        # Idempotent conditional flip: concurrent polls of
                        # the same order must never double-grant entitlements
                        # or generate a second invoice.
                        update_fields = {
                            'status': 'paid',
                            'razorpay_payment_id': payment_id,
                            'transaction_id': payment_id,
                            'payment_method': 'upi',
                        }
                        if order.requires_shipping() and order.fulfillment_status == 'not_required':
                            update_fields['fulfillment_status'] = 'pending'
                        flipped = (
                            Order.objects.filter(pk=order.pk)
                            .exclude(status='paid')
                            .update(**update_fields)
                        )
                        order.refresh_from_db()

                        if flipped:
                            # Enqueue background invoice job in DB outbox inside atomic transaction.
                            from orders.job_models import InvoiceJob as _IJ
                            _qr_job, _ = _IJ.objects.get_or_create(
                                order=order,
                                defaults={'status': _IJ.STATUS_PENDING},
                            )
                            transaction.on_commit(lambda job_id=_qr_job.id: dispatch_invoice_job(job_id))

                    if flipped:
                        try:
                            grant_journal_access_for_order(order)
                        except Exception as access_err:
                            logger.error(f"Failed to grant journal access for QR Order #{order.id}: {str(access_err)}")

                    return Response({
                        "status": "success",
                        "payment_id": order.razorpay_payment_id,
                        "amount": float(order.total_amount),
                        "payment_method": "upi"
                    })
                    
            return Response({
                "status": "pending",
                "message": "Payment not detected yet"
            })
            
        except Exception as e:
            logger.error(f"Error checking QR payment: {str(e)}")
            return Response({"status": "pending", "message": "Error checking status"})

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAdminUser], url_path='stats')
    def admin_stats(self, request):
        """Server-side commerce aggregates for the admin dashboard.

        Computed with SQL so the numbers stay correct regardless of list
        pagination (the plain list endpoint only ever returns one page).
        """
        revenue = Order.objects.filter(
            status__in=['paid', 'shipped', 'delivered']
        ).aggregate(total=models.Sum('total_amount'))['total'] or Decimal('0.00')
        return Response({
            'total_revenue': str(revenue),
            'paid_orders': Order.objects.filter(status__in=['paid', 'shipped', 'delivered']).count(),
            'orders_today': Order.objects.filter(created_at__date=timezone.localdate()).count(),
            'orders_total': Order.objects.count(),
        })

    @action(detail=True, methods=['get'],
            authentication_classes=[SessionAuthentication, JWTAuthentication],
            permission_classes=[permissions.IsAuthenticated])
    def invoice(self, request, pk=None):
        # SECURITY-QA-REPORT M-2: this action used to turn DRF authentication
        # off (authentication_classes=[], AllowAny) and decode the bearer token
        # by hand. The hand-rolled path loaded the user with
        # ``User.objects.get(id=user_id)`` and never checked ``is_active``, so a
        # deactivated/suspended account kept downloading invoices (401 on
        # /profile, 200 PDF here) while the two registered invoice routes
        # enforced different rules. JWTAuthentication.get_user() rejects
        # inactive users, blacklisted tokens and bad signatures, so the standard
        # stack is both smaller and stricter than the code it replaces.
        user = request.user

        try:
            # The detail route accepts either the internal pk or the MMSR
            # public ID (spec §7). A public ID must never be handed to the pk
            # column: an int lookup on "MMSR-ORD-…" would raise ValueError.
            if is_valid_public_id(pk):
                order = Order.objects.get(public_id=pk)
            else:
                order = Order.objects.get(pk=pk)
        except (Order.DoesNotExist, ValueError):
            return Response({"error": "Order not found."}, status=status.HTTP_404_NOT_FOUND)

        if not user.is_staff and order.user != user:
            return Response({"error": "You do not have permission to access this invoice."}, status=status.HTTP_403_FORBIDDEN)

        if not order.invoice_pdf and order.status == 'paid':
            try:
                generate_invoice(order)
                order.refresh_from_db()
            except Exception as gen_err:
                logger.error(f"Error generating invoice for Order #{order.id}: {str(gen_err)}")

        if not order.invoice_pdf:
            return Response({"error": "Invoice not available for this order."}, status=status.HTTP_404_NOT_FOUND)

        try:
            filename = f"invoice_{order_reference(order)}"
            return protected_file_response(
                order.invoice_pdf,
                download_name=filename,
                disposition='attachment',
                content_type='application/pdf',
            )
        except Exception as e:
            logger.error(f"Error serving invoice file for Order #{order.id}: {str(e)}")
            return Response({"error": "Could not retrieve invoice file."}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAdminUser])
    def update_status(self, request, pk=None):
        """Staff-only order status transition (narrow, validated).

        Payment state ('paid') can only ever be produced by the verified
        Razorpay flow, and physical dispatch/delivery is owned by the
        fulfillment desk (update_fulfillment). The only manual transition this
        workflow supports is cancelling a pending (unpaid) order; everything
        else is rejected with an explicit reason.
        """
        order = self.get_object()
        new_status = request.data.get('status')

        valid_statuses = [c[0] for c in Order.STATUS_CHOICES]
        if new_status not in valid_statuses:
            return Response(
                {"error": f"Invalid status '{new_status}'. Valid choices are: {', '.join(valid_statuses)}."},
                status=status.HTTP_400_BAD_REQUEST
            )

        current = order.status
        if new_status == current:
            return Response(OrderSerializer(order, context={'request': request}).data)

        if new_status == 'paid':
            return Response(
                {"error": "An order can only become 'paid' through the verified Razorpay payment flow. Status cannot be set manually."},
                status=status.HTTP_400_BAD_REQUEST
            )
        if new_status in ('shipped', 'delivered'):
            return Response(
                {"error": "Dispatch and delivery are managed on the Fulfillment desk (update_fulfillment), not through order status."},
                status=status.HTTP_400_BAD_REQUEST
            )
        if new_status == 'cancelled' and current in ('paid', 'shipped', 'delivered'):
            return Response(
                {"error": "Paid orders cannot be cancelled: no refund workflow exists yet."},
                status=status.HTTP_400_BAD_REQUEST
            )
        if new_status == 'pending':
            return Response(
                {"error": f"Cannot move an order from '{current}' back to 'pending'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        order.status = new_status
        order.save()
        return Response(OrderSerializer(order, context={'request': request}).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['patch', 'post'], permission_classes=[permissions.IsAdminUser])
    def update_fulfillment(self, request, pk=None):
        order = self.get_object()

        if not order.requires_shipping():
            return Response(
                {"error": "This order contains only digital items and does not require physical fulfillment."},
                status=status.HTTP_400_BAD_REQUEST
            )

        new_status = request.data.get('fulfillment_status')
        courier_name = request.data.get('courier_name')
        tracking_number = request.data.get('tracking_number')
        tracking_url = request.data.get('tracking_url')
        fulfillment_notes = request.data.get('fulfillment_notes')
        dispatched_at = request.data.get('dispatched_at')
        delivered_at = request.data.get('delivered_at')

        if new_status:
            valid_statuses = [c[0] for c in Order.FULFILLMENT_STATUS_CHOICES]
            if new_status not in valid_statuses:
                return Response(
                    {"error": f"Invalid fulfillment status '{new_status}'. Valid choices are: {', '.join(valid_statuses)}."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Rule: Only paid orders can enter active physical fulfillment
            if order.status != 'paid' and new_status in ['processing', 'packed', 'dispatched', 'delivered']:
                return Response(
                    {"error": "Cannot process or dispatch physical shipment for an unpaid order."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Status transition validation
            current = order.fulfillment_status
            if current == 'delivered' and new_status not in ['delivered', 'cancelled']:
                return Response(
                    {"error": "Delivered orders cannot be reverted to earlier fulfillment stages."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if current == 'cancelled' and new_status not in ['cancelled', 'pending']:
                return Response(
                    {"error": "Cancelled fulfillment can only be reopened to 'pending'."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            order.fulfillment_status = new_status

            if new_status == 'dispatched' and not order.dispatched_at:
                order.dispatched_at = timezone.now()
            elif new_status == 'delivered' and not order.delivered_at:
                order.delivered_at = timezone.now()

        if courier_name is not None:
            order.courier_name = str(courier_name).strip()
        if tracking_number is not None:
            order.tracking_number = str(tracking_number).strip()
        if tracking_url is not None:
            order.tracking_url = str(tracking_url).strip()
        if fulfillment_notes is not None:
            order.fulfillment_notes = str(fulfillment_notes).strip()
        if dispatched_at:
            order.dispatched_at = dispatched_at
        if delivered_at:
            order.delivered_at = delivered_at

        order.save()
        return Response(OrderSerializer(order).data, status=status.HTTP_200_OK)




