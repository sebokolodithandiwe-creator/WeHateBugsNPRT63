from io import BytesIO
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
)

from app import models

VAT_RATE = 0.15
PRIMARY_COLOR = colors.HexColor('#1A365D')
BORDER_COLOR = colors.HexColor('#E2E8F0')
MUTED_COLOR = colors.HexColor('#718096')


def generate_contract_pdf(booking: models.Booking) -> bytes:
    """Builds a rental agreement PDF for a single booking and returns the raw PDF bytes."""
    customer = booking.customer
    vehicle = booking.vehicle

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'ContractTitle', parent=styles['Title'], textColor=PRIMARY_COLOR, fontSize=18, spaceAfter=2,
    )
    company_style = ParagraphStyle(
        'Company', parent=styles['Normal'], fontSize=10, textColor=MUTED_COLOR,
    )
    section_style = ParagraphStyle(
        'Section', parent=styles['Heading3'], textColor=PRIMARY_COLOR, spaceBefore=14, spaceAfter=6,
    )
    normal = styles['Normal']
    small_muted = ParagraphStyle('SmallMuted', parent=styles['Normal'], fontSize=9, textColor=MUTED_COLOR)

    story = []

    # ---- Header ----
    story.append(Paragraph('VRMS Rentals', company_style))
    story.append(Paragraph('RENTAL AGREEMENT', title_style))
    story.append(Paragraph(f'Agreement Number: {booking.id}', normal))
    story.append(Paragraph(f'Date: {datetime.utcnow().strftime("%d %B %Y")}', normal))
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width='100%', color=BORDER_COLOR, thickness=1))

    def section_table(rows, col_widths=(55 * mm, None)):
        data = [[Paragraph(f'<b>{label}</b>', small_muted), Paragraph(str(value), normal)] for label, value in rows]
        t = Table(data, colWidths=col_widths, hAlign='LEFT')
        t.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
        ]))
        return t

    # ---- Customer section ----
    story.append(Paragraph('Customer', section_style))
    story.append(section_table([
        ('Full name', customer.full_name),
        ('ID number', customer.id_number or '\u2014'),
        ("Driver's license", customer.drivers_license or '\u2014'),
        ('Phone', customer.phone),
        ('Email', customer.email or '\u2014'),
    ]))

    # ---- Vehicle section ----
    story.append(Paragraph('Vehicle', section_style))
    story.append(section_table([
        ('Make / Model / Year', f'{vehicle.make} {vehicle.model} ({vehicle.year})'),
        ('License plate', vehicle.plate),
        ('Color', vehicle.color or '\u2014'),
        ('Daily rate', f'R {vehicle.daily_rate:,.2f}'),
    ]))

    # ---- Rental details ----
    story.append(Paragraph('Rental Details', section_style))
    rental_rows = [
        ['Start date', booking.start_date.strftime('%d %B %Y %H:%M')],
        ['End date', booking.end_date.strftime('%d %B %Y %H:%M')],
        ['Total days', str(booking.total_days)],
        ['Base amount', f'R {booking.base_amount:,.2f}'],
        [f'VAT ({int(VAT_RATE * 100)}%)', f'R {booking.vat_amount:,.2f}'],
        ['Total amount', f'R {booking.total_amount:,.2f}'],
    ]
    rental_table = Table(rental_rows, colWidths=(80 * mm, 60 * mm), hAlign='LEFT')
    rental_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -2), 'Helvetica'),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, -1), (-1, -1), 12),
        ('TEXTCOLOR', (0, -1), (-1, -1), PRIMARY_COLOR),
        ('LINEABOVE', (0, -1), (-1, -1), 1, BORDER_COLOR),
        ('TOPPADDING', (0, -1), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(rental_table)

    # ---- Check-out section (filled in by hand at vehicle hand-over) ----
    story.append(Paragraph('Check-out (complete at vehicle hand-over)', section_style))
    story.append(section_table([
        ('Odometer reading', '_______________________ km'),
        ('Fuel level', '_______________________ %'),
        ('Check-out date / time', '_______________________________'),
    ]))

    # ---- Signatures ----
    story.append(Spacer(1, 24))
    story.append(HRFlowable(width='100%', color=BORDER_COLOR, thickness=1))
    story.append(Spacer(1, 24))
    sig_table = Table(
        [
            ['_____________________________', '_____________________________'],
            ['Customer signature', 'Authorized staff signature'],
        ],
        colWidths=(75 * mm, 75 * mm),
    )
    sig_table.setStyle(TableStyle([
        ('FONTSIZE', (0, 1), (-1, 1), 9),
        ('TEXTCOLOR', (0, 1), (-1, 1), MUTED_COLOR),
        ('TOPPADDING', (0, 1), (-1, 1), 2),
    ]))
    story.append(sig_table)

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
