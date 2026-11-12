import io
import logging
import uuid

from django.core.files.base import ContentFile
from django.core.mail import EmailMessage
from django.conf import settings
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_CENTER

logger = logging.getLogger(__name__)

BRAND = colors.HexColor('#0077b6')


def generate_conference_invoice(submission, send_email=True):
    """Generate a PDF invoice for a paid conference paper submission and save
    it to submission.invoice_pdf. Mirrors orders.utils.generate_invoice."""
    buffer = io.BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )

    styles = getSampleStyleSheet()
    brand_style = ParagraphStyle('Brand', fontSize=17, fontName='Helvetica-Bold',
                                 textColor=BRAND, spaceAfter=2)
    tagline_style = ParagraphStyle('Tagline', fontSize=9, fontName='Helvetica',
                                   textColor=colors.HexColor('#6B7280'), spaceAfter=12)
    section_header_style = ParagraphStyle('SectionHeader', fontSize=8, fontName='Helvetica-Bold',
                                          textColor=colors.HexColor('#6B7280'), spaceBefore=12,
                                          spaceAfter=4, letterSpacing=1.5)
    title_style = ParagraphStyle('Title', fontSize=14, fontName='Helvetica-Bold',
                                 textColor=colors.HexColor('#111827'), spaceAfter=4)
    normal_style = ParagraphStyle('NormalCustom', fontSize=9, fontName='Helvetica',
                                  textColor=colors.HexColor('#374151'), leading=14)
    bold_style = ParagraphStyle('BoldCustom', fontSize=9, fontName='Helvetica-Bold',
                                textColor=colors.HexColor('#111827'))
    footer_style = ParagraphStyle('Footer', fontSize=8, fontName='Helvetica',
                                  textColor=colors.HexColor('#9CA3AF'),
                                  alignment=TA_CENTER, spaceAfter=0)

    esc = lambda v: (str(v) if v is not None else '—').replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

    conference = submission.conference
    from django.utils import timezone
    now = timezone.now()
    paid_date = submission.updated_at.strftime("%d %B %Y") if submission.updated_at else now.strftime("%d %B %Y")

    story = []

    # ── Header: Brand + Invoice Label ──
    header_data = [
        [
            Paragraph("MMSR Publications", brand_style),
            Paragraph("INVOICE", title_style),
        ],
        [
            Paragraph("Premium Scientific & Research Publications", tagline_style),
            Paragraph("", normal_style),
        ],
    ]
    header_table = Table(header_data, colWidths=[10 * cm, 7 * cm])
    header_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (0, 0), 'LEFT'),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(header_table)
    story.append(HRFlowable(width="100%", thickness=1.5, color=BRAND, spaceAfter=14))

    # ── Billed To | Invoice Meta ──
    address_bits = ', '.join(filter(None, [submission.institution, submission.department, submission.country]))
    meta_data = [
        [
            Paragraph("BILLED TO (APPLICANT)", section_header_style),
            Paragraph("INVOICE DETAILS", section_header_style),
        ],
        [
            Paragraph(f"<b>{esc(submission.author_full_name)}</b>", bold_style),
            Paragraph(f"<b>Invoice No:</b>  CONF-INV-{esc(submission.public_id or submission.id)}", normal_style),
        ],
        [
            Paragraph(esc(submission.author_email), normal_style),
            Paragraph(f"<b>Submission Reference:</b>  {esc(submission.reference_number)}", normal_style),
        ],
        [
            Paragraph(esc(submission.author_phone) or "—", normal_style),
            Paragraph(f"<b>Payment Date:</b>  {paid_date}", normal_style),
        ],
        [
            Paragraph(esc(address_bits) or "—", normal_style),
            Paragraph(f"<b>Status:</b>  PAID", normal_style),
        ],
    ]
    meta_table = Table(meta_data, colWidths=[9 * cm, 8 * cm])
    meta_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 16))

    # ── Conference Details ──
    story.append(Paragraph("CONFERENCE", section_header_style))
    conf_dates = ' — '.join(filter(None, [
        conference.start_date.strftime('%d %b %Y') if conference.start_date else '',
        conference.end_date.strftime('%d %b %Y') if conference.end_date else '',
    ]))
    conf_rows = [
        [Paragraph("<b>Title:</b>", normal_style), Paragraph(esc(conference.title), normal_style)],
        [Paragraph("<b>Acronym:</b>", normal_style), Paragraph(esc(conference.acronym or '—'), normal_style)],
        [Paragraph("<b>Venue:</b>", normal_style), Paragraph(esc(f"{conference.venue}, {conference.country}".strip(', ')) or '—', normal_style)],
        [Paragraph("<b>Dates:</b>", normal_style), Paragraph(esc(conf_dates) or '—', normal_style)],
    ]
    conf_table = Table(conf_rows, colWidths=[3.5 * cm, 13.5 * cm])
    conf_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))
    story.append(conf_table)

    # ── Paper Details ──
    story.append(Paragraph("PAPER DETAILS", section_header_style))
    manuscript_name = submission.manuscript_file.name.rsplit('/', 1)[-1] if submission.manuscript_file else '—'
    paper_rows = [
        [Paragraph("<b>Paper Title:</b>", normal_style), Paragraph(esc(submission.title), normal_style)],
        [Paragraph("<b>Track:</b>", normal_style), Paragraph(esc(submission.selected_track or '—'), normal_style)],
        [Paragraph("<b>Presentation Mode:</b>", normal_style), Paragraph(esc(submission.presentation_mode or '—'), normal_style)],
        [Paragraph("<b>Keywords:</b>", normal_style), Paragraph(esc(submission.keywords or '—'), normal_style)],
        [Paragraph("<b>Abstract:</b>", normal_style), Paragraph(esc(submission.abstract), normal_style)],
        [Paragraph("<b>Manuscript File:</b>", normal_style), Paragraph(esc(manuscript_name), normal_style)],
    ]
    paper_table = Table(paper_rows, colWidths=[4 * cm, 13 * cm])
    paper_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))
    story.append(paper_table)

    # ── Authors (ordered) ──
    story.append(Paragraph("AUTHORS", section_header_style))
    author_rows = [['#', 'Name', 'Email', 'Affiliation']]
    for idx, author in enumerate(submission.authors.all(), 1):
        suffix = ' (Corresponding)' if author.is_corresponding else ''
        affiliation = ', '.join(filter(None, [author.institution, author.department])) or '—'
        author_rows.append([
            str(idx),
            Paragraph(esc(author.full_name) + suffix, normal_style),
            Paragraph(esc(author.email or '—'), normal_style),
            Paragraph(esc(affiliation), normal_style),
        ])
    authors_table = Table(author_rows, colWidths=[1 * cm, 5.5 * cm, 5 * cm, 5.5 * cm], repeatRows=1)
    authors_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('BACKGROUND', (0, 0), (-1, 0), BRAND),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F9FAFB')]),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#D1D5DB')),
        ('INNERGRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#E5E7EB')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 1), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 4),
    ]))
    story.append(authors_table)
    story.append(Spacer(1, 16))

    # ── Fee Line Items ──
    story.append(Paragraph("PAYMENT", section_header_style))
    fee = float(submission.submission_fee)
    items = [
        ['#', 'Description', 'Qty', 'Amount'],
        ['1',
         Paragraph(f"Conference Paper Submission Fee — {esc(conference.acronym or conference.title)} "
                   f"(Ref: {esc(submission.reference_number)})", normal_style),
         '1', f"Rs. {fee:,.2f}"],
        ['', '', 'Grand Total', f"Rs. {fee:,.2f}"],
    ]
    items_table = Table(items, colWidths=[1 * cm, 10.5 * cm, 1.5 * cm, 3.5 * cm])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BRAND),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ALIGN', (2, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (0, -1), (-1, -1), BRAND),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#EFF9FF')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#D1D5DB')),
        ('INNERGRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#E5E7EB')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 10))

    pay_bits = [
        f"<b>Payment Gateway:</b>  Razorpay",
        f"<b>Payment ID:</b>  {esc(submission.razorpay_payment_id) or '—'}",
        f"<b>Razorpay Order ID:</b>  {esc(submission.razorpay_order_id) or '—'}",
    ]
    story.append(Paragraph(' &nbsp;|&nbsp; '.join(pay_bits), normal_style))

    story.append(Spacer(1, 24))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#E5E7EB'), spaceAfter=14))
    story.append(Paragraph("Thank you for submitting your paper to MMSR Publications!", footer_style))
    story.append(Paragraph("For any queries, contact us at: mmsrpublications@gmail.com | +91 90424 36048", footer_style))
    story.append(Spacer(1, 6))
    story.append(Paragraph("This is a computer-generated invoice and does not require a physical signature.", footer_style))

    doc.build(story)

    pdf_bytes = buffer.getvalue()
    buffer.close()

    # SECURITY-QA-REPORT C-1 / C-1 step 4: this used to be
    # ``invoice_conference_submission_<pk>.pdf`` — the internal primary key in
    # the filename of a confidential financial document, in the publicly served
    # media tree. It is now stored in PROTECTED_MEDIA_ROOT and the name carries
    # the public reference plus a random token instead of the PK.
    label = submission.public_id or submission.reference_number or f"sub{submission.id}"
    filename = f"invoice_{label}_{uuid.uuid4().hex[:8]}.pdf"
    submission.invoice_pdf.save(filename, ContentFile(pdf_bytes), save=True)

    if send_email:
        # Automatically send the invoice to the submitting author's email
        try:
            send_conference_invoice_email(submission)
        except Exception as e:
            logger.error(f"Failed to send conference invoice email for Submission #{submission.id}: {str(e)}")

    return submission


def send_conference_invoice_email(submission):
    """Email the conference invoice PDF to the applicant's registered email."""
    if not submission.author_email:
        logger.warning(f"Cannot send conference invoice email for #{submission.id} - email is blank.")
        return

    conference = submission.conference
    fee = float(submission.submission_fee)
    subject = f"Submission Payment Invoice - {submission.reference_number} | MMSR Publications"

    html_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; color: #333333; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #0077b6; margin-bottom: 5px;">MMSR Publications</h2>
            <p>Dear <strong>{submission.author_full_name}</strong>,</p>
            <p>Your conference paper submission has been received and the payment of
            <strong>Rs. {fee:,.2f}</strong> has been successfully processed.</p>
            <ul>
                <li><strong>Paper:</strong> {submission.title}</li>
                <li><strong>Conference:</strong> {conference.title}</li>
                <li><strong>Reference:</strong> {submission.reference_number}</li>
            </ul>
            <p>Your invoice is attached to this email as a PDF for your records.</p>
            <p>Warm regards,<br><strong>The MMSR Publications Team</strong></p>
        </div>
    </body>
    </html>
    """

    email = EmailMessage(
        subject=subject,
        body=html_body,
        from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'mmsrpublications@gmail.com'),
        to=[submission.author_email],
    )
    email.content_subtype = "html"

    if submission.invoice_pdf:
        try:
            email.attach(
                submission.invoice_pdf.name.rsplit('/', 1)[-1],
                submission.invoice_pdf.read(),
                'application/pdf',
            )
        except Exception as e:
            logger.error(f"Failed to attach conference invoice for #{submission.id}: {str(e)}")

    email.send()
