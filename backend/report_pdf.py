"""Módulo de generación de informes ejecutivos financieros en PDF con ReportLab."""

from __future__ import annotations

import io
import re
from datetime import datetime
from typing import Any

from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

# Paleta corporativa DataFinance AI
COLOR_NAVY = HexColor("#0F172A")
COLOR_PRIMARY = HexColor("#1E3A8A")
COLOR_ACCENT = HexColor("#2563EB")
COLOR_SLATE_DARK = HexColor("#334155")
COLOR_SLATE_MUTED = HexColor("#64748B")
COLOR_LIGHT_BG = HexColor("#F8FAFC")
COLOR_BORDER = HexColor("#E2E8F0")
COLOR_POSITIVE = HexColor("#059669")
COLOR_NEGATIVE = HexColor("#DC2626")
COLOR_HIGHLIGHT = HexColor("#EFF6FF")


class NumberedCanvas(canvas.Canvas):
    """Canvas de dos pasadas para calcular y numerar páginas 'Página X de Y' y añadir encabezados/pies."""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self._saved_page_states: list[dict[str, Any]] = []

    def showPage(self) -> None:
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self) -> None:
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, total_pages: int) -> None:
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(COLOR_SLATE_MUTED)

        # Encabezado para páginas subsiguientes (página > 1)
        if self._pageNumber > 1:
            self.drawString(
                36,
                756,
                "Distribuidora del Caribe S.A.S. — Informe Financiero Ejecutivo",
            )
            self.drawRightString(
                576,
                756,
                "DataFinance AI",
            )
            self.setStrokeColor(COLOR_BORDER)
            self.setLineWidth(0.5)
            self.line(36, 750, 576, 750)

        # Pie de página en todas las páginas
        self.setStrokeColor(COLOR_BORDER)
        self.setLineWidth(0.5)
        self.line(36, 42, 576, 42)

        self.drawString(
            36,
            30,
            "Confidencial · Distribuidora del Caribe S.A.S. · Barranquilla, Colombia",
        )
        self.drawRightString(
            576,
            30,
            f"Página {self._pageNumber} de {total_pages}",
        )
        self.restoreState()


def _formatear_millones(valor: float | int | None) -> str:
    if valor is None:
        return "$0.00 M"
    m = float(valor) / 1e6
    return f"${m:,.2f} M"


def _limpiar_markdown_a_xml(texto: str) -> str:
    """Convierte marcas markdown comunes (**negrita**, *cursiva*, etc.) a tags compatibles con ReportLab."""
    # Escapar ampersand que no sea entidad
    texto = re.sub(r"&(?![a-zA-Z]+;|#[0-9]+;)", "&amp;", texto)
    # Reemplazar negrita **texto** o __texto__
    texto = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", texto)
    texto = re.sub(r"__(.+?)__", r"<b>\1</b>", texto)
    # Reemplazar cursiva *texto* o _texto_
    texto = re.sub(r"\*([^\*]+?)\*", r"<i>\1</i>", texto)
    texto = re.sub(r"(?<![a-zA-Z0-9])_([^_]+?)_(?![a-zA-Z0-9])", r"<i>\1</i>", texto)
    # Reemplazar código `codigo`
    texto = re.sub(r"`([^`]+?)`", r'<font face="Courier" color="#1E3A8A">\1</font>', texto)
    return texto


def generar_pdf_reporte(
    periodo_desde: str,
    periodo_hasta: str,
    modelo: str,
    reporte_texto: str,
    resumen_sql: dict[str, Any] | None = None,
    por_categoria: list[dict[str, Any]] | None = None,
    mensual: list[dict[str, Any]] | None = None,
    generado_en: datetime | str | None = None,
) -> bytes:
    """Construye un documento PDF ejecutivo estilizado y retorna sus bytes."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=46,
        bottomMargin=50,
    )

    styles = getSampleStyleSheet()

    # Estilos tipográficos personalizados
    style_company = ParagraphStyle(
        "CompanyTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=18,
        textColor=COLOR_PRIMARY,
    )
    style_company_sub = ParagraphStyle(
        "CompanySub",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=COLOR_SLATE_MUTED,
    )
    style_doc_title = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=15,
        textColor=COLOR_NAVY,
        alignment=2,  # Derecha
    )
    style_doc_meta = ParagraphStyle(
        "DocMeta",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=COLOR_SLATE_MUTED,
        alignment=2,
    )
    style_h1 = ParagraphStyle(
        "Heading1_Custom",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=15,
        textColor=COLOR_PRIMARY,
        spaceAfter=4,
    )
    style_h2 = ParagraphStyle(
        "Heading2_Custom",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=13,
        textColor=COLOR_SLATE_DARK,
        spaceBefore=6,
        spaceAfter=3,
    )
    style_body = ParagraphStyle(
        "Body_Custom",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13.5,
        textColor=COLOR_SLATE_DARK,
        spaceAfter=5,
    )
    style_bullet = ParagraphStyle(
        "Bullet_Custom",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.8,
        leading=13,
        textColor=COLOR_SLATE_DARK,
        leftIndent=14,
        firstLineIndent=-10,
        spaceAfter=3,
    )
    style_kpi_label = ParagraphStyle(
        "KpiLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=9.5,
        textColor=COLOR_SLATE_MUTED,
        alignment=1,
    )
    style_kpi_value = ParagraphStyle(
        "KpiValue",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=14.5,
        textColor=COLOR_NAVY,
        alignment=1,
    )
    style_legal = ParagraphStyle(
        "LegalNotice",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=7.5,
        leading=10.5,
        textColor=COLOR_SLATE_MUTED,
    )

    story: list[Any] = []

    # 1. ENCABEZADO CORPORATIVO
    fecha_emision_str = (
        generado_en.strftime("%d/%m/%Y %H:%M")
        if isinstance(generado_en, datetime)
        else (str(generado_en) if generado_en else datetime.now().strftime("%d/%m/%Y %H:%M"))
    )

    header_left = [
        Paragraph("DISTRIBUIDORA DEL CARIBE S.A.S.", style_company),
        Paragraph("NIT: 901.428.539-1 · Barranquilla, Atlántico, Colombia", style_company_sub),
        Paragraph("Sistema de Inteligencia Financiera DataFinance AI", style_company_sub),
    ]

    header_right = [
        Paragraph("INFORME FINANCIERO EJECUTIVO", style_doc_title),
        Paragraph(f"<b>Periodo:</b> {periodo_desde} → {periodo_hasta}", style_doc_meta),
        Paragraph(f"<b>Fecha de emisión:</b> {fecha_emision_str}", style_doc_meta),
        Paragraph(f"<b>Modelo analista:</b> {modelo}", style_doc_meta),
    ]

    header_table = Table(
        [[header_left, header_right]],
        colWidths=[310, 230],
    )
    header_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(header_table)
    story.append(Spacer(1, 4))
    story.append(HRFlowable(width="100%", thickness=1.5, color=COLOR_PRIMARY, spaceBefore=2, spaceAfter=10))

    # 2. TARJETAS DE INDICADORES CLAVE (KPIs)
    resumen = resumen_sql or {}
    ingresos_val = resumen.get("ingresos_totales") or resumen.get("ingresos")
    gastos_val = resumen.get("gastos_totales") or resumen.get("gastos")
    utilidad_val = resumen.get("utilidad_total") or resumen.get("utilidad")
    margen_val = resumen.get("margen_pct")

    # Si vienen en millones directamente en resumen_sql
    if ingresos_val is not None and ingresos_val < 100000:
        ingresos_str = f"${ingresos_val:,.2f} M"
        gastos_str = f"${gastos_val:,.2f} M" if gastos_val is not None else "$0.00 M"
        utilidad_str = f"${utilidad_val:,.2f} M" if utilidad_val is not None else "$0.00 M"
    else:
        ingresos_str = _formatear_millones(ingresos_val)
        gastos_str = _formatear_millones(gastos_val)
        utilidad_str = _formatear_millones(utilidad_val)

    margen_str = f"{margen_val:.1f}%" if margen_val is not None else "N/A"

    kpi_cards_data = [
        [
            Paragraph("INGRESOS TOTALES", style_kpi_label),
            Paragraph("GASTOS TOTALES", style_kpi_label),
            Paragraph("UTILIDAD NETA", style_kpi_label),
            Paragraph("MARGEN OPERATIVO", style_kpi_label),
        ],
        [
            Paragraph(ingresos_str, style_kpi_value),
            Paragraph(gastos_str, style_kpi_value),
            Paragraph(
                f'<font color="{"#059669" if (utilidad_val or 0) >= 0 else "#DC2626"}">{utilidad_str}</font>',
                style_kpi_value,
            ),
            Paragraph(margen_str, style_kpi_value),
        ],
    ]

    kpi_table = Table(kpi_cards_data, colWidths=[135, 135, 135, 135])
    kpi_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), COLOR_LIGHT_BG),
                ("BOX", (0, 0), (-1, -1), 0.75, COLOR_BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
                ("TOPPADDING", (0, 0), (-1, 0), 6),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 2),
                ("TOPPADDING", (0, 1), (-1, 1), 2),
                ("BOTTOMPADDING", (0, 1), (-1, 1), 6),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    story.append(kpi_table)
    story.append(Spacer(1, 12))

    # 3. TABLA DE DETALLE POR CATEGORÍA (SI EXISTE)
    if por_categoria and len(por_categoria) > 0:
        story.append(Paragraph("DISTRIBUCIÓN POR CATEGORÍA Y OPERACIÓN", style_h1))
        cat_rows: list[list[Any]] = [
            [
                Paragraph("<b>Tipo</b>", style_kpi_label),
                Paragraph("<b>Categoría</b>", style_kpi_label),
                Paragraph("<b>Monto Total (COP)</b>", style_kpi_label),
                Paragraph("<b>Transacciones</b>", style_kpi_label),
            ]
        ]
        for item in por_categoria[:8]:  # Limitar a top 8 para no saturar
            cat_rows.append(
                [
                    Paragraph(str(item.get("TIPO", "")), style_body),
                    Paragraph(str(item.get("CATEGORIA", "")), style_body),
                    Paragraph(_formatear_millones(item.get("MONTO_TOTAL", 0)), style_body),
                    Paragraph(f'{item.get("TOTAL_TRANSACCIONES", 0):,}', style_body),
                ]
            )

        cat_table = Table(cat_rows, colWidths=[90, 190, 150, 110])
        cat_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), HexColor("#E2E8F0")),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("GRID", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, COLOR_LIGHT_BG]),
                ]
            )
        )
        story.append(cat_table)
        story.append(Spacer(1, 12))

    # 4. CUERPO NARRATIVO DEL REPORTE
    story.append(Paragraph("ANÁLISIS FINANCIERO Y ESTRATÉGICO", style_h1))
    story.append(HRFlowable(width="100%", thickness=0.75, color=COLOR_ACCENT, spaceBefore=2, spaceAfter=8))

    # Parsear el reporte markdown en elementos ReportLab estructurados
    lineas = reporte_texto.strip().split("\n")
    for linea_raw in lineas:
        linea = linea_raw.strip()
        if not linea:
            story.append(Spacer(1, 4))
            continue

        # Encabezados
        if linea.startswith("### "):
            sub = _limpiar_markdown_a_xml(linea[4:])
            story.append(Paragraph(sub, style_h2))
        elif linea.startswith("## "):
            sub = _limpiar_markdown_a_xml(linea[3:])
            story.append(Paragraph(sub, style_h1))
        elif linea.startswith("# "):
            sub = _limpiar_markdown_a_xml(linea[2:])
            story.append(Paragraph(sub, style_h1))
        # Viñetas
        elif linea.startswith(("- ", "* ", "• ")):
            bullet_txt = _limpiar_markdown_a_xml(linea[2:])
            story.append(Paragraph(f"• {bullet_txt}", style_bullet))
        elif re.match(r"^\d+\.\s", linea):
            # Lista numerada
            num_txt = _limpiar_markdown_a_xml(linea)
            story.append(Paragraph(num_txt, style_bullet))
        else:
            # Párrafo normal
            body_txt = _limpiar_markdown_a_xml(linea)
            story.append(Paragraph(body_txt, style_body))

    # 5. NOTA DE CIERRE / VALIDACIÓN AUDITABLE
    story.append(Spacer(1, 14))
    nota_cierre = (
        "<b>Declaración de trazabilidad:</b> Este informe fue generado automáticamente por DataFinance AI. "
        "Las cifras cuantitativas provienen de transformaciones reproducibles ejecutadas en Snowflake "
        "(Capa Gold / Medallion). La redacción analítica sigue la regla <i>«SQL calcula; la IA explica»</i>, "
        "garantizando fidelidad numérica y ausencia de estimaciones arbitrarias."
    )
    cierre_box = Table(
        [[Paragraph(nota_cierre, style_legal)]],
        colWidths=[540],
    )
    cierre_box.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), COLOR_LIGHT_BG),
                ("BOX", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(KeepTogether([cierre_box]))

    # Compilación con NumberedCanvas
    doc.build(story, canvasmaker=NumberedCanvas)
    return buffer.getvalue()
