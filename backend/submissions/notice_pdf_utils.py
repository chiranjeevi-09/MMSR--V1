"""
Publication Notice PDF generation.

Renders the same formal letter the admin review drawer previews on the
Publication Notice tab — letterhead with logo, reference block, addressee,
subject, justified body, detail table and signature — into an A4 PDF that is
attached to the submission's `certificate_file` field so the author can
download it once the editorial office issues the notice.

All values are supplied by the admin's editable notice draft (see
SubmissionReviewWorkspace); nothing here reads fabricated data and every
dynamic string is XML-escaped before flowing into reportlab Paragraphs.
Empty values are omitted from the detail table exactly like the on-screen
document.
"""
import os
from xml.sax.saxutils import escape

from django.conf import settings

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, HRFlowable,
    Flowable,
)

# Clockwise tilt applied to the official seal so it reads like a hand stamp.
SEAL_ROTATION_DEG = -2

# cert_assets/logo.png lives beside manage.py (BASE_DIR), same asset the
# print-ready browser view references.
ASSET_DIR = os.path.join(str(settings.BASE_DIR), 'cert_assets')
LOGO_PATH = os.path.join(ASSET_DIR, 'logo.png')
SEAL_PATH = os.path.join(ASSET_DIR, 'seal.png')

# Palette mirrored from the on-screen notice document.
NAVY = '#16305F'
GOLD = '#A97917'
GOLD_LIGHT = '#C9A66B'
BODY = '#2F241A'
MUTED = '#6B6B6B'
RULE = '#E9DFCF'

ORG_NAME = 'MMSR PUBLICATIONS'
# Letterhead house contacts follow the single configurable canonical domain
# (audit M-4). The historic hardcode was a third spelling (mmsr-publications
# .com); override with SITE_DOMAIN in the environment when the owner confirms
# the production domain.
CONTACT_EMAIL = f'editorial@{settings.SITE_DOMAIN}'
CONTACT_SITE = f'www.{settings.SITE_DOMAIN}'

PAGE_W, PAGE_H = A4

# Keys the admin editor sends; everything is a plain string.
VALUE_KEYS = (
    'heading', 'ref_no', 'issued_on', 'author', 'email', 'affiliation',
    'work_kind', 'title', 'target', 'id_label', 'id_value', 'volume', 'doi',
    'status', 'contact_email', 'contact_site',
)


def _clean(values):
    """Normalise the payload to trimmed strings with safe defaults."""
    v = {k: str(values.get(k, '') or '').strip() for k in VALUE_KEYS}
    if not v.get('heading'):
        v['heading'] = 'Manuscript Publication Notice'
    if not v.get('work_kind'):
        v['work_kind'] = 'work'
    if not v.get('id_label'):
        v['id_label'] = 'ISBN'
    # Letterhead contact is editable in the admin panel but always falls back
    # to the house values, so the PDF never renders an empty contact block.
    if not v.get('contact_email'):
        v['contact_email'] = CONTACT_EMAIL
    if not v.get('contact_site'):
        v['contact_site'] = CONTACT_SITE
    return v


def _logo_image(max_h_mm=16):
    """Emblem flowable keeping its true aspect ratio; None when missing."""
    if not os.path.exists(LOGO_PATH):
        return None
    ratio = 1.29  # width/height fallback (1422x1106 emblem)
    try:
        from PIL import Image as PILImage
        with PILImage.open(LOGO_PATH) as im:
            w, h = im.size
        if h:
            ratio = w / h
    except Exception:
        pass
    h = max_h_mm * mm
    return Image(LOGO_PATH, width=h * ratio, height=h)


def _seal_image(max_h_mm=20):
    """Official seal flowable (round stamp); None when the asset is missing.

    Drawn with a slight clockwise tilt so the downloaded PDF matches the
    on-screen card and the browser print view.
    """
    if not os.path.exists(SEAL_PATH):
        return None
    ratio = 1.0  # seal is square
    try:
        from PIL import Image as PILImage
        with PILImage.open(SEAL_PATH) as im:
            w, h = im.size
        if h:
            ratio = w / h
    except Exception:
        pass
    h = max_h_mm * mm
    w = h * ratio
    return _RotatedImage(SEAL_PATH, w, h, SEAL_ROTATION_DEG)


class _RotatedImage(Flowable):
    """Image flowable rendered at an angle about its centre.

    ReportLab's built-in Image cannot rotate, so we draw through the canvas and
    reserve the rotated bounding box in wrap() so layout stays correct.
    """
    def __init__(self, path, width, height, angle_deg=0):
        Flowable.__init__(self)
        self.path = path
        self.img_w = width
        self.img_h = height
        self.angle = angle_deg
        self.box_w = width
        self.box_h = height

    def wrap(self, availW, availH):
        import math
        a = math.radians(abs(self.angle))
        self.box_w = self.img_w * math.cos(a) + self.img_h * math.sin(a)
        self.box_h = self.img_w * math.sin(a) + self.img_h * math.cos(a)
        return self.box_w, self.box_h

    def draw(self):
        self.canv.saveState()
        self.canv.translate(self.box_w / 2.0, self.box_h / 2.0)
        self.canv.rotate(self.angle)
        self.canv.drawImage(self.path, -self.img_w / 2.0, -self.img_h / 2.0,
                            width=self.img_w, height=self.img_h, mask='auto')
        self.canv.restoreState()


def _styles():
    return {
        'org': ParagraphStyle('org', fontName='Times-Bold', fontSize=15, leading=18,
                              textColor=NAVY, spaceAfter=1),
        'contact': ParagraphStyle('contact', fontName='Times-Roman', fontSize=7.5,
                                  leading=10, alignment=2, textColor=MUTED),
        'meta': ParagraphStyle('meta', fontName='Times-Roman', fontSize=9,
                               leading=12, alignment=2, textColor=BODY),
        'title': ParagraphStyle('title', fontName='Times-Bold', fontSize=12,
                                leading=15, alignment=1, textColor=NAVY),
        'addr': ParagraphStyle('addr', fontName='Times-Roman', fontSize=9.5,
                               leading=13, textColor=BODY),
        'body': ParagraphStyle('body', fontName='Times-Roman', fontSize=9.5,
                               leading=13.5, alignment=4, textColor=BODY),
        'closing': ParagraphStyle('closing', fontName='Times-Roman', fontSize=9.5,
                                  leading=13.5, textColor=BODY),
        'sig': ParagraphStyle('sig', fontName='Times-Roman', fontSize=9,
                              leading=12, alignment=2, textColor=BODY),
        'sigmuted': ParagraphStyle('sigmuted', fontName='Times-Roman', fontSize=8,
                                   leading=11, alignment=2, textColor=MUTED),
    }


def _letterhead(st, m):
    # Flat single row: emblem on the left, wordmark beside it (never wrapped
    # under the logo), contact block right-aligned.
    logo = _logo_image()
    contact = Paragraph(
        f'{escape(m["contact_email"])}<br/>{escape(m["contact_site"])}',
        st['contact'])
    head = Table(
        [[logo if logo else '', Paragraph(ORG_NAME, st['org']), contact]],
        colWidths=[26 * mm, 96 * mm, 48 * mm],
        style=[('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
               ('LEFTPADDING', (0, 0), (-1, -1), 0),
               ('RIGHTPADDING', (0, 0), (-1, -1), 0),
               ('TOPPADDING', (0, 0), (-1, -1), 0),
               ('BOTTOMPADDING', (0, 0), (-1, -1), 0)])
    rules = [
        head,
        Spacer(1, 2.5 * mm),
        HRFlowable(width='100%', thickness=1.6, color=NAVY),
        Spacer(1, 0.8 * mm),
        HRFlowable(width='100%', thickness=0.6, color=GOLD_LIGHT),
    ]
    return rules


def _detail_rows(m):
    title_label = 'Article Title' if m['work_kind'].startswith('journal') else 'Chapter / Book Title'
    return [
        (title_label, m['title']),
        ('Published In', m['target']),
        (m['id_label'], m['id_value']),
        ('Volume / Issue', m['volume']),
        ('DOI', m['doi']),
        ('Reference No', m['ref_no']),
        ('Publication Status', m['status']),
    ]


def _meta_table(m, st):
    rows = [(k, v) for k, v in _detail_rows(m) if v]
    if not rows:
        return []
    data = [[Paragraph(escape(k).upper(), ParagraphStyle(
                'k', fontName='Times-Bold', fontSize=7.5, leading=10,
                textColor=GOLD)),
             Paragraph(escape(v), ParagraphStyle(
                'v', fontName='Times-Bold', fontSize=9.5, leading=12.5,
                textColor=BODY))]
            for k, v in rows]
    tbl = Table(data, colWidths=[45 * mm, 115 * mm])
    tbl.setStyle(TableStyle([
        ('LINEBELOW', (0, 0), (-1, -2), 0.5, RULE),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (0, -1), 2),
    ]))
    return [tbl]


def build_notice_flowables(m, st):
    story = list(_letterhead(st, m))
    # Heading first, then the Ref No / Date block, then the addressee details.
    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph(escape(m['heading']).upper(), st['title']))
    story.append(Spacer(1, 1.5 * mm))
    bar = Table([[HRFlowable(width='100%', thickness=1.4, color=GOLD_LIGHT)]],
                colWidths=[38 * mm], hAlign='CENTER')
    story.append(bar)
    story.append(Spacer(1, 5 * mm))
    story.append(Paragraph(
        f'Ref No: <b>{escape(m["ref_no"])}</b><br/>Date: {escape(m["issued_on"])}',
        st['meta']))
    story.append(Spacer(1, 6 * mm))

    addr = [Paragraph('To,', st['addr'])]
    addr.append(Paragraph(f'<b>{escape(m["author"])}</b>', st['addr']))
    if m['affiliation']:
        addr.append(Paragraph(escape(m['affiliation']), st['addr']))
    if m['email']:
        addr.append(Paragraph(
            f'<font color="{MUTED}">{escape(m["email"])}</font>', st['addr']))
    story.extend(addr)

    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph(
        f'<b>Subject:</b> Formal publication notice of your submitted '
        f'{escape(m["work_kind"])}', st['addr']))
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph(f'Dear {escape(m["author"])},', st['addr']))
    story.append(Spacer(1, 2.5 * mm))

    target_clause = (
        f' in <b>{escape(m["target"])}</b>' if m['target'] else '')
    story.append(Paragraph(
        f'We are pleased to inform you that your {escape(m["work_kind"])} '
        f'entitled &ldquo;{escape(m["title"])}&rdquo; has been officially '
        f'recorded for publication{target_clause} by <b>MMSR Publications</b>. '
        f'This notice confirms that your work has been accepted and entered '
        f'into the publication records of the editorial office.', st['body']))
    story.append(Spacer(1, 5 * mm))

    story.extend(_meta_table(m, st))
    story.append(Spacer(1, 5 * mm))

    story.append(Paragraph(
        'We thank you for choosing MMSR Publications for your research '
        'dissemination and congratulate you on this accomplishment.',
        st['closing']))
    story.append(Spacer(1, 10 * mm))

    # Closing block on the left with the official seal beside it.
    close_bold = ParagraphStyle('closeb', fontName='Times-Bold', fontSize=9.5,
                                leading=13, textColor=BODY)
    close_muted = ParagraphStyle('closem', fontName='Times-Roman', fontSize=8.5,
                                 leading=11, textColor=MUTED)
    close_cell = [
        Paragraph('With regards,', close_bold),
        Spacer(1, 3 * mm),
        Paragraph('MMSR Publications', close_bold),
        Paragraph('Editorial Office', close_muted),
    ]
    seal = _seal_image()
    sig_row = Table(
        [[close_cell, seal if seal is not None else '']],
        colWidths=[52 * mm, 45 * mm],
        style=TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'BOTTOM'),
            ('ALIGN', (1, 0), (1, 0), 'LEFT'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING', (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ]),
    )
    sig_row.hAlign = 'LEFT'
    story.append(sig_row)
    return story


def _make_footer(m):
    def _footer(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(RULE)
        canvas.setLineWidth(0.6)
        canvas.line(20 * mm, 16 * mm, PAGE_W - 20 * mm, 16 * mm)
        canvas.setFont('Times-Roman', 6.8)
        canvas.setFillColor(MUTED)
        canvas.drawCentredString(
            PAGE_W / 2.0, 12 * mm,
            f'{m["contact_email"]}  |  {m["contact_site"]}  |  '
            f'Generated from the submission record on file.')
        canvas.restoreState()
    return _footer


def render_notice_pdf(values):
    """Return (pdf_bytes, cleaned_values) for the supplied notice payload."""
    import io
    m = _clean(values)
    st = _styles()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=15 * mm, bottomMargin=22 * mm,
        title=f'Manuscript Publication Notice {m["ref_no"]}'.strip(),
        author='MMSR Publications',
    )
    footer = _make_footer(m)
    doc.build(build_notice_flowables(m, st),
              onFirstPage=footer, onLaterPages=footer)
    return buf.getvalue(), m


def generate_notice_pdf(submission, values):
    """Render the notice and attach it as the submission's downloadable PDF."""
    import uuid
    from django.core.files.base import ContentFile
    pdf, _ = render_notice_pdf(values)
    # Public reference + random token instead of the bare primary key
    # (SECURITY-QA-REPORT C-1 step 4): the old name was enumerable, and the
    # document carries the author's name and publication details.
    label = submission.public_id or f"sub{submission.id}"
    name = f'publication_notice_{label}_{uuid.uuid4().hex[:8]}.pdf'
    submission.certificate_file.save(name, ContentFile(pdf), save=False)
    submission.certificate_issued = True
    submission.save(update_fields=['certificate_file', 'certificate_issued'])
    return submission
