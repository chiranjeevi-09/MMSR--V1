from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from django.db import transaction
from django.conf import settings
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters

from .models import Submission, PublishedVolume
from .serializers import (
    SubmissionSerializer,
    SubmissionCreateSerializer,
    PublishedVolumeSerializer,
    PROTECTED_DOCUMENTS,
    DOCUMENT_KIND_TO_FIELD,
)
from policies.models import Policy, PolicyAcceptance
from config.security_mixins import AlwaysPrivateResponseHeadersMixin
from core.api import PublicIDLookupMixin
from core.downloads import protected_file_response
from core.mail import send_mail_logged


AGREEMENT_TEXT = (
    "I confirm that I have read and agree to the applicable Terms and Conditions and "
    "Publication Policies and Ethics. I confirm that the information and declarations "
    "supplied with this submission are accurate to the best of my knowledge."
)


class PublishedVolumeViewSet(PublicIDLookupMixin, viewsets.ReadOnlyModelViewSet):
    """Public API to list volumes that are open for chapter submissions."""
    queryset = PublishedVolume.objects.all()
    serializer_class = PublishedVolumeSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['is_accepting_chapters', 'year']
    search_fields = ['title', 'subject_area']


class SubmissionViewSet(AlwaysPrivateResponseHeadersMixin, PublicIDLookupMixin, viewsets.ModelViewSet):
    # Every response is the authenticated author's own manuscript record (or,
    # for staff, the full submission queue) — never cacheable by a shared store.
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['status', 'category', 'submission_type']
    ordering = ['-submitted_at']

    def get_queryset(self):
        user = self.request.user
        # admin_profile is select_related so the nested author payload can show
        # an admin's ADM identity without one query per row (spec §7 no-N+1).
        if user.is_staff:
            return Submission.objects.select_related('author', 'author__admin_profile', 'volume').all()
        return Submission.objects.select_related('author', 'author__admin_profile', 'volume').filter(author=user)

    def get_serializer_class(self):
        if self.action == 'create':
            return SubmissionCreateSerializer
        return SubmissionSerializer

    @action(detail=True, methods=['get'], url_path=r'documents/(?P<kind>[a-z\-]+)')
    def download_document(self, request, pk=None, kind=None):
        """Stream one of the author's own protected documents.

        SECURITY-QA-REPORT C-1 / H-2: these files used to be readable straight
        off ``/media/…`` with no authentication whatsoever. They now live in
        PROTECTED_MEDIA_ROOT, which has no URL at all, so this view — running
        through ``get_queryset()``, which restricts non-staff to their own rows
        — is the only way to reach them. The storage key is never exposed: it is
        read from the DB row, and the download is named from the public ID.
        """
        field = DOCUMENT_KIND_TO_FIELD.get(kind)
        if not field:
            return Response({'detail': 'Unknown document.'}, status=status.HTTP_404_NOT_FOUND)

        submission = self.get_object()

        # Non-staff can only download the publication notice/certificate once it is formally issued
        if field == 'certificate_file' and not request.user.is_staff and not submission.certificate_issued:
            return Response({'detail': 'Publication notice has not been issued yet.'}, status=status.HTTP_404_NOT_FOUND)

        file_field = getattr(submission, field, None)
        if not file_field:
            return Response({'detail': 'Document is not available.'}, status=status.HTTP_404_NOT_FOUND)

        label = submission.public_id or f'submission-{submission.pk}'
        doc_label = 'publication_notice' if field == 'certificate_file' else field
        # Raises Http404 (rendered by DRF's exception handler) when nothing is
        # attached or the key is missing from disk; the storage key itself is
        # never part of the response.
        return protected_file_response(
            file_field,
            download_name=f'{label}_{doc_label}',
        )

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAdminUser])
    def generate_notice(self, request, *args, **kwargs):
        """Render the admin's Publication Notice draft as a PDF and attach it
        to certificate_file so the author can download it once issued.
        Staff-only; the visible editor values are sent from the review drawer.
        Author name and title fall back to the record if blanked, since the
        letter is structured around them."""
        instance = self.get_object()
        from .notice_pdf_utils import generate_notice_pdf

        data = request.data or {}
        values = dict(data)
        if not str(values.get('author', '')).strip():
            a = instance.author
            values['author'] = (f'{a.first_name} {a.last_name}').strip() or a.email
        if not str(values.get('title', '')).strip():
            values['title'] = instance.title
        if not str(values.get('ref_no', '')).strip():
            values['ref_no'] = instance.public_id or f'MMSR-SUB-{instance.id:05d}'

        generate_notice_pdf(instance, values)
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Resolve the applicable CURRENT published policy versions on the server.
        # A client-supplied policy version/timestamp is never trusted.
        terms_policy = Policy.objects.filter(policy_type='terms', is_archived=False).first()
        ethics_policy = Policy.objects.filter(policy_type='publication_policies', is_archived=False).first()
        terms_version = terms_policy.current_version if terms_policy else None
        ethics_version = ethics_policy.current_version if ethics_policy else None

        if not terms_version or not ethics_version:
            raise ValidationError({
                'detail': (
                    'The required Terms and Conditions or Publication Policies and Ethics '
                    'are not currently published. Submission cannot be accepted.'
                )
            })

        # Record the submission and its acceptance audit entries atomically so a failure
        # while writing acceptance never leaves an orphaned/inconsistent submission.
        with transaction.atomic():
            submission = serializer.save(author=request.user)
            for policy, version in ((terms_policy, terms_version), (ethics_policy, ethics_version)):
                PolicyAcceptance.objects.create(
                    user=request.user,
                    submission=submission,
                    policy=policy,
                    policy_version=version,
                    policy_type=policy.policy_type,
                    version_number=version.version,
                    content_snapshot=version.content,
                    agreement_text=AGREEMENT_TEXT,
                )

        self._notify_submission(submission, request.user)

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def _notify_submission(self, submission, author):
        admin_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'mmsrpublications@gmail.com')
        admin_notify_email = getattr(settings, 'ADMIN_NOTIFY_EMAIL', admin_email)
        # Standardized reference (spec §11): the old MMSR-{id:05d} form leaked
        # the internal PK, so the generated SUB public ID is used instead.
        ref_id = submission.public_id or f'MMSR-{submission.id:05d}'
        submission_type_display = submission.get_submission_type_display()
        volume_info = submission.volume.title if submission.volume else 'To be assigned by editorial team'

        # ── Confirm to author ──
        # SECURITY-QA-REPORT M-8: these sends used to be fail_silently=True
        # inside a bare `except Exception: pass`, so an SMTP outage (or a
        # BadHeaderError from an unsanitised subject) dropped the mail while the
        # API still told the author it had been sent. send_mail_logged runs the
        # delivery loudly and logs any failure with the reference; the
        # submission itself already committed, so a mail error must not turn a
        # 201 into a 500.
        send_mail_logged(
            subject=f'Manuscript Received — {ref_id} | MMSR Publications',
            message=(
                f"Dear {author.first_name or 'Author'},\n\n"
                f"We are pleased to confirm that your manuscript has been successfully received "
                f"by MMSR Publications.\n\n"
                f"Submission Details\n"
                f"────────────────────\n"
                f"Reference ID   : {ref_id}\n"
                f"Title          : {submission.title}\n"
                f"Type           : {submission_type_display}\n"
                f"Volume/Journal : {volume_info}\n"
                f"Category       : {submission.category}\n"
                f"Submitted On   : {submission.submitted_at.strftime('%d %b %Y, %H:%M')} IST\n\n"
                f"What Happens Next?\n"
                f"────────────────────\n"
                f"1. Initial Screening — Our editorial team will review your submission within 3–5 business days.\n"
                f"2. Peer Review — Qualifying manuscripts proceed to double-blind peer review.\n"
                f"3. Decision — You will receive an acceptance, revision request, or rejection notice.\n"
                f"4. Publication — Accepted manuscripts are typeset, assigned DOI, and published.\n\n"
                f"Please keep your reference ID ({ref_id}) for all future correspondence.\n\n"
                f"You can track your submission status in your dashboard: "
                f"{getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')}/dashboard/submissions\n\n"
                f"Warm regards,\n"
                f"Editorial Team, MMSR Publications\n"
                f"mmsrpublications@gmail.com | +91 9042436048"
            ),
            from_email=admin_email,
            recipient_list=[submission.corresponding_email or author.email],
            context=f'submission {ref_id} author acknowledgement',
        )

        # ── Notify admin ──
        send_mail_logged(
            subject=f'[MMSR Submission] {ref_id} — {submission.title[:60]}',
            message=(
                f"New manuscript submission received.\n\n"
                f"Reference ID   : {ref_id}\n"
                f"Title          : {submission.title}\n"
                f"Type           : {submission_type_display}\n"
                f"Author         : {author.get_full_name() or author.email}\n"
                f"Author Email   : {submission.corresponding_email or author.email}\n"
                f"Phone          : {submission.phone_number or 'Not provided'}\n"
                f"Affiliation    : {submission.author_affiliation or 'Not provided'}\n"
                f"Country        : {submission.country}\n"
                f"Volume/Journal : {volume_info}\n"
                f"Pricing Tier   : {submission.get_pricing_tier_display()}\n"
                f"Keywords       : {submission.keywords or 'None'}\n\n"
                f"Abstract:\n{submission.abstract[:500]}{'...' if len(submission.abstract) > 500 else ''}\n\n"
                # Internal admin deep-link is addressed by reference rather than
                # by a URL that exposes the model name and numeric PK (L-4).
                f"Open the Submission queue in Admin and search for {ref_id}.\n"
                f"Review in Admin: {getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')}/admin/submissions\n"
            ),
            from_email=admin_email,
            recipient_list=[admin_notify_email],
            context=f'submission {ref_id} admin notification',
        )
