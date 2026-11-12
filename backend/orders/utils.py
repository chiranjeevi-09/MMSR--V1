import io
import os
import logging
import uuid
from decimal import Decimal
from django.core.files.base import ContentFile
from django.core.mail import EmailMessage
from django.conf import settings
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable, Image as RLImage
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT

logger = logging.getLogger(__name__)

# ─── Brand palette (mirrors the site's Tailwind theme: gold/walnut/cream) ───
BRAND_GOLD = colors.HexColor('#B8860B')        # gold-500 (primary accent)
BRAND_GOLD_LIGHT = colors.HexColor('#D4AC54')  # cream border
BRAND_CREAM = colors.HexColor('#F8EEDC')       # cream bg
BRAND_CARD = colors.HexColor('#FFF9F1')        # cream card
BRAND_WALNUT = colors.HexColor('#5C4033')      # walnut-900 (headings/body dark)
BRAND_MUTED = colors.HexColor('#8A6A4A')       # cream muted text
BRAND_LINE = colors.HexColor('#EAD3B0')        # subtle divider


def order_reference(order):
    """The customer-facing reference for an order.

    Always the standardized MMSR public ID when one exists (spec §8/§11); the
    legacy ``custom_order_id`` stays as the compatibility value for rows that
    predate standardization. The internal primary key is never printed on a
    customer surface, so it only survives here as an unreachable last-resort
    guard against an empty string.
    """
    return order.public_id or order.custom_order_id or f"ORD-{order.id:05d}"


def _brand_logo_flowable(draw_width=2.5 * cm):
    """Return the MMSR logo scaled to its native aspect ratio, or None if the
    asset is missing (invoice still renders with the text wordmark)."""
    logo_path = os.path.join(settings.BASE_DIR, 'static', 'images', 'admin_logo.png')
    if not os.path.exists(logo_path):
        logger.warning(f"Invoice logo asset not found at {logo_path}; continuing without it.")
        return None
    try:
        from reportlab.lib.utils import ImageReader
        img = ImageReader(logo_path)
        iw, ih = img.getSize()
        draw_height = draw_width * (ih / iw) if iw else draw_width
        return RLImage(logo_path, width=draw_width, height=draw_height, hAlign='LEFT')
    except Exception as err:
        logger.warning(f"Could not embed invoice logo: {err}")
        return None


def generate_invoice(order, force=False):
    """Generate a PDF invoice for the given Order and save it to order.invoice_pdf.

    Idempotency check: If an invoice already exists and force is False, skips
    re-generation to prevent duplicate files and duplicate emails.
    """
    if not force and bool(order.invoice_pdf):
        logger.info(f"Invoice already exists for Order #{order.id}; skipping duplicate generation.")
        return order

    buffer = io.BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=1.8 * cm,
        leftMargin=1.8 * cm,
        topMargin=1.8 * cm,
        bottomMargin=1.8 * cm,
    )

    styles = getSampleStyleSheet()

    # --- Custom Styles ---
    brand_style = ParagraphStyle(
        'Brand',
        fontSize=19,
        fontName='Helvetica-Bold',
        textColor=BRAND_WALNUT,
        spaceAfter=0,
    )
    tagline_style = ParagraphStyle(
        'Tagline',
        fontSize=8,
        fontName='Helvetica',
        textColor=BRAND_MUTED,
        spaceAfter=0,
        leading=11,
    )
    section_header_style = ParagraphStyle(
        'SectionHeader',
        fontSize=8,
        fontName='Helvetica-Bold',
        textColor=BRAND_GOLD,
        spaceBefore=0,
        spaceAfter=6,
        letterSpacing=1.5,
    )
    title_style = ParagraphStyle(
        'Title',
        fontSize=20,
        fontName='Helvetica-Bold',
        textColor=BRAND_GOLD,
        alignment=TA_RIGHT,
        leading=24,
        spaceAfter=5,
    )
    inv_no_style = ParagraphStyle(
        'InvNo',
        fontSize=10.5,
        fontName='Helvetica-Bold',
        textColor=BRAND_WALNUT,
        alignment=TA_RIGHT,
        leading=15,
    )
    inv_date_style = ParagraphStyle(
        'InvDate',
        fontSize=10.5,
        fontName='Helvetica',
        textColor=BRAND_MUTED,
        alignment=TA_RIGHT,
        leading=15,
    )
    meta_label_style = ParagraphStyle(
        'MetaLabel',
        fontSize=8.5,
        fontName='Helvetica',
        textColor=BRAND_MUTED,
        leading=13,
    )
    normal_style = ParagraphStyle(
        'NormalCustom',
        fontSize=9,
        fontName='Helvetica',
        textColor=BRAND_WALNUT,
        leading=13.5,
    )
    footer_style = ParagraphStyle(
        'Footer',
        fontSize=8,
        fontName='Helvetica',
        textColor=BRAND_MUTED,
        alignment=TA_CENTER,
        leading=12,
        spaceAfter=0,
    )

    # Usable width: A4 21cm - 2*1.8cm margins = 17.4cm
    story = []

    from django.utils import timezone
    now = timezone.now()
    invoice_date = now.strftime("%d %B %Y")
    paid_date = order.updated_at.strftime("%d %B %Y") if order.updated_at else invoice_date
    order_ref = order_reference(order)

    # ── Header: Logo + brand wordmark (left) / INVOICE block (right) ──
    logo = _brand_logo_flowable()
    # Wordmark + contact line as ONE stacked cell. The 19pt wordmark's line box
    # reserves ~26pt of descender space, so the Spacer must exceed that before the
    # contact line clears it; 22pt yields a measured ~8.6pt visual gap. (Cell
    # padding and inner rowHeights both collapse once nested in the header table,
    # so an explicit Spacer flowable is the only reliable separator.)
    brand_col = [
        Paragraph("MMSR PUBLICATIONS", brand_style),
        Spacer(1, 22),
        Paragraph("mmsrpublications@gmail.com&nbsp;&nbsp;|&nbsp;&nbsp;+91 90424 36048", tagline_style),
    ]
    # Invoices are not an independent entity (spec §9/§3: INV is not issued),
    # so the invoice block carries the order's own public ID instead of the
    # previous INV-{internal PK} form.
    right_block = Table(
        [
            [Paragraph("INVOICE", title_style)],
            [Paragraph(order_ref, inv_no_style)],
            [Paragraph(f"Date: {invoice_date}", inv_date_style)],
        ],
        colWidths=[5.5 * cm],
        hAlign='RIGHT',
    )
    right_block.setStyle(TableStyle([
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))

    if logo:
        header_cells = [logo, brand_col, right_block]
        header_widths = [2.9 * cm, 9.0 * cm, 5.5 * cm]
    else:
        header_cells = [brand_col, right_block]
        header_widths = [11.9 * cm, 5.5 * cm]
    header_table = Table([header_cells], colWidths=header_widths)
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-2, -1), 6),
        ('RIGHTPADDING', (-1, 0), (-1, 0), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 14))
    story.append(HRFlowable(width="100%", thickness=2, color=BRAND_GOLD, spaceAfter=2))
    story.append(HRFlowable(width="100%", thickness=0.7, color=BRAND_GOLD_LIGHT, spaceAfter=16))

    # ── Meta panels: BILLED TO / INVOICE DETAILS (framed, aligned) ──
    def _panel(header_text, line_pairs, width=8.4 * cm):
        rows = [[Paragraph(header_text, section_header_style)]]
        for label, value in line_pairs:
            rows.append([
                Paragraph(
                    f"<font color='#8A6A4A'>{label}</font>&nbsp;&nbsp;&nbsp;{value}",
                    normal_style,
                )
            ])
        panel = Table(rows, colWidths=[width])
        panel.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), BRAND_CARD),
            ('BOX', (0, 0), (-1, -1), 0.6, BRAND_GOLD_LIGHT),
            ('LINEBELOW', (0, 0), (-1, 0), 0.6, BRAND_GOLD_LIGHT),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('RIGHTPADDING', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, 0), 8),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
            ('TOPPADDING', (0, 1), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 2),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        return panel

    # Proper multi-line address block: street, then city+state, then pin+country.
    # Empty components are skipped so no stray commas/dashes appear.
    city_state = ", ".join(filter(None, [order.city, order.state]))
    pin_country = ", ".join(filter(None, [order.postal_code, order.country]))
    address_lines = "<br/>".join(filter(None, [
        order.shipping_address or None,
        city_state or None,
        pin_country or None,
    ])) or "—"
    billed_to = _panel("BILLED TO", [
        ("Name", f"<b>{order.full_name}</b>"),
        ("Email", order.email or "—"),
        ("Phone", order.phone_number or "—"),
        ("Address", address_lines),
    ])
    details = _panel("INVOICE DETAILS", [
        ("Invoice No", f"<b>INV-{order.id:05d}</b>"),
        ("Order Ref", f"<b>{order_ref}</b>"),
        ("Invoice Date", invoice_date),
        ("Payment Date", paid_date),
        ("Payment Method", order.payment_method or "Online Payment"),
        ("Status", "<font color='#B8860B'><b>PAID</b></font>"),
    ])
    meta_table = Table([[billed_to, '', details]], colWidths=[8.55 * cm, 0.3 * cm, 8.55 * cm])
    meta_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 18))

    # ── Items Table ──
    story.append(Paragraph("ITEMS PURCHASED", section_header_style))

    cell_right = ParagraphStyle('CellRight', parent=normal_style, alignment=TA_RIGHT)
    cell_center = ParagraphStyle('CellCenter', parent=normal_style, alignment=TA_CENTER)
    header_cell = ParagraphStyle('CellHeader', parent=normal_style, fontName='Helvetica-Bold', textColor=colors.white, alignment=TA_CENTER, fontSize=8.5, leading=11)

    table_header = [
        Paragraph('#', header_cell),
        Paragraph('Item Description', ParagraphStyle('CellHeaderL', parent=header_cell, alignment=TA_LEFT)),
        Paragraph('Qty', header_cell),
        Paragraph('Unit Price', ParagraphStyle('CellHeaderR', parent=header_cell, alignment=TA_RIGHT)),
        Paragraph('Total', ParagraphStyle('CellTotalR', parent=header_cell, alignment=TA_RIGHT)),
    ]
    rows = [table_header]

    items = order.items.all()
    for idx, item in enumerate(items, 1):
        name = str(item)
        qty = item.quantity
        price = float(item.price)
        line_total = qty * price
        rows.append([
            Paragraph(str(idx), cell_center),
            Paragraph(name, normal_style),
            Paragraph(str(qty), cell_center),
            Paragraph(f"Rs. {price:,.2f}", cell_right),
            Paragraph(f"Rs. {line_total:,.2f}", cell_right),
        ])

    last_item_row = len(rows) - 1  # index of the final plain item row

    # Shipping row (discounted flat rate on physical orders)
    if order.requires_shipping():
        rows.append([
            Paragraph('', normal_style),
            Paragraph('', normal_style),
            Paragraph('', normal_style),
            Paragraph('Shipping (50% off Rs. 80, flat Rs. 40)', ParagraphStyle('ShipLabel', parent=normal_style, alignment=TA_RIGHT, textColor=BRAND_MUTED)),
            Paragraph(f"Rs. {float(order.get_shipping_amount()):,.2f}", cell_right),
        ])

    # Grand total row
    rows.append([
        Paragraph('', normal_style),
        Paragraph('', normal_style),
        Paragraph('', normal_style),
        Paragraph('Grand Total', ParagraphStyle('GTL', parent=normal_style, fontName='Helvetica-Bold', fontSize=10.5, alignment=TA_RIGHT, textColor=BRAND_WALNUT)),
        Paragraph(f"Rs. {float(order.total_amount):,.2f}", ParagraphStyle('GTV', parent=normal_style, fontName='Helvetica-Bold', fontSize=11.5, alignment=TA_RIGHT, textColor=BRAND_GOLD)),
    ])

    col_widths = [1.1 * cm, 8.3 * cm, 1.4 * cm, 3.3 * cm, 3.3 * cm]
    items_table = Table(rows, colWidths=col_widths, repeatRows=1)
    items_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        # Header band
        ('BACKGROUND', (0, 0), (-1, 0), BRAND_GOLD),
        ('LINEBELOW', (0, 0), (-1, 0), 1, BRAND_GOLD_LIGHT),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 7),
        ('TOPPADDING', (0, 0), (-1, 0), 7),

        # Item data rows (zebra on cream)
        ('ROWBACKGROUNDS', (0, 1), (-1, last_item_row), [colors.white, BRAND_CARD]),
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),

        # Grand total band
        ('BACKGROUND', (0, -1), (-1, -1), BRAND_CREAM),
        ('LINEABOVE', (0, -1), (-1, -1), 1, BRAND_GOLD),
        ('TOPPADDING', (0, -1), (-1, -1), 9),
        ('BOTTOMPADDING', (0, -1), (-1, -1), 9),

        # Frame
        ('BOX', (0, 0), (-1, -1), 0.7, BRAND_GOLD_LIGHT),
        ('INNERGRID', (0, 0), (-1, -1), 0.3, BRAND_LINE),
    ]))
    story.append(items_table)

    story.append(Spacer(1, 22))
    story.append(HRFlowable(width="100%", thickness=0.7, color=BRAND_GOLD_LIGHT, spaceAfter=12))

    # ── Footer ──
    story.append(Paragraph("Thank you for your purchase from MMSR Publications!", footer_style))
    story.append(Paragraph("For any queries, contact us at: mmsrpublications@gmail.com&nbsp;&nbsp;|&nbsp;&nbsp;+91 90424 36048", footer_style))
    story.append(Spacer(1, 5))
    story.append(Paragraph("This is a computer-generated invoice and does not require a physical signature.", footer_style))

    doc.build(story)

    pdf_bytes = buffer.getvalue()
    buffer.close()

    # SECURITY-QA-REPORT C-1 step 4: the storage key used to be
    # ``invoice_<reference>.pdf`` with a sequential reference, so knowing one
    # order number was enough to name every other customer's document. The
    # reference stays for human readability and a random token is appended so a
    # leaked directory listing is not a walkable sequence. The key is never
    # published: the download view names the attachment after the reference.
    filename = f"invoice_{order_reference(order)}_{uuid.uuid4().hex[:8]}.pdf"
    order.invoice_pdf.save(filename, ContentFile(pdf_bytes), save=True)

    # Automatically send the invoice to the registered email
    try:
        send_invoice_email(order)
    except Exception as e:
        logger.error(f"Failed to send automated invoice email for Order #{order.id}: {str(e)}")

    return order


def send_invoice_email(order):
    """Send the generated invoice PDF as an email attachment to the user's registered email."""
    if not order.email:
        logger.warning(f"Cannot send invoice email for Order #{order.id} - email is blank.")
        return

    subject = f"Your Order Confirmation & Invoice - Order {order_reference(order)} | MMSR Publications"
    
    html_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; color: #5C4033; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #EAD3B0; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="color: #B8860B; margin-bottom: 5px; font-size: 24px;">MMSR Publications</h2>
            </div>
            
            <p>Dear <strong>{order.full_name}</strong>,</p>
            <p>Thank you for your purchase from MMSR Publications! We are pleased to confirm that your payment has been successfully processed.</p>
            <p>Your order <strong>{order_reference(order)}</strong> has been successfully placed. We have generated a digital copy of your invoice and attached it to this email as a PDF for your records.</p>
            
            <div style="background-color: #FFF9F1; border: 1px solid #EAD3B0; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <h3 style="margin-top: 0; color: #5C4033; font-size: 16px; border-bottom: 1px solid #EAD3B0; padding-bottom: 8px;">Order Details</h3>
                <table style="width: 100%; font-size: 14px;">
                    <tr>
                        <td style="padding: 6px 0; color: #8A6A4A;">Order Reference:</td>
                        <td style="padding: 6px 0; font-weight: bold; text-align: right; color: #5C4033;">{order_reference(order)}</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 0; color: #8A6A4A;">Total Paid:</td>
                        <td style="padding: 6px 0; font-weight: bold; text-align: right; color: #B8860B; font-size: 16px;">Rs. {float(order.total_amount):,.2f}</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 0; color: #8A6A4A;">Payment Status:</td>
                        <td style="padding: 6px 0; font-weight: bold; text-align: right; color: #B8860B;">PAID</td>
                    </tr>
                </table>
            </div>
            
            <p>If you have any questions, require revisions, or need further assistance, please contact us at <a href="mailto:mmsrpublications@gmail.com" style="color: #B8860B; text-decoration: none; font-weight: 500;">mmsrpublications@gmail.com</a>.</p>
            <br>
            <p style="margin-bottom: 0; color: #8A6A4A; font-size: 13px;">Warm regards,</p>
            <p style="margin-top: 5px; font-weight: bold; color: #B8860B; font-size: 15px;">The MMSR Publications Team</p>
        </div>
    </body>
    </html>
    """
    
    email = EmailMessage(
        subject=subject,
        body=html_body,
        from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'mmsrpublications@gmail.com'),
        to=[order.email],
    )
    email.content_subtype = "html"  # Render the body as HTML
    
    # Attach the PDF
    if order.invoice_pdf:
        try:
            order.invoice_pdf.open()
            pdf_data = order.invoice_pdf.read()
            email.attach(f"invoice_{order_reference(order)}.pdf", pdf_data, "application/pdf")
        except Exception as attach_error:
            logger.error(f"Could not attach PDF file to email: {str(attach_error)}")
        finally:
            try:
                order.invoice_pdf.close()
            except:
                pass
        
    email.send(fail_silently=False)
    logger.info(f"Automated invoice email successfully sent to {order.email} for Order #{order.id}.")


def grant_journal_access_for_order(order):
    """
    Safely and idempotently grants journal issue and subscription entitlements for a paid order.

    Rules enforced:
    1. Only processes orders with status == 'paid'.
    2. Print-only format items never receive digital PDF access.
    3. Digital and bundle format issue purchases grant lifetime issue-level access.
    4. Subscription purchases grant a 1-year access window.
    5. Active subscription renewals extend the expiry from the current end_date (not now).
    6. Renewal after expiry starts a fresh 1-year window from now.
    7. Same order can be safely re-processed without creating duplicates.
    8. Access records are always linked to the order that created them, preserving the
       original order FK on the original grant (not mutated by renewals).
    9. Individual article purchases grant lifetime article-level access (digital only).
    """
    if not order or order.status != 'paid':
        logger.warning(f"Skipping journal access grant for Order #{getattr(order, 'id', None)}: status is not 'paid'.")
        return []

    if not order.user:
        logger.warning(f"Skipping journal access grant for Order #{order.id}: no linked user.")
        return []

    import datetime
    from django.db import transaction
    from django.utils import timezone
    from publications.models import UserJournalAccess

    granted_accesses = []
    now = timezone.now()

    with transaction.atomic():
        for item in order.items.all():
            # ── 1. Issue-level purchase (REMOVED) ────────────────────────────────────
            #    Issue-level purchasing was retired. Complete-issue PDF access is granted
            #    solely through an active journal subscription (branch below). We skip
            #    any journal_issue item defensively so no per-issue entitlement is ever
            #    created, without deleting historical OrderItem rows.
            if item.journal_issue:
                logger.info(
                    f"OrderItem #{item.id} references a JournalIssue. Issue-level access is "
                    f"no longer granted by purchase; skipping (Order #{order.id})."
                )
                continue

            # ── 2. Annual Journal Subscription Purchase ──────────────────────────────
            if item.journal_subscription:
                journal = item.journal_subscription

                # Idempotency check: has THIS specific order already created an access record?
                existing_for_this_order = UserJournalAccess.objects.filter(
                    user=order.user,
                    journal=journal,
                    access_type='subscription',
                    order=order
                ).first()

                if existing_for_this_order:
                    logger.info(
                        f"Order #{order.id} already processed subscription for Journal #{journal.id}. "
                        f"Returning existing access record #{existing_for_this_order.id}."
                    )
                    granted_accesses.append(existing_for_this_order)
                    continue

                # Check for an existing ACTIVE (not yet expired) subscription
                existing_active = UserJournalAccess.objects.filter(
                    user=order.user,
                    journal=journal,
                    access_type='subscription',
                    is_active=True,
                    end_date__gte=now
                ).order_by('-end_date').first()

                if existing_active:
                    # Renewal during active period: extend by 365 days from current end_date.
                    # Updates existing active record in place so queries and references remain unified.
                    old_end = existing_active.end_date
                    new_end = old_end + datetime.timedelta(days=365)
                    existing_active.end_date = new_end
                    existing_active.order = order
                    existing_active.save(update_fields=['end_date', 'order', 'updated_at'])
                    logger.info(
                        f"Renewed subscription for User {order.user.email} -> Journal #{journal.id}: "
                        f"extended from {old_end.date()} to {new_end.date()} (Order #{order.id})"
                    )
                    granted_accesses.append(existing_active)

                else:
                    # No active subscription found — grant a fresh 1-year window.
                    end_date = now + datetime.timedelta(days=365)
                    sub_access = UserJournalAccess.objects.create(
                        user=order.user,
                        journal=journal,
                        issue=None,
                        order=order,
                        access_type='subscription',
                        start_date=now,
                        end_date=end_date,
                        is_active=True,
                    )
                    logger.info(
                        f"Granted new 1-year subscription for User {order.user.email} "
                        f"-> Journal #{journal.id} until {end_date.date()} (Order #{order.id})"
                    )
                    granted_accesses.append(sub_access)

            # ── 3. Individual Article Purchase ───────────────────────────────────────
            elif item.article:
                article = item.article
                journal = article.journal

                # Idempotency: get_or_create keyed on (user, article, access_type).
                article_access, created = UserJournalAccess.objects.get_or_create(
                    user=order.user,
                    article=article,
                    access_type='article',
                    defaults={
                        'journal': journal,
                        'order': order,
                        'start_date': now,
                        'end_date': None,  # Lifetime access for purchased article
                        'is_active': True,
                    }
                )
                if created:
                    logger.info(
                        f"Granted article access for User {order.user.email} "
                        f"-> Article #{article.id} (Order #{order.id})"
                    )
                else:
                    logger.info(
                        f"Article access already exists for User {order.user.email} -> Article #{article.id}. Skipping."
                    )
                granted_accesses.append(article_access)

    return granted_accesses
