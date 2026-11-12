import logging
import uuid

import razorpay
from django.conf import settings
from django.db import IntegrityError, transaction
from django.http import FileResponse

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Conference, ConferenceSubmission
from .serializers import (
    ConferenceSerializer,
    ConferenceSubmissionSerializer,
    ConferenceSubmissionCreateSerializer,
)
from config.security_mixins import AlwaysPrivateResponseHeadersMixin
from core.api import PublicIDLookupMixin, find_by_public_id, is_valid_public_id
from core.caching import cache_public_api, invalidate_public_api_cache
from core.downloads import protected_file_response
import os
from django.db.models import Count, Sum, Q, DecimalField
from django.db.models.functions import Coalesce
from decimal import Decimal

logger = logging.getLogger(__name__)


class ConferenceViewSet(viewsets.ModelViewSet):
    """
    Public:  GET /api/conferences/  and  GET /api/conferences/{id|slug}/
    Admin:   POST / PATCH / DELETE (staff only)

    Supports ?accepting=true to list only conferences open for submissions.
    """
    serializer_class = ConferenceSerializer
    queryset = Conference.objects.all()

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [permissions.AllowAny()]
        return [permissions.IsAdminUser()]

    @cache_public_api(timeout=60, prefix="conf_list")
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    def perform_create(self, serializer):
        super().perform_create(serializer)
        invalidate_public_api_cache('conf_list')

    def perform_update(self, serializer):
        super().perform_update(serializer)
        invalidate_public_api_cache('conf_list')

    def perform_destroy(self, instance):
        super().perform_destroy(instance)
        invalidate_public_api_cache('conf_list')

    def get_queryset(self):
        from .serializers import PAID_STATUSES
        qs = Conference.objects.annotate(
            annotated_submissions_count=Count('submissions', filter=Q(submissions__status__in=PAID_STATUSES), distinct=True),
            annotated_total_collected=Coalesce(
                Sum('submissions__submission_fee', filter=Q(submissions__status__in=PAID_STATUSES)),
                Decimal('0.00'),
                output_field=DecimalField()
            )
        )
        accepting = (self.request.query_params.get('accepting') or '').lower()
        if accepting in ('1', 'true', 'yes'):
            qs = qs.filter(is_accepting_submissions=True).exclude(status='Cancelled')
        return qs.order_by('-start_date', '-id')

    def get_object(self):
        """Resolve a conference by MMSR public ID, numeric pk, or slug.

        The public ID branch is checked first and 404s when unknown, because a
        public ID can never be a pk or a slug (spec §7). Everything else keeps
        the previous pk-or-slug behaviour untouched.
        """
        from django.shortcuts import get_object_or_404
        lookup = self.kwargs.get('pk') or self.kwargs.get('slug')
        if is_valid_public_id(lookup):
            obj = find_by_public_id(self.get_queryset(), lookup)
            if obj is None:
                from django.http import Http404
                raise Http404
            self.check_object_permissions(self.request, obj)
            return obj
        obj = get_object_or_404(
            self.get_queryset(),
            pk=lookup,
        ) if str(lookup).isdigit() else get_object_or_404(
            self.get_queryset(), slug=lookup
        )
        self.check_object_permissions(self.request, obj)
        return obj


class ConferenceSubmissionViewSet(AlwaysPrivateResponseHeadersMixin, PublicIDLookupMixin, viewsets.ModelViewSet):
    """Authenticated: create + list own + retrieve own (or staff) conference
    submissions. Manuscript is only served through an authorized download.
    Responses carry per-author PII and the Razorpay payment trail, so every
    response is marked private (no-store) — never shared-cacheable."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ConferenceSubmissionSerializer

    def get_queryset(self):
        user = self.request.user
        qs = ConferenceSubmission.objects.select_related('conference', 'submitted_by').prefetch_related('authors')
        if user.is_staff:
            return qs
        return qs.filter(submitted_by=user)

    def get_serializer_class(self):
        if self.action == 'create':
            return ConferenceSubmissionCreateSerializer
        return ConferenceSubmissionSerializer

    def create(self, request, *args, **kwargs):
        # Idempotency: reuse the existing record if the client_reference was seen before
        client_reference = (request.data.get('client_reference') or '').strip()
        # SECURITY-QA-REPORT M-1: this lookup used to be GLOBAL, so any
        # authenticated account that posted another author's reference was
        # handed back that author's record (title, author email, internal id) —
        # an IDOR on unpublished work — and could occupy the reference to block
        # the real submission. The key is now scoped to the submitting account,
        # matching the model's unique_client_reference_per_submitter constraint;
        # a reference belonging to somebody else is simply not matched, and this
        # request creates its own record.
        if client_reference:
            existing = ConferenceSubmission.objects.filter(
                submitted_by=request.user, client_reference=client_reference,
            ).first()
            if existing:
                out = ConferenceSubmissionSerializer(existing, context={'request': request})
                return Response(out.data, status=status.HTTP_200_OK)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            # atomic(): save() writes the submission plus its author rows, so a
            # lost race on client_reference used to be able to leave the extras
            # behind while the parent insert failed.
            with transaction.atomic():
                submission = serializer.save()
        except IntegrityError:
            existing = ConferenceSubmission.objects.filter(
                submitted_by=request.user, client_reference=client_reference,
            ).first()
            if existing:
                out = ConferenceSubmissionSerializer(existing, context={'request': request})
                return Response(out.data, status=status.HTTP_200_OK)
            raise

        out = ConferenceSubmissionSerializer(submission, context={'request': request})
        return Response(out.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='manuscript')
    def download_manuscript(self, request, pk=None):
        submission = self.get_object()  # queryset already scopes to owner or staff
        file_field = submission.manuscript_file
        if not file_field:
            return Response({'detail': 'Manuscript is not available.'}, status=status.HTTP_404_NOT_FOUND)

        ext = os.path.splitext(file_field.name)[1] or '.pdf'
        filename = f"submission_{submission.public_id or 'manuscript'}{ext}"
        try:
            return protected_file_response(
                file_field,
                download_name=filename,
                disposition='attachment',
            )
        except Exception as e:
            logger.error('Error serving manuscript file for ConferenceSubmission #%s: %s', submission.id, e)
            return Response({'detail': 'Manuscript file could not be found.'}, status=status.HTTP_404_NOT_FOUND)

    # ── Payment actions ──
    @staticmethod
    def _razorpay_configured():
        return bool(
            settings.RAZORPAY_KEY_ID
            and settings.RAZORPAY_KEY_SECRET
            and not settings.RAZORPAY_KEY_ID.startswith('rzp_XXXXXXXXXX')
        )

    def _finalize_paid(self, submission):
        """Shared success path: confirm the submission and generate its invoice."""
        from .invoice_utils import generate_conference_invoice
        flipped = False
        with transaction.atomic():
            locked = ConferenceSubmission.objects.select_for_update().filter(pk=submission.pk).first()
            if locked and locked.status == 'pending_payment':
                flipped = bool(ConferenceSubmission.objects.filter(pk=locked.pk, status='pending_payment').update(status='submitted'))
                locked.refresh_from_db()
                submission.status = locked.status
        if (flipped or submission.status == 'submitted') and not submission.invoice_pdf:
            try:
                generate_conference_invoice(submission)
            except Exception as inv_err:
                logger.error(f"Conference invoice generation failed for Submission #{submission.id}: {str(inv_err)}")

    @action(detail=True, methods=['post'], url_path='initiate-payment')
    def initiate_payment(self, request, pk=None):
        submission = self.get_object()
        if submission.status != 'pending_payment':
            return Response({"error": "This submission does not require payment."}, status=status.HTTP_400_BAD_REQUEST)
        if not self._razorpay_configured():
            return Response({"error": "Razorpay credentials are not configured in the backend environment. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the .env file."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
            amount_in_paise = int(round(submission.submission_fee * 100))
            razorpay_order = client.order.create(data={
                "amount": amount_in_paise,
                "currency": "INR",
                "receipt": f"receipt_conf_submission_{submission.id}",
                "payment_capture": 1,
            })
            submission.razorpay_order_id = razorpay_order['id']
            submission.save()
            return Response({
                "razorpay_order_id": razorpay_order['id'],
                "amount": razorpay_order['amount'],
                "currency": razorpay_order['currency'],
                "key_id": settings.RAZORPAY_KEY_ID,
            })
        except Exception as e:
            logger.error(f"Error creating Razorpay Order for conference submission #{submission.id}: {str(e)}")
            err_str = str(e)
            if 'Authentication' in err_str or 'authentication' in err_str:
                return Response({"error": "Razorpay authentication failed. Please verify RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the .env file."}, status=status.HTTP_400_BAD_REQUEST)
            # Raw gateway text stays in the log only (audit §4): Razorpay's
            # exception payload can echo payment-entity internals, and this
            # route is reachable by any authenticated caller.
            return Response({"error": "Failed to initiate Razorpay order"}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='verify-payment')
    def verify_payment(self, request, pk=None):
        submission = self.get_object()
        razorpay_payment_id = request.data.get('razorpay_payment_id')
        razorpay_order_id = request.data.get('razorpay_order_id')
        razorpay_signature = request.data.get('razorpay_signature')

        if not razorpay_payment_id or not razorpay_order_id or not razorpay_signature:
            return Response({"error": "Missing verification parameters"}, status=status.HTTP_400_BAD_REQUEST)

        # Already paid: idempotent success (never regenerate the invoice twice)
        if submission.status != 'pending_payment':
            return Response({"status": "success", "message": "Payment already verified"})

        # Prevent the same Razorpay payment being reused on another submission
        if ConferenceSubmission.objects.filter(razorpay_payment_id=razorpay_payment_id).exclude(pk=submission.pk).exists():
            return Response({"status": "failed", "error": "This payment ID has already been used for another submission."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
            client.utility.verify_payment_signature({
                'razorpay_order_id': razorpay_order_id,
                'razorpay_payment_id': razorpay_payment_id,
                'razorpay_signature': razorpay_signature,
            })

            # Cross-check amount and currency against the gateway record
            payment = client.payment.fetch(razorpay_payment_id)
            expected_amount_paise = int(round(submission.submission_fee * 100))
            paid_amount = payment.get('amount')
            if paid_amount is not None and int(paid_amount) != expected_amount_paise:
                logger.error(f"Conference payment verification failed for #{submission.id}: amount mismatch (expected {expected_amount_paise}, got {paid_amount})")
                return Response({"status": "failed", "error": "Payment amount mismatch"}, status=status.HTTP_400_BAD_REQUEST)
            currency = payment.get('currency', 'INR')
            if currency and str(currency).upper() != 'INR':
                return Response({"status": "failed", "error": "Payment currency mismatch"}, status=status.HTTP_400_BAD_REQUEST)

            if razorpay_order_id and submission.razorpay_order_id and razorpay_order_id != submission.razorpay_order_id:
                return Response({"status": "failed", "error": "Razorpay order ID does not match this submission."}, status=status.HTTP_400_BAD_REQUEST)

            submission.razorpay_payment_id = razorpay_payment_id
            submission.razorpay_signature = razorpay_signature
            self._finalize_paid(submission)
            return Response({"status": "success", "message": "Payment verified successfully"})
        except Exception as e:
            # Log the full provider error server-side only (audit §4): the raw
            # Razorpay/SDK exception text can echo payment-entity internals, and
            # a deliberate caller could use it to probe this verification path.
            logger.error(f"Conference payment verification failed for #{submission.id}: {str(e)}")
            return Response({"status": "failed", "error": "Payment verification failed."}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='simulate-payment')
    def simulate_payment(self, request, pk=None):
        """DEV/TEST ONLY: complete a conference submission payment without charging
        a card. Hard-gated to Django DEBUG plus a Razorpay TEST key, mirroring
        orders.views.OrderViewSet.simulate_payment."""
        if not getattr(settings, 'DEBUG', False):
            return Response({"error": "simulate_payment is only available in a DEBUG environment."}, status=status.HTTP_403_FORBIDDEN)
        key_id = settings.RAZORPAY_KEY_ID or ''
        if not key_id.startswith('rzp_test_'):
            return Response({"error": "simulate_payment requires Razorpay test keys."}, status=status.HTTP_403_FORBIDDEN)

        submission = self.get_object()
        if submission.status != 'pending_payment':
            return Response({"status": "success", "message": "Submission already paid"})

        submission.razorpay_payment_id = f"pay_sim_{uuid.uuid4().hex[:14]}"
        submission.razorpay_signature = f"sim_{uuid.uuid4().hex}"
        self._finalize_paid(submission)
        logger.info(f"[simulate] Conference submission #{submission.id} marked paid via dev simulate_payment.")
        return Response({"status": "success", "message": "Test payment simulated successfully", "payment_id": submission.razorpay_payment_id})

    @action(detail=True, methods=['get'], url_path='invoice')
    def download_invoice(self, request, pk=None):
        submission = self.get_object()  # queryset already scopes to owner or staff
        file_field = submission.invoice_pdf
        if not file_field and submission.status != 'pending_payment':
            # Concurrency-safe on-demand recovery: lock the submission row
            # so concurrent GET requests do not generate duplicate invoice files.
            # Explicitly pass send_email=False so downloading never sends an email.
            with transaction.atomic():
                locked = ConferenceSubmission.objects.select_for_update().filter(pk=submission.pk).first()
                if locked and not locked.invoice_pdf and locked.status != 'pending_payment':
                    try:
                        from .invoice_utils import generate_conference_invoice
                        generate_conference_invoice(locked, send_email=False)
                        locked.refresh_from_db()
                    except Exception as e:
                        logger.error('On-demand conference invoice generation failed for #%s: %s', submission.id, e)
                if locked:
                    file_field = locked.invoice_pdf
        if not file_field:
            return Response({'detail': 'Invoice is not available.'}, status=status.HTTP_404_NOT_FOUND)

        filename = f"invoice_{submission.public_id or submission.reference_number or 'conference'}.pdf"
        try:
            return protected_file_response(
                file_field,
                download_name=filename,
                disposition='attachment',
                content_type='application/pdf',
            )
        except Exception as e:
            logger.error('Error serving invoice file for ConferenceSubmission #%s: %s', submission.id, e)
            return Response({'detail': 'Invoice file could not be found.'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['patch'], url_path='admin-update', permission_classes=[permissions.IsAdminUser])
    def admin_update(self, request, pk=None):
        submission = self.get_object()
        allowed = {'status', 'admin_notes', 'decision_notes'}
        valid_statuses = {c[0] for c in ConferenceSubmission.STATUS_CHOICES} - {'pending_payment'}

        regenerate = bool(request.data.get('regenerate_invoice'))
        updates = {k: v for k, v in request.data.items() if k in allowed}

        if 'status' in updates:
            if updates['status'] not in valid_statuses:
                return Response({'status': 'Invalid workflow status.'}, status=status.HTTP_400_BAD_REQUEST)
            if submission.status == 'pending_payment':
                return Response({'detail': 'Cannot edit a submission that is awaiting payment.'}, status=status.HTTP_400_BAD_REQUEST)

        for key, value in updates.items():
            setattr(submission, key, value)
        if updates:
            submission.save()

        if regenerate:
            if submission.status == 'pending_payment':
                return Response({'detail': 'Invoice can only be generated for paid submissions.'}, status=status.HTTP_400_BAD_REQUEST)
            from .invoice_utils import generate_conference_invoice
            try:
                generate_conference_invoice(submission)
            except Exception as e:
                logger.error(f"Invoice regeneration failed for #{submission.id}: {str(e)}")
                return Response({'detail': 'Invoice regeneration failed.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        out = ConferenceSubmissionSerializer(submission, context={'request': request})
        return Response(out.data)

    def destroy(self, request, *args, **kwargs):
        submission = self.get_object()
        # Owners may only discard their own unpaid (pending payment) submissions;
        # staff can remove any record.
        if not request.user.is_staff and submission.status != 'pending_payment':
            return Response(
                {'detail': 'Only submissions awaiting payment can be deleted. Contact support for anything else.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().destroy(request, *args, **kwargs)
