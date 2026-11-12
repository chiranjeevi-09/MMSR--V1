import json
import hmac
import hashlib
import logging
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response

from orders.models import Order
from orders.utils import grant_journal_access_for_order, generate_invoice
from orders.tasks import enqueue_invoice_job, dispatch_invoice_job
from conferences.models import ConferenceSubmission

logger = logging.getLogger(__name__)


@method_decorator(csrf_exempt, name='dispatch')
class RazorpayWebhookView(APIView):
    """Secure Razorpay Webhook receiver (PAY-01).

    Processes asynchronous payment status notifications from Razorpay:
      - payment.captured
      - order.paid
      - payment.failed

    Guarantees:
      1. Cryptographic HMAC SHA-256 signature verification via RAZORPAY_WEBHOOK_SECRET.
      2. No payload is trusted or parsed before signature is verified.
      3. Precise matching to existing Order or ConferenceSubmission.
      4. Amount and currency cross-verification.
      5. Replay and double-spend detection (payment ID uniqueness across orders).
      6. Idempotent state transitions: repeated events never create duplicate
         invoices, duplicate entitlements, or corrupted status.
      7. Failed events never mark orders as paid.
    """
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        signature = (
            request.headers.get('X-Razorpay-Signature')
            or request.META.get('HTTP_X_RAZORPAY_SIGNATURE', '')
        )
        if not signature:
            logger.warning("Razorpay webhook received without X-Razorpay-Signature header.")
            return Response({"error": "Missing webhook signature"}, status=status.HTTP_400_BAD_REQUEST)

        webhook_secret = getattr(settings, 'RAZORPAY_WEBHOOK_SECRET', '') or ''
        if not webhook_secret:
            logger.error("RAZORPAY_WEBHOOK_SECRET is not configured on the backend server.")
            return Response({"error": "Webhook processing is not configured"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        raw_body = request.body
        if not raw_body:
            return Response({"error": "Empty webhook payload"}, status=status.HTTP_400_BAD_REQUEST)

        # Cryptographically verify HMAC SHA-256 signature against exact raw request bytes
        try:
            expected_signature = hmac.new(
                webhook_secret.encode('utf-8'),
                raw_body,
                hashlib.sha256
            ).hexdigest()
        except Exception as sig_err:
            logger.error(f"Error computing webhook signature: {sig_err}")
            return Response({"error": "Internal error verifying webhook signature"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if not hmac.compare_digest(expected_signature, signature):
            logger.warning("Razorpay webhook HMAC signature verification failed.")
            return Response({"error": "Invalid webhook signature"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            data = json.loads(raw_body.decode('utf-8'))
        except (json.JSONDecodeError, UnicodeDecodeError):
            logger.warning("Razorpay webhook payload is not valid JSON.")
            return Response({"error": "Malformed JSON payload"}, status=status.HTTP_400_BAD_REQUEST)

        event = data.get('event')
        payload = data.get('payload', {})
        payment_entity = payload.get('payment', {}).get('entity', {})
        order_entity = payload.get('order', {}).get('entity', {})

        logger.info(f"Received valid Razorpay webhook event '{event}' for account {data.get('account_id')}")

        if event in ('payment.captured', 'order.paid'):
            return self._handle_payment_success(event, payment_entity, order_entity)
        elif event == 'payment.failed':
            return self._handle_payment_failure(event, payment_entity, order_entity)
        else:
            return Response({
                "status": "ignored",
                "event": event,
                "message": "Unhandled event type acknowledged"
            }, status=status.HTTP_200_OK)

    def _find_order_or_submission(self, payment_entity, order_entity):
        """Locates the target Order or ConferenceSubmission using razorpay_order_id or receipt."""
        rzp_order_id = payment_entity.get('order_id') or order_entity.get('id')
        receipt = order_entity.get('receipt') or payment_entity.get('receipt')

        order = None
        conf_sub = None

        if rzp_order_id:
            order = Order.objects.filter(razorpay_order_id=rzp_order_id).first()
            if not order:
                conf_sub = ConferenceSubmission.objects.filter(razorpay_order_id=rzp_order_id).first()

        if not order and not conf_sub and receipt:
            if receipt.startswith('receipt_order_'):
                order_pk = receipt.replace('receipt_order_', '').strip()
                if order_pk.isdigit():
                    order = Order.objects.filter(pk=int(order_pk)).first()
            elif receipt.startswith('receipt_conf_submission_'):
                sub_pk = receipt.replace('receipt_conf_submission_', '').strip()
                if sub_pk.isdigit():
                    conf_sub = ConferenceSubmission.objects.filter(pk=int(sub_pk)).first()

        return order, conf_sub, rzp_order_id

    def _handle_payment_success(self, event, payment_entity, order_entity):
        order, conf_sub, rzp_order_id = self._find_order_or_submission(payment_entity, order_entity)

        if not order and not conf_sub:
            logger.warning(
                f"Razorpay webhook '{event}' could not match an existing Order or ConferenceSubmission "
                f"(rzp_order_id: {rzp_order_id}, payment_id: {payment_entity.get('id')})."
            )
            return Response({
                "status": "ignored",
                "message": "No matching order found for payment"
            }, status=status.HTTP_200_OK)

        payment_id = payment_entity.get('id')
        currency = payment_entity.get('currency') or order_entity.get('currency') or 'INR'

        if str(currency).upper() != 'INR':
            logger.error(f"Webhook currency mismatch: expected INR, got {currency}")
            return Response({"status": "failed", "error": "Payment currency mismatch"}, status=status.HTTP_400_BAD_REQUEST)

        # ── 1. Match against standard publication Order ──
        if order:
            expected_paise = int(round(order.total_amount * 100))
            paid_paise = payment_entity.get('amount') or order_entity.get('amount')
            if paid_paise is not None and int(paid_paise) != expected_paise:
                logger.error(f"Webhook amount mismatch for Order #{order.id}: expected {expected_paise}, got {paid_paise}")
                return Response({"status": "failed", "error": "Payment amount mismatch"}, status=status.HTTP_400_BAD_REQUEST)

            if payment_id and Order.objects.filter(razorpay_payment_id=payment_id).exclude(pk=order.pk).exists():
                logger.error(f"Webhook payment ID {payment_id} already used on another order.")
                return Response({"status": "failed", "error": "Payment ID already used on another order"}, status=status.HTTP_400_BAD_REQUEST)

            flipped = False
            with transaction.atomic():
                locked = Order.objects.select_for_update().filter(pk=order.pk).first()
                if not locked:
                    return Response({"status": "failed", "error": "Order no longer exists"}, status=status.HTTP_404_NOT_FOUND)

                if locked.status in Order.PAID_STATUSES:
                    # Idempotent: already marked paid by earlier client verify or webhook
                    return Response({"status": "success", "message": "Order was already paid"}, status=status.HTTP_200_OK)

                update_fields = {
                    'status': 'paid',
                    'payment_method': payment_entity.get('method') or locked.payment_method or 'razorpay',
                }
                if payment_id:
                    update_fields['razorpay_payment_id'] = payment_id
                    update_fields['transaction_id'] = payment_id
                if rzp_order_id and not locked.razorpay_order_id:
                    update_fields['razorpay_order_id'] = rzp_order_id
                if locked.requires_shipping() and locked.fulfillment_status == 'not_required':
                    update_fields['fulfillment_status'] = 'pending'

                flipped = bool(Order.objects.filter(pk=locked.pk).exclude(status__in=Order.PAID_STATUSES).update(**update_fields))
                locked.refresh_from_db()

                if flipped:
                    # Enqueue background invoice job in DB outbox inside atomic transaction.
                    from orders.job_models import InvoiceJob as _IJ
                    _wh_job, _ = _IJ.objects.get_or_create(
                        order=locked,
                        defaults={'status': _IJ.STATUS_PENDING},
                    )
                    transaction.on_commit(lambda job_id=_wh_job.id: dispatch_invoice_job(job_id))

            if flipped:
                try:
                    grant_journal_access_for_order(locked)
                except Exception as access_err:
                    logger.error(f"Failed to grant journal access via webhook for Order #{locked.id}: {access_err}")

                logger.info(f"Order #{locked.id} ({locked.public_id}) successfully confirmed and marked paid via webhook '{event}'.")

            return Response({
                "status": "success",
                "message": "Order marked paid successfully via webhook"
            }, status=status.HTTP_200_OK)

        # ── 2. Match against ConferenceSubmission ──
        if conf_sub:
            expected_paise = int(round(conf_sub.submission_fee * 100))
            paid_paise = payment_entity.get('amount') or order_entity.get('amount')
            if paid_paise is not None and int(paid_paise) != expected_paise:
                logger.error(f"Webhook amount mismatch for Conference Submission #{conf_sub.id}: expected {expected_paise}, got {paid_paise}")
                return Response({"status": "failed", "error": "Payment amount mismatch"}, status=status.HTTP_400_BAD_REQUEST)

            if payment_id and ConferenceSubmission.objects.filter(razorpay_payment_id=payment_id).exclude(pk=conf_sub.pk).exists():
                logger.error(f"Webhook payment ID {payment_id} already used on another conference submission.")
                return Response({"status": "failed", "error": "Payment ID already used on another submission"}, status=status.HTTP_400_BAD_REQUEST)

            flipped = False
            with transaction.atomic():
                locked_sub = ConferenceSubmission.objects.select_for_update().filter(pk=conf_sub.pk).first()
                if not locked_sub:
                    return Response({"status": "failed", "error": "Submission no longer exists"}, status=status.HTTP_404_NOT_FOUND)

                if locked_sub.status != 'pending_payment':
                    return Response({"status": "success", "message": "Submission already processed"}, status=status.HTTP_200_OK)

                update_fields = {'status': 'submitted'}
                if payment_id:
                    update_fields['razorpay_payment_id'] = payment_id
                if rzp_order_id and not locked_sub.razorpay_order_id:
                    update_fields['razorpay_order_id'] = rzp_order_id

                flipped = bool(ConferenceSubmission.objects.filter(pk=locked_sub.pk, status='pending_payment').update(**update_fields))
                locked_sub.refresh_from_db()

            if flipped and not locked_sub.invoice_pdf:
                try:
                    from conferences.invoice_utils import generate_conference_invoice
                    generate_conference_invoice(locked_sub)
                except Exception as inv_err:
                    logger.error(f"Failed to generate conference invoice via webhook for #{locked_sub.id}: {inv_err}")

                logger.info(f"Conference submission #{locked_sub.id} ({locked_sub.public_id}) confirmed paid via webhook '{event}'.")

            return Response({
                "status": "success",
                "message": "Conference submission successfully marked as paid via webhook"
            }, status=status.HTTP_200_OK)

    def _handle_payment_failure(self, event, payment_entity, order_entity):
        order, conf_sub, rzp_order_id = self._find_order_or_submission(payment_entity, order_entity)
        if not order and not conf_sub:
            return Response({"status": "ignored", "message": "No matching order found for failed payment"}, status=status.HTTP_200_OK)

        err_desc = payment_entity.get('error_description') or 'Payment failed'
        if order:
            if order.status in Order.PAID_STATUSES:
                logger.warning(f"Webhook received payment.failed for already paid Order #{order.id}; ignoring failure.")
                return Response({"status": "ignored", "message": "Order is already paid"}, status=status.HTTP_200_OK)
            logger.info(f"Webhook recorded payment failure for Order #{order.id}: {err_desc}")
            return Response({"status": "acknowledged", "message": "Payment failure recorded for order"}, status=status.HTTP_200_OK)

        if conf_sub:
            if conf_sub.status != 'pending_payment':
                logger.warning(f"Webhook received payment.failed for already processed Conference Submission #{conf_sub.id}; ignoring failure.")
                return Response({"status": "ignored", "message": "Submission is already processed"}, status=status.HTTP_200_OK)
            logger.info(f"Webhook recorded payment failure for Conference Submission #{conf_sub.id}: {err_desc}")
            return Response({"status": "acknowledged", "message": "Payment failure recorded for submission"}, status=status.HTTP_200_OK)

