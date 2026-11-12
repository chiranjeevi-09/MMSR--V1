"""Branded HTML email for admin invitations.

Delivery uses the project's configured EMAIL_BACKEND (console backend in
dev, SMTP in production — see config/settings.py). The activation URL is
built from the canonical FRONTEND_URL setting, never from the request
Host header, so a poisoned header can't redirect invitees to another site.
"""
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.utils import timezone
from django.utils.html import escape

NAVY = '#1F2A44'      # Midnight Navy
GOLD = '#C9A66B'      # Royal Gold
IVORY = '#F7F3EB'     # Ivory

SUBJECT = 'Invitation to MMSR Publications Admin Portal'

RESPONSIBILITY_LINES = {
    'super_admin': 'Full administrative control of the MMSR Publications CMS, including granting or restricting other admins\u2019 access.',
    'publication_admin': 'Managing books, chapters, journals, issues, articles, categories and publication policies.',
    'editorial_admin': 'Reviewing manuscript and conference submissions and running the editorial workflow.',
    'finance_admin': 'Reviewing orders, payments and fulfillment records.',
    'support_admin': 'Handling user enquiries, newsletter subscribers and testimonial moderation.',
}


def _expires_label(invitation):
    return timezone.localtime(invitation.expires_at).strftime('%d %b %Y at %I:%M %p IST')


def invitation_delivery_address(invitation):
    """Where the activation mail is actually delivered.

    Security rule: setup/activation links go to the invitee's PERSONAL
    email (their sign-in identity), never the work email — the work address
    is only the login they will adopt after activating. Falls back to the
    work email when no personal address is on record (brand-new staff whose
    identity is the work email itself).
    """
    personal = (invitation.personal_email or '').strip()
    return personal or invitation.email


def build_invitation_email(invitation, raw_token):
    """Return an EmailMultiAlternatives ready to send (not yet sent)."""
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').rstrip('/')
    activation_url = f'{frontend_url}/admin/accept-invitation?token={raw_token}'
    role_display = invitation.get_role_display()
    responsibilities = RESPONSIBILITY_LINES.get(invitation.role, 'Managing the areas of the CMS assigned to you by a Super Admin.')
    first_name = escape(invitation.full_name.split(' ')[0] if invitation.full_name else 'there')
    work_email = escape(invitation.email)
    delivery_email = invitation_delivery_address(invitation)
    delivered_to_personal = delivery_email.lower() != invitation.email.lower()

    text_body = (
        f'Dear {invitation.full_name or "there"},\n\n'
        f'A Super Admin has invited you to the MMSR Publications Admin Portal as {role_display}.\n\n'
        f'Your responsibilities: {responsibilities}\n\n'
        f'Your admin login email will be: {invitation.email}\n\n'
        + (f'This activation email was sent to your personal email ({delivery_email}) for security.\n\n'
           if delivered_to_personal else '')
        + f'Set up your password (link valid until {_expires_label(invitation)}):\n{activation_url}\n\n'
        f'On that page you will create your own password — no password is ever emailed to you. '
        f'This invitation link is single-use. Once activated, sign in to the admin portal with '
        f'your work email ({invitation.email}) and the password you created.\n\n'
        f'If the link expires before you activate it, simply ask a Super Admin to send you a '
        f'fresh invitation from the Admin Access page.\n\n'
        f'If you did not expect this invitation, please ignore this email and contact the '
        f'MMSR Publications administrator.\n\n— MMSR Publications Team'
    )

    html_body = f"""
    <div style="margin:0;padding:0;background:{IVORY};font-family:Georgia,'Times New Roman',serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{IVORY};padding:24px 0;">
        <tr><td align="center">
          <table role="presentation" width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;background:#ffffff;border:1px solid #E9DFCF;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="background:{NAVY};padding:26px 32px;">
                <span style="color:{GOLD};font-size:20px;font-weight:bold;letter-spacing:1px;font-family:Georgia,serif;">MMSR PUBLICATIONS</span><br>
                <span style="color:{IVORY};font-size:12px;letter-spacing:2px;">ADMIN PORTAL INVITATION</span>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 32px;">
                <p style="margin:0 0 14px;color:#3E2E22;font-size:15px;">Dear {first_name},</p>
                <p style="margin:0 0 14px;color:#3E2E22;font-size:14px;line-height:1.6;">
                  A Super Admin has invited you to join the <strong>MMSR Publications Admin Portal</strong>
                  with the role <strong style="color:#A98042;">{escape(role_display)}</strong>.
                </p>
                <p style="margin:0 0 6px;color:#3E2E22;font-size:13px;font-weight:bold;">Your responsibilities</p>
                <p style="margin:0 0 16px;color:#5C4B3A;font-size:13px;line-height:1.6;">{escape(responsibilities)}</p>
                <p style="margin:0 0 6px;color:#3E2E22;font-size:13px;font-weight:bold;">Your admin login email</p>
                <p style="margin:0 0 4px;color:#5C4B3A;font-size:13px;">
                  <strong style="color:#A98042;">{work_email}</strong> &mdash; you will sign in to the portal with this address.
                </p>
                {'<p style="margin:0 0 20px;color:#8B7B68;font-size:11px;">This message was delivered to your <strong>personal email</strong> (' + escape(delivery_email) + ') for security &mdash; activation links are never sent to the work address alone.</p>' if delivered_to_personal else '<p style="margin:0 0 20px;"></p>'}
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
                  <tr><td style="background:{GOLD};border-radius:10px;">
                    <a href="{escape(activation_url)}" style="display:inline-block;padding:13px 30px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;">
                      Accept Invitation &amp; Activate Account
                    </a>
                  </td></tr>
                </table>
                <p style="margin:0 0 18px;color:#5C4B3A;font-size:12px;line-height:1.6;">
                  This link is valid until <strong>{_expires_label(invitation)}</strong> and can be used
                  <strong>once</strong>. On the secure activation page you will <strong>create your own
                  password</strong> &mdash; no password is ever included in this email. After activation,
                  sign in with your work email <strong>{work_email}</strong> and that password. If the link
                  expires first, ask a Super Admin to send you a fresh invitation.
                </p>
                <p style="margin:0;color:#8B7B68;font-size:11px;line-height:1.6;border-left:3px solid {GOLD};padding-left:12px;">
                  <strong>Security notice:</strong> If you did not expect this invitation, please ignore and
                  delete this email, and contact the MMSR Publications administrator if you have concerns.
                </p>
              </td>
            </tr>
            <tr>
              <td style="background:{NAVY};padding:16px 32px;">
                <span style="color:{IVORY};font-size:11px;">&copy; MMSR Publications &middot; {settings.SITE_DOMAIN}</span>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </div>
    """

    mail = EmailMultiAlternatives(
        subject=SUBJECT,
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[delivery_email],
    )
    mail.attach_alternative(html_body, 'text/html')
    return mail


def send_invitation_email(invitation, raw_token):
    """Send the invitation; True only when the email service accepted it.

    A False return means delivery FAILED — callers must not claim the email
    went out, and must keep the pending invitation for a safe resend.
    """
    try:
        build_invitation_email(invitation, raw_token).send(fail_silently=False)
        return True
    except Exception:
        # Never log the token; the view records the failure in the audit log.
        return False
