"""Email helpers for the notification paths that run inside a web request.

SECURITY-QA-REPORT M-8: the contact, testimonial, newsletter, submission and
password-reset flows all sent mail with ``fail_silently=True`` wrapped in
``except Exception: pass``. Both layers swallow the error, so an SMTP outage,
a rejected relay, or a ``BadHeaderError`` from a newline in user-supplied
subject text dropped the message while the API still reported success. Support
requests never reached the desk, password-reset links never arrived, and the
only evidence was a mail queue nobody watched.

``send_mail_logged`` keeps the *request* resilient — a visitor must not get a
500 because the mail server is down, and a half-delivered notification is
better than a rolled-back submission — but it makes the failure an explicit,
logged, boolean outcome instead of silence.
"""
import logging

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


def mail_subject(value, limit=120):
    """Flatten a subject line that contains user-supplied text.

    Django raises ``BadHeaderError`` for any header containing a newline, which
    used to mean "this notification silently does not happen". Collapsing the
    whitespace and capping the length keeps every such header well-formed.
    """
    return ' '.join(str(value).split())[:limit]


def send_mail_logged(*, subject, message, recipient_list, from_email=None,
                     html_message=None, context='', fail_loudly=False):
    """Send one email; return ``True`` only when it was handed to the backend.

    :param context: short description of *why* this mail is being sent, used in
        the log line so a failure is diagnosable without the message body.
    :param fail_loudly: re-raise instead of returning ``False``. Used where the
        caller is already inside a transaction that must not be committed on an
        undelivered mail.
    Never logs recipients' message bodies or tokens; a mailbox address is
    enough to trace a complaint.
    """
    recipients = [r for r in (recipient_list or []) if r]
    if not recipients:
        logger.warning('Skipped email with no recipient (%s)', context or 'no context')
        return False

    try:
        send_mail(
            subject=mail_subject(subject),
            message=message,
            from_email=from_email or settings.DEFAULT_FROM_EMAIL,
            recipient_list=recipients,
            html_message=html_message,
            fail_silently=False,
        )
    except Exception:
        # The request that triggered this must not fail because SMTP did — but
        # the drop has to be visible in the server log, not silent.
        logger.exception('Email delivery failed (%s) to %s',
                         context or 'unspecified flow', recipients[0])
        if fail_loudly:
            raise
        return False
    return True
