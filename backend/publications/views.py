from rest_framework import viewsets, permissions, filters, status, exceptions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from django.http import FileResponse
from form_validation import EMAIL_RE
from .models import (
    Category, Book, Journal, JournalIssue, Testimonial, ContactInquiry,
    SiteMetrics, UniversityPartner, NewsletterSubscriber, NewsletterBroadcast,
    ChapterAuthor, BookChapter, ChapterSection, JournalArticle, UserJournalAccess
)
from .serializers import (
    CategorySerializer, BookSerializer, JournalSerializer, JournalIssueSerializer,
    TestimonialPublicSerializer, TestimonialAdminSerializer, TestimonialSubmitSerializer,
    ContactInquirySerializer,
    SiteMetricsSerializer, UniversityPartnerSerializer,
    NewsletterSubscriberSerializer, NewsletterBroadcastSerializer,
    ChapterAuthorSerializer, ChapterSectionPublicSerializer, ChapterSectionFullSerializer,
    BookChapterPublicSerializer, BookChapterAdminSerializer, JournalArticleSerializer,
    UserJournalAccessSerializer
)
from .filters import BookFilter
from .access_control import (
    get_authenticated_user_from_request,
    check_journal_issue_access,
    check_journal_article_access,
    get_article_access_state,
)
from config.security_mixins import AlwaysPrivateResponseHeadersMixin
from core.api import PublicIDLookupMixin, find_by_public_id, is_valid_public_id
from core.caching import cache_public_api, invalidate_public_api_cache
from core.downloads import protected_file_response
from core.mail import send_mail_logged
from core.spam_guard import (
    ContactFormThrottle, TestimonialFormThrottle, NewsletterFormThrottle,
    ThrottleWritesOnlyMixin, is_automated,
)


class PrivateResponseHeadersMixin:
    """Force ``Cache-Control: no-store`` on per-user entitlement responses.

    A misconfigured shared cache / CDN in front of the API must never be able
    to reuse one customer's authorized PDF, full-text or access-state for
    another request. Only the actions listed in ``private_actions`` are
    marked — public catalog responses keep their normal cacheability.
    """
    private_actions = set()

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        if self.action in self.private_actions:
            response['Cache-Control'] = 'no-store'
            response['Vary'] = 'Authorization, Cookie'
        return response


class CategoryViewSet(PublicIDLookupMixin, viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['category_type']
    search_fields = ['name', 'description']
    pagination_class = None

    @cache_public_api(timeout=60, prefix="cat_list")
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    def perform_create(self, serializer):
        super().perform_create(serializer)
        invalidate_public_api_cache('cat_list')

    def perform_update(self, serializer):
        super().perform_update(serializer)
        invalidate_public_api_cache('cat_list')

    def perform_destroy(self, instance):
        super().perform_destroy(instance)
        invalidate_public_api_cache('cat_list')

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [permissions.IsAdminUser()]

class BookViewSet(viewsets.ModelViewSet):
    queryset = Book.objects.select_related('category').prefetch_related(
        'chapters__authors', 'chapters__sections')
    serializer_class = BookSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = BookFilter
    search_fields = ['title', 'author', 'isbn']
    ordering_fields = ['price', 'created_at']
    ordering = ['-created_at']
    lookup_field = 'slug'

    @cache_public_api(timeout=60, prefix="book_list")
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    def perform_create(self, serializer):
        super().perform_create(serializer)
        invalidate_public_api_cache('book_list')

    def perform_update(self, serializer):
        super().perform_update(serializer)
        invalidate_public_api_cache('book_list')

    def perform_destroy(self, instance):
        super().perform_destroy(instance)
        invalidate_public_api_cache('book_list')

    def get_object(self):
        """Resolve a book by MMSR public ID, slug, or numeric primary key.

        The browse/list UI links by /books/<slug>/, while historic surfaces
        (sitemap, cart line items, global search, order rows) link by
        /books/<id>/. Both are legitimate identifiers, so accept each and raise
        404 only when neither matches. Without this, the frontend soft-404 fix
        would turn every numeric-id book link into a real 404.

        A well-formed public ID (spec §7) is resolved against ``public_id`` and
        404s when unknown — it can never be a pk or a slug, so it must not fall
        through to the other branches.
        """
        from django.http import Http404
        queryset = self.filter_queryset(self.get_queryset())
        value = str(self.kwargs['slug'])
        obj = None
        if is_valid_public_id(value):
            obj = find_by_public_id(queryset, value)
            if obj is None:
                raise Http404
        elif value.isdigit():
            obj = queryset.filter(pk=int(value)).first()
            if obj is None:
                obj = queryset.filter(slug=value).first()
        else:
            obj = queryset.filter(slug=value).first()
        if obj is None:
            raise Http404
        self.check_object_permissions(self.request, obj)
        return obj

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [permissions.IsAdminUser()]

    @action(detail=True, methods=['get'], url_path='pdf',
            permission_classes=[permissions.IsAdminUser])
    def download_pdf(self, request, slug=None):
        """Staff-only stream of the complete book PDF.

        SECURITY-QA-REPORT C-1: ``books/full/`` used to sit in the publicly
        served media tree, so the whole product was downloadable by URL alone.
        It is protected storage now, and this view is the only way to read it —
        the desk UI fetches it with the admin token (see lib/services/protectedFiles).
        Customer-facing distribution stays on the physical/digital purchase flow.
        """
        book = self.get_object()
        ref = book.public_id or book.slug or book.pk
        return protected_file_response(book.file_pdf, download_name=f'book_{ref}_full')


class JournalViewSet(PublicIDLookupMixin, viewsets.ModelViewSet):
    # Journal payload nests issues and their articles (each with authors);
    # prefetch so list/detail stay at a constant handful of queries instead
    # of one per row (N+1 was the main backend latency source).
    queryset = Journal.objects.select_related('category').prefetch_related(
        'issues__articles__authors', 'articles__authors')
    serializer_class = JournalSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['category', 'is_featured']
    search_fields = ['title', 'issn']
    lookup_field = 'slug'

    @cache_public_api(timeout=60, prefix="journal_list")
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    def perform_create(self, serializer):
        super().perform_create(serializer)
        invalidate_public_api_cache('journal_list')

    def perform_update(self, serializer):
        super().perform_update(serializer)
        invalidate_public_api_cache('journal_list')

    def perform_destroy(self, instance):
        super().perform_destroy(instance)
        invalidate_public_api_cache('journal_list')

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [permissions.IsAdminUser()]

class JournalIssueViewSet(PrivateResponseHeadersMixin, PublicIDLookupMixin, viewsets.ModelViewSet):
    private_actions = {'download_pdf'}
    queryset = JournalIssue.objects.select_related('journal').prefetch_related(
        'articles__authors')
    serializer_class = JournalIssueSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['journal']
    ordering = ['-publication_date']

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'download_pdf']:
            return [permissions.AllowAny()]
        return [permissions.IsAdminUser()]

    @action(detail=True, methods=['get'], url_path='pdf', permission_classes=[permissions.AllowAny])
    def download_pdf(self, request, pk=None):
        """Protected endpoint delivering digital issue PDF only if authorized."""
        issue = self.get_object()
        user = get_authenticated_user_from_request(request)
        is_authorized, reason = check_journal_issue_access(user, issue)

        if not is_authorized:
            if not user or not user.is_authenticated:
                return Response({'detail': f'Authentication required. {reason}'}, status=status.HTTP_401_UNAUTHORIZED)
            return Response({'detail': f'Access denied. {reason}'}, status=status.HTTP_403_FORBIDDEN)

        if not issue.file_digital:
            return Response({'detail': 'No digital PDF file available for this issue.'}, status=status.HTTP_404_NOT_FOUND)

        filename = f"issue_{issue.public_id or 'download'}_vol{issue.volume_number or 0}_no{issue.issue_number or 0}"
        return protected_file_response(
            issue.file_digital,
            download_name=filename,
            disposition='inline',
            content_type='application/pdf',
        )


class JournalArticleViewSet(PrivateResponseHeadersMixin, viewsets.ModelViewSet):
    private_actions = {'access_state', 'full_text', 'download_pdf'}
    queryset = JournalArticle.objects.select_related('journal', 'issue').prefetch_related('authors')
    serializer_class = JournalArticleSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['journal', 'issue', 'status', 'access_mode']
    search_fields = ['title', 'abstract', 'doi', 'author_names_raw']
    ordering_fields = ['display_order', 'publication_date', 'created_at']
    ordering = ['display_order', '-publication_date']

    def get_queryset(self):
        if self.request.user and self.request.user.is_authenticated and self.request.user.is_staff:
            return JournalArticle.objects.select_related('journal', 'issue').prefetch_related('authors')
        return JournalArticle.objects.filter(status='published').select_related('journal', 'issue').prefetch_related('authors')

    def get_object(self):
        """Resolve detail lookups by MMSR public ID, primary key, or article slug.

        Slugs are not unique on this model, so numeric lookups are treated as
        pk first; slug lookups prefer an exact (case-sensitive) match and only
        fall back to a case-insensitive one, deterministically ordered.
        Without this, /articles/<slug>/ hit the pk parser, failed, and the
        frontend fallback opened whichever article shared the slug first.

        A validly formatted public ID is resolved on its own column and 404s
        when unknown, so it can never be mistaken for a slug (spec §7).
        """
        from django.http import Http404
        qs = self.get_queryset()
        value = str(self.kwargs['pk'])
        if is_valid_public_id(value):
            obj = find_by_public_id(qs, value)
            if obj is None:
                raise Http404
            self.check_object_permissions(self.request, obj)
            return obj
        obj = None
        if value.isdigit():
            obj = qs.filter(pk=int(value)).first()
        if obj is None:
            obj = qs.filter(slug=value).first()
        if obj is None:
            obj = qs.filter(slug__iexact=value).order_by('display_order', 'id').first()
        if obj is None:
            raise Http404
        self.check_object_permissions(self.request, obj)
        return obj

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'download_pdf', 'access_state', 'full_text']:
            return [permissions.AllowAny()]
        return [permissions.IsAdminUser()]

    @action(detail=True, methods=['get'], url_path='access', permission_classes=[permissions.AllowAny])
    def access_state(self, request, pk=None):
        """Public access-state summary. Never returns protected content itself."""
        article = self.get_object()
        user = get_authenticated_user_from_request(request)
        return Response(get_article_access_state(user, article))

    @action(detail=True, methods=['get'], url_path='fulltext', permission_classes=[permissions.AllowAny])
    def full_text(self, request, pk=None):
        """Protected endpoint delivering the article full-text body only if authorized."""
        article = self.get_object()
        user = get_authenticated_user_from_request(request)
        is_authorized, reason = check_journal_article_access(user, article)

        if not is_authorized:
            if not user or not user.is_authenticated:
                return Response({'detail': f'Authentication required. {reason}'}, status=status.HTTP_401_UNAUTHORIZED)
            return Response({'detail': f'Access denied. {reason}'}, status=status.HTTP_403_FORBIDDEN)

        if not article.full_text:
            return Response({'detail': 'No full-text content available for this article.'}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            'article_id': article.id,
            'title': article.title,
            'full_text': article.full_text,
        })

    @action(detail=True, methods=['get'], url_path='pdf', permission_classes=[permissions.AllowAny])
    def download_pdf(self, request, pk=None):
        """Protected endpoint delivering article PDF file only if authorized."""
        article = self.get_object()
        user = get_authenticated_user_from_request(request)
        is_authorized, reason = check_journal_article_access(user, article)

        if not is_authorized:
            if not user or not user.is_authenticated:
                return Response({'detail': f'Authentication required. {reason}'}, status=status.HTTP_401_UNAUTHORIZED)
            return Response({'detail': f'Access denied. {reason}'}, status=status.HTTP_403_FORBIDDEN)

        if not article.file_pdf:
            return Response({'detail': 'No PDF file available for this article.'}, status=status.HTTP_404_NOT_FOUND)

        filename = f"article_{article.public_id or 'download'}_{article.slug[:30]}"
        return protected_file_response(
            article.file_pdf,
            download_name=filename,
            disposition='inline',
            content_type='application/pdf',
        )


class UserJournalAccessViewSet(AlwaysPrivateResponseHeadersMixin, PublicIDLookupMixin, viewsets.ModelViewSet):
    serializer_class = UserJournalAccessSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['journal', 'issue', 'access_type', 'is_active']
    ordering = ['-granted_at']

    def get_queryset(self):
        # user/journal/issue/article are joined so the serialized identity
        # fields (user_email, user_public_id, journal_title, issue_title,
        # article_title) come with the row instead of one query per entitlement.
        base = UserJournalAccess.objects.select_related('user', 'journal', 'issue', 'article')
        if self.request.user.is_staff:
            return base.all()
        return base.filter(user=self.request.user)

    def perform_create(self, serializer):
        if not self.request.user.is_staff:
            raise exceptions.PermissionDenied("Only administrators can grant access records directly.")
        serializer.save()


class TestimonialViewSet(PublicIDLookupMixin, viewsets.ReadOnlyModelViewSet):
    queryset = Testimonial.objects.filter(is_active=True).order_by('-created_at')
    serializer_class = TestimonialPublicSerializer
    permission_classes = [permissions.AllowAny]


class AdminTestimonialViewSet(AlwaysPrivateResponseHeadersMixin, PublicIDLookupMixin, viewsets.ModelViewSet):
    """Admin CRUD for all testimonials incl. pending user-submitted reviews."""
    queryset = Testimonial.objects.all().order_by('-created_at')
    serializer_class = TestimonialAdminSerializer
    permission_classes = [permissions.IsAdminUser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['source', 'is_active', 'book', 'journal']
    search_fields = ['name', 'content', 'email', 'institution']


class TestimonialSubmitView(APIView):
    """Public endpoint for user reviews from book / journal pages. Lands in admin moderation queue."""
    permission_classes = [permissions.AllowAny]
    # SECURITY-QA-REPORT M-4: this endpoint is anonymous by design, so it needs
    # a per-IP budget and a bot trap; without them one script produced dozens of
    # queue entries and one outbound email each.
    throttle_classes = [TestimonialFormThrottle]

    def post(self, request):
        if is_automated(request):
            # Answer exactly as a real submission would, and store nothing: a
            # bot that is told it failed simply retries with a tweaked payload.
            return Response(
                {'detail': 'Thank you! Your review has been submitted and will appear on the site once approved.'},
                status=status.HTTP_201_CREATED,
            )
        serializer = TestimonialSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(is_active=False)
        return Response(
            {'detail': 'Thank you! Your review has been submitted and will appear on the site once approved.'},
            status=status.HTTP_201_CREATED,
        )

class ContactInquiryViewSet(AlwaysPrivateResponseHeadersMixin, PublicIDLookupMixin, ThrottleWritesOnlyMixin, viewsets.ModelViewSet):
    queryset = ContactInquiry.objects.all().order_by('-created_at')
    serializer_class = ContactInquirySerializer
    throttle_classes = [ContactFormThrottle]

    def get_permissions(self):
        if self.action == 'create':
            return [permissions.AllowAny()]
        return [permissions.IsAdminUser()]

    def create(self, request, *args, **kwargs):
        if is_automated(request):
            return Response(
                {'detail': 'Thank you for contacting MMSR Publications. '
                           'Your enquiry has been received.'},
                status=status.HTTP_201_CREATED,
            )
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        inquiry = serializer.save()
        # The reference number used to be minted here from the primary key
        # (MMSR-ENQ-{id:05d}). ContactInquiry.save() now mirrors the
        # standardized ENQ public ID into that column during the INSERT
        # (Phase 5 ID standardization), so no post-create assignment is needed.

        admin_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'mmsrpublications@gmail.com')
        admin_notify_email = getattr(settings, 'ADMIN_NOTIFY_EMAIL', admin_email)

        # ── Notify admin ──
        # SECURITY-QA-REPORT M-8: send_mail(fail_silently=True) inside
        # `except Exception: pass` meant a dropped inquiry left no trace at all
        # — the visitor saw "thank you", the desk saw nothing.
        send_mail_logged(
            subject=f'[MMSR Contact] New Inquiry: {inquiry.subject}',
            message=(
                f"New contact inquiry received on MMSR Publications.\n\n"
                f"Name    : {inquiry.name}\n"
                f"Email   : {inquiry.email}\n"
                f"Phone   : {inquiry.phone or 'Not provided'}\n"
                f"Subject : {inquiry.subject}\n"
                f"Type    : {inquiry.get_inquiry_type_display()}\n\n"
                f"Message:\n{inquiry.message}\n\n"
                f"────────────────────────\n"
                f"Reply to: {inquiry.email}"
            ),
            from_email=admin_email,
            recipient_list=[admin_notify_email],
            context=f'contact inquiry {inquiry.public_id or inquiry.pk} admin notification',
        )

        # ── Acknowledge user ──
        send_mail_logged(
            subject='Thank you for contacting MMSR Publications',
            message=(
                f"Dear {inquiry.name},\n\n"
                f"Thank you for reaching out to MMSR Publications. "
                f"We have received your inquiry regarding \"{inquiry.subject}\" "
                f"and our team will get back to you within 24–48 business hours.\n\n"
                f"Your Inquiry Details\n"
                f"────────────────────\n"
                f"Subject  : {inquiry.subject}\n"
                f"Category : {inquiry.get_inquiry_type_display()}\n"
                f"Message  : {inquiry.message[:300]}{'...' if len(inquiry.message) > 300 else ''}\n\n"
                f"If this is urgent, please call us at +91 9042436048.\n\n"
                f"Warm regards,\n"
                f"MMSR Publications Team\n"
                f"mmsrpublications@gmail.com | +91 9042436048"
            ),
            from_email=admin_email,
            recipient_list=[inquiry.email],
            context=f'contact inquiry {inquiry.public_id or inquiry.pk} acknowledgement',
        )


# ─── New CMS ViewSets ──────────────────────────────────────────────────────────

class SiteMetricsViewSet(viewsets.ViewSet):
    """Singleton site metrics. GET returns the single row, PATCH updates it."""

    def list(self, request):
        instance = SiteMetrics.get_instance()
        serializer = SiteMetricsSerializer(instance)
        return Response(serializer.data)

    def partial_update(self, request, pk=None):
        if not request.user.is_staff:
            return Response({'detail': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)
        instance = SiteMetrics.get_instance()
        serializer = SiteMetricsSerializer(instance, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UniversityPartnerViewSet(PublicIDLookupMixin, viewsets.ModelViewSet):
    queryset = UniversityPartner.objects.filter(is_active=True)
    serializer_class = UniversityPartnerSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [permissions.IsAdminUser()]

    def get_queryset(self):
        # Admins can see all; public sees only active
        if self.request.user.is_staff:
            return UniversityPartner.objects.all()
        return UniversityPartner.objects.filter(is_active=True)


class NewsletterSubscriberViewSet(AlwaysPrivateResponseHeadersMixin, PublicIDLookupMixin, ThrottleWritesOnlyMixin, viewsets.ModelViewSet):
    queryset = NewsletterSubscriber.objects.all()
    serializer_class = NewsletterSubscriberSerializer
    throttle_classes = [NewsletterFormThrottle]

    def get_permissions(self):
        if self.action == 'create':
            return [permissions.AllowAny()]
        return [permissions.IsAdminUser()]

    def create(self, request, *args, **kwargs):
        # M-4: a bot that is added to the mailing list is the attack; the reply
        # it receives is the same one a real subscriber gets, and nothing is
        # written or mailed.
        if is_automated(request):
            return Response({'detail': 'Successfully subscribed! Thank you for joining the MMSR network.'},
                            status=status.HTTP_201_CREATED)

        email = request.data.get('email', '').strip().lower()
        if not email:
            return Response({'detail': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)
        # Model save() never validates, so the format must be checked here —
        # otherwise malformed addresses enter the broadcast list permanently.
        if not EMAIL_RE.match(email):
            return Response({'detail': 'Enter a valid email address.'}, status=status.HTTP_400_BAD_REQUEST)

        subscriber, created = NewsletterSubscriber.objects.get_or_create(email=email)
        if not created:
            if subscriber.is_active:
                return Response({'detail': 'This email is already subscribed.'}, status=status.HTTP_200_OK)
            else:
                subscriber.is_active = True
                subscriber.save()
                return Response({'detail': 'Welcome back! Re-subscribed successfully.'}, status=status.HTTP_200_OK)

        # Notify admin
        admin_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'mmsrpublications@gmail.com')
        send_mail_logged(
            subject='New Newsletter Subscriber — MMSR Publications',
            message=f"A new subscriber has joined:\n\nEmail: {email}\nTime: {subscriber.subscribed_at}",
            from_email=admin_email,
            recipient_list=[admin_email],
            context='new newsletter subscriber notification',
        )

        return Response({'detail': 'Successfully subscribed! Thank you for joining the MMSR network.'}, status=status.HTTP_201_CREATED)


class NewsletterBroadcastViewSet(AlwaysPrivateResponseHeadersMixin, PublicIDLookupMixin, viewsets.ModelViewSet):
    queryset = NewsletterBroadcast.objects.all()
    serializer_class = NewsletterBroadcastSerializer
    permission_classes = [permissions.IsAdminUser]

    @action(detail=True, methods=['post'], url_path='send')
    def send_broadcast(self, request, pk=None):
        """Admin triggers broadcast; emails sent to all active subscribers."""
        broadcast = self.get_object()
        if broadcast.is_sent:
            return Response({'detail': 'This broadcast has already been sent.'}, status=status.HTTP_400_BAD_REQUEST)

        subscribers = NewsletterSubscriber.objects.filter(is_active=True)
        if not subscribers.exists():
            return Response({'detail': 'No active subscribers to send to.'}, status=status.HTTP_400_BAD_REQUEST)

        admin_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'mmsrpublications@gmail.com')
        sent_count = 0
        failed_count = 0
        for sub in subscribers:
            try:
                # fail_silently=False (audit TASK 16): with fail_silently=True a
                # broken SMTP session returns silently and every recipient would
                # be counted as "sent". Counting only accepted sends keeps the
                # reported number honest.
                send_mail(
                    subject=broadcast.subject,
                    message=(
                        broadcast.message + "\n\n"
                        "────────────────────────\n"
                        "You are receiving this because you subscribed to MMSR Publications updates.\n"
                        "MMSR Publications | mmsrpublications@gmail.com | +91 9042436048"
                    ),
                    from_email=admin_email,
                    recipient_list=[sub.email],
                    fail_silently=False,
                )
                sent_count += 1
            except Exception:
                failed_count += 1

        broadcast.is_sent = True
        broadcast.sent_at = timezone.now()
        broadcast.recipients_count = sent_count
        broadcast.save()

        detail = f'Broadcast sent to {sent_count} subscribers.'
        if failed_count:
            detail += f' {failed_count} recipient(s) failed to send.'
        if 'console' in getattr(settings, 'EMAIL_BACKEND', '') or 'locmem' in getattr(settings, 'EMAIL_BACKEND', ''):
            detail += (' Note: a development email backend is active — messages were '
                       'written to the server log/test mailbox, not delivered to inboxes.')

        return Response({
            'detail': detail,
            'recipients_count': sent_count,
            'failed_count': failed_count,
        })


# ─── Chapter Management ViewSets ───────────────────────────────────────────────

class ChapterAuthorViewSet(PublicIDLookupMixin, viewsets.ModelViewSet):
    queryset = ChapterAuthor.objects.all()
    serializer_class = ChapterAuthorSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'affiliation', 'designation']

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [permissions.IsAdminUser()]


class BookChapterViewSet(PrivateResponseHeadersMixin, PublicIDLookupMixin, viewsets.ReadOnlyModelViewSet):
    """Public ViewSet for published chapters and section content."""
    private_actions = {'section_content'}
    queryset = BookChapter.objects.filter(status='published').prefetch_related('authors', 'sections')
    serializer_class = BookChapterPublicSerializer
    lookup_field = 'slug'

    def get_queryset(self):
        qs = BookChapter.objects.filter(status='published').prefetch_related('authors', 'sections')
        book_id_or_slug = self.kwargs.get('book_slug') or self.request.query_params.get('book')
        if book_id_or_slug:
            if str(book_id_or_slug).isdigit():
                qs = qs.filter(book_id=book_id_or_slug)
            else:
                qs = qs.filter(book__slug=book_id_or_slug)
        return qs

    @action(detail=True, methods=['get'], url_path=r'sections/(?P<section_id>[^/.]+)/content')
    def section_content(self, request, book_slug=None, slug=None, section_id=None):
        """Protected endpoint returning full section content only if authorized."""
        chapter = self.get_object()
        try:
            section = chapter.sections.get(pk=section_id, status='published')
        except ChapterSection.DoesNotExist:
            return Response({'detail': 'Section not found or unpublished.'}, status=status.HTTP_404_NOT_FOUND)

        is_authorized = False
        if chapter.access_mode == 'open_access':
            is_authorized = True
        elif request.user and request.user.is_authenticated and request.user.is_staff:
            is_authorized = True
        elif request.user and request.user.is_authenticated:
            # SECURITY-QA-REPORT H-3: this block used to read
            # ``Order.objects.filter(user=..., payment_status='paid')`` wrapped in
            # ``except Exception: pass``. Order has no payment_status field (the
            # column is ``status``), so the query raised FieldError on EVERY
            # request, the bare except discarded it, and no paying customer could
            # ever open chapter content they had bought — a paid feature silently
            # dead, with nothing logged.
            #
            # Two things are corrected together, because fixing only the field
            # name would have turned this into a site-wide entitlement leak: the
            # old rule authorised on *any* paid order, not on a paid order for
            # *the book being read*. Mirrors check_journal_article_access().
            from orders.models import Order
            has_paid_this_book = Order.objects.filter(
                user=request.user,
                status__in=Order.PAID_STATUSES,
                items__book=chapter.book,
            ).exists()
            if has_paid_this_book:
                is_authorized = True

        if is_authorized:
            serializer = ChapterSectionFullSerializer(section)
            return Response(serializer.data)

        return Response({
            'detail': 'Full content access requires valid purchase or authorization.',
            'access_mode': chapter.access_mode,
            'is_authorized': False,
            'preview_content': section.preview_content,
        }, status=status.HTTP_403_FORBIDDEN)


class AdminChapterViewSet(AlwaysPrivateResponseHeadersMixin, PublicIDLookupMixin, viewsets.ModelViewSet):
    """Admin ViewSet for managing chapters, authors, and sections."""
    queryset = BookChapter.objects.all().select_related('book').prefetch_related('authors', 'sections')
    serializer_class = BookChapterAdminSerializer
    permission_classes = [permissions.IsAdminUser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['book', 'status', 'access_mode']
    search_fields = ['title', 'description', 'author_names_raw']
    ordering_fields = ['chapter_number', 'created_at']
    ordering = ['chapter_number']

    @action(detail=True, methods=['get'], url_path='pdf')
    def download_pdf(self, request, pk=None):
        """Staff-only stream of a chapter PDF (protected storage since C-1).

        Buyers never receive this URL: the public chapter serializer omits
        ``file_pdf`` entirely and their content is served section by section
        through ``BookChapterViewSet.section_content``, which enforces the
        per-book paid-order entitlement."""
        chapter = self.get_object()
        ref = chapter.public_id or chapter.pk
        return protected_file_response(chapter.file_pdf, download_name=f'chapter_{ref}')

