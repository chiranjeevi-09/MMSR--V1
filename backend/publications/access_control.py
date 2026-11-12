from django.utils import timezone
from django.db import models
from .models import UserJournalAccess


def get_authenticated_user_from_request(request):
    """
    Resolves authenticated user from a DRF request.
    Supports SessionAuth (request.user) or an ``Authorization: Bearer`` header.

    JWTs are deliberately NOT accepted via a ``?token=`` query parameter
    (audit M-6): URLs leak into access logs, browser history, referrer
    headers and analytics, so a bearer credential in a URL is a real token
    disclosure. Every caller already sends the header; there is no
    supported flow that needs the query form.
    """
    user = getattr(request, 'user', None)
    if user and user.is_authenticated:
        return user

    # Authorization header (Bearer token)
    auth_header = request.META.get('HTTP_AUTHORIZATION', '')
    if auth_header.startswith('Bearer '):
        raw_token = auth_header.split(' ')[1]
        try:
            from rest_framework_simplejwt.tokens import AccessToken
            from users.models import User
            validated_token = AccessToken(raw_token)
            user_id = validated_token.get('user_id')
            return User.objects.get(id=user_id)
        except Exception:
            pass

    return None


def check_journal_issue_access(user, issue):
    """
    Checks if a user has access to a JournalIssue.
    Returns (is_authorized: bool, reason: str)
    """
    # 1. The complete-issue PDF is a subscription benefit. A journal-level
    #    "Open Access" designation does NOT release the full-issue document for
    #    free -- it only describes the journal's editorial policy, and each
    #    article's own access_mode remains authoritative for that article.
    #    (Same precedent as check_journal_article_access step 2.)

    # 2. Staff / Superuser check
    if user and user.is_authenticated and user.is_staff:
        return True, "Staff access"

    # 3. Unauthenticated user check
    if not user or not user.is_authenticated:
        return False, "Authentication required"

    now = timezone.now()

    # 4. Check active journal-wide entitlement (subscription or manual grant) for the journal
    has_sub = UserJournalAccess.objects.filter(
        user=user,
        journal=issue.journal,
        is_active=True,
        start_date__lte=now
    ).filter(
        models.Q(end_date__isnull=True) | models.Q(end_date__gte=now)
    ).filter(
        models.Q(access_type='subscription') | models.Q(issue__isnull=True, article__isnull=True)
    ).exists()

    if has_sub:
        return True, "Active journal subscription"

    # Issue-level purchasing has been removed. Access to a complete-issue PDF
    # is granted ONLY by an active journal subscription (or staff access).
    # Individual article purchases do NOT unlock the full issue.
    return False, "No active journal subscription"


def check_journal_article_access(user, article):
    """
    Checks if a user has access to a JournalArticle.
    Returns (is_authorized: bool, reason: str)
    """
    # 1. Unpublished / Withdrawn check
    if article.status != 'published':
        if user and user.is_authenticated and user.is_staff:
            return True, "Staff access to unpublished article"
        return False, "Article is not published"

    # 2. Open Access check on article level (authoritative per-article setting).
    #    NOTE: a journal-level "Open Access" designation does NOT override an
    #    article the editor explicitly marked as Paid — the article's own
    #    access_mode is the single source of truth for whether it is free.
    if article.access_mode == 'open_access':
        return True, "Open Access Article"

    # 3. Staff / Superuser check
    if user and user.is_authenticated and user.is_staff:
        return True, "Staff access"

    # 5. Unauthenticated user check
    if not user or not user.is_authenticated:
        return False, "Authentication required"

    now = timezone.now()

    # 6. Check active journal-wide entitlement (subscription or manual grant) for the journal
    has_sub = UserJournalAccess.objects.filter(
        user=user,
        journal=article.journal,
        is_active=True,
        start_date__lte=now
    ).filter(
        models.Q(end_date__isnull=True) | models.Q(end_date__gte=now)
    ).filter(
        models.Q(access_type='subscription') | models.Q(issue__isnull=True, article__isnull=True)
    ).exists()

    if has_sub:
        return True, "Active journal subscription"

    # 7. Check individual article purchase entitlement
    has_article_purchase = UserJournalAccess.objects.filter(
        user=user,
        article=article,
        is_active=True,
        start_date__lte=now
    ).filter(
        models.Q(end_date__isnull=True) | models.Q(end_date__gte=now)
    ).exists()

    if has_article_purchase:
        return True, "Individual article purchase"

    # 8. Check active issue entitlement if article belongs to an issue
    if article.issue:
        has_issue_access = UserJournalAccess.objects.filter(
            user=user,
            issue=article.issue,
            is_active=True,
            start_date__lte=now
        ).filter(
            models.Q(end_date__isnull=True) | models.Q(end_date__gte=now)
        ).exists()

        if has_issue_access:
            return True, "Purchased issue entitlement"

    return False, "No active entitlement found"


def can_user_access_article(user, article):
    """
    Canonical centralized decision: may this user view the protected
    content (full text / PDF) of this article?
    Returns (is_authorized: bool, reason: str).
    """
    return check_journal_article_access(user, article)


def get_article_access_state(user, article):
    """
    Full access-state dictionary for an article, computed server-side.
    Metadata/abstract visibility is never governed by this function —
    it only governs protected content (full text + PDF).
    """
    is_authenticated = bool(user and user.is_authenticated)
    is_open_access = article.access_mode == 'open_access'

    has_active_subscription = False
    has_article_purchase = False
    has_pdf = bool(article.file_pdf)

    if article.status == 'published' and is_authenticated and not is_open_access:
        now = timezone.now()
        valid_window = models.Q(end_date__isnull=True) | models.Q(end_date__gte=now)

        has_active_subscription = UserJournalAccess.objects.filter(
            user=user,
            journal=article.journal,
            is_active=True,
            start_date__lte=now
        ).filter(valid_window).filter(
            models.Q(access_type='subscription') | models.Q(issue__isnull=True, article__isnull=True)
        ).exists()

        has_article_purchase = UserJournalAccess.objects.filter(
            user=user,
            article=article,
            is_active=True,
            start_date__lte=now
        ).filter(valid_window).exists()

    is_authorized, reason = check_journal_article_access(user, article)

    return {
        'article_id': article.id,
        'article_slug': article.slug,
        'is_open_access': is_open_access,
        'has_active_subscription': has_active_subscription,
        'has_article_purchase': has_article_purchase,
        'can_access_full_text': is_authorized,
        'can_access_pdf': is_authorized and has_pdf,
        'access_reason': reason,
        'requires_login': not is_authenticated and not is_open_access,
        'article_pdf_available': has_pdf,
        'article_price': float(article.price) if article.price is not None else None,
        'has_full_text': bool(article.full_text),
    }
