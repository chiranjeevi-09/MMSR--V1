from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CategoryViewSet,
    BookViewSet,
    JournalViewSet,
    JournalIssueViewSet,
    TestimonialViewSet,
    AdminTestimonialViewSet,
    TestimonialSubmitView,
    ContactInquiryViewSet,
    SiteMetricsViewSet,
    UniversityPartnerViewSet,
    NewsletterSubscriberViewSet,
    NewsletterBroadcastViewSet,
    ChapterAuthorViewSet,
    BookChapterViewSet,
    AdminChapterViewSet,
    JournalArticleViewSet,
    UserJournalAccessViewSet,
)

router = DefaultRouter()
router.register(r'categories', CategoryViewSet)
router.register(r'books', BookViewSet)
router.register(r'journals', JournalViewSet)
router.register(r'issues', JournalIssueViewSet)
router.register(r'articles', JournalArticleViewSet, basename='journalarticle')
router.register(r'user-access', UserJournalAccessViewSet, basename='userjournalaccess')
router.register(r'testimonials', TestimonialViewSet, basename='testimonial')
router.register(r'contact-inquiries', ContactInquiryViewSet, basename='contactinquiry')
router.register(r'site-metrics', SiteMetricsViewSet, basename='sitemetrics')
router.register(r'university-partners', UniversityPartnerViewSet, basename='universitypartner')
router.register(r'newsletter-subscribers', NewsletterSubscriberViewSet, basename='newslettersubscriber')
router.register(r'newsletter-broadcasts', NewsletterBroadcastViewSet, basename='newsletterbroadcast')
router.register(r'chapter-authors', ChapterAuthorViewSet, basename='chapterauthor')
router.register(r'chapters', BookChapterViewSet, basename='bookchapter')
router.register(r'admin/chapters', AdminChapterViewSet, basename='adminchapter')
router.register(r'admin/testimonials', AdminTestimonialViewSet, basename='admintestimonial')

urlpatterns = [
    # Must precede the router include so /testimonials/submit/ isn't captured by /testimonials/<pk>/
    path('testimonials/submit/', TestimonialSubmitView.as_view(), name='testimonial-submit'),
    path('', include(router.urls)),
    path('books/<slug:book_slug>/chapters/', BookChapterViewSet.as_view({'get': 'list'}), name='book-chapters-list'),
    path('books/<slug:book_slug>/chapters/<slug:slug>/', BookChapterViewSet.as_view({'get': 'retrieve'}), name='book-chapter-detail'),
    path('books/<slug:book_slug>/chapters/<slug:slug>/sections/<str:section_id>/content/', BookChapterViewSet.as_view({'get': 'section_content'}), name='book-chapter-section-content'),
]

