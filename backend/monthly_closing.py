"""Módulo de Automatización del Cierre Financiero Mensual y Generación del Executive Pack.

Principio rector: «SQL calcula; la IA explica».
1. Cierra el mes vencido y recalcula los KPIs en Snowflake (DATAFINANCE.PUBLIC).
2. Ejecuta la detección estadística de anomalías (Z-Score).
3. Redacta el informe ejecutivo de IA (Groq gpt-oss-120b con fallback determinista).
4. Ensambla y archiva en almacenamiento el PDF corporativo 'Executive Pack' (ReportLab).
5. Registra la auditoría en DATAFINANCE.PUBLIC.AUDITORIA_CIERRES.
"""

from __future__ import annotations

import json
import logging
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

from backend.report_pdf import generar_pdf_reporte
from backend.snowflake_client import execute_dml, execute_file_sql, query_dicts

logger = logging.getLogger("datafinance.monthly_closing")

STORAGE_REPORTS_DIR = Path(__file__).resolve().parent.parent / "storage" / "reports"


def _formatear_millones(monto: float | None) -> str:
    if monto is None:
        return "$0.00 M COP"
    return f"${monto / 1_000_000:,.2f} M COP"


def _generar_narrativa_cierre_fallback(contexto: dict[str, Any]) -> str:
    """Genera una narrativa ejecutiva determinista en caso de no contar con Groq API."""
    resumen = contexto.get("resumen", {})
    mes = contexto.get("mes", "N/A")
    ingresos = _formatear_millones(resumen.get("INGRESOS"))
    gastos = _formatear_millones(resumen.get("GASTOS"))
    utilidad = _formatear_millones(resumen.get("UTILIDAD"))
    margen = resumen.get("MARGEN_PCT", 0.0)
    tx_total = resumen.get("TOTAL_TRANSACCIONES", 0)

    var_ing = resumen.get("VAR_INGRESOS_PCT")
    var_ing_str = f"{var_ing:+.2f}%" if var_ing is not None else "N/A"
    var_gas = resumen.get("VAR_GASTOS_PCT")
    var_gas_str = f"{var_gas:+.2f}%" if var_gas is not None else "N/A"

    anomalias = contexto.get("anomalias", [])
    categorias = contexto.get("por_categoria", [])

    lineas = [
        f"# Informe Ejecutivo de Cierre Mensual — Periodo {mes}",
        "",
        "## 1. Resumen Ejecutivo de Desempeño",
        f"Distribuidora del Caribe S.A.S. completó el cierre del periodo {mes} registrando un total de "
        f"{tx_total:,} transacciones operativas. Los ingresos totales se ubicaron en {ingresos} "
        f"({var_ing_str} frente al mes anterior), mientras que los gastos operacionales totalizaron {gastos} "
        f"({var_gas_str} frente al mes anterior).",
        f"La operación arrojó una utilidad neta de {utilidad}, consolidando un margen operativo de {margen:.2f}%.",
        "",
        "## 2. Principales Rubros Operativos",
    ]

    for cat in categorias[:5]:
        monto_cat = _formatear_millones(cat.get("MONTO_TOTAL"))
        var_cat = cat.get("VAR_PCT")
        var_cat_str = f" ({var_cat:+.1f}% vs mes anterior)" if var_cat is not None else ""
        lineas.append(
            f"- **{cat.get('TIPO', '').capitalize()} — {cat.get('CATEGORIA', '')}**: {monto_cat}{var_cat_str} "
            f"con {cat.get('TOTAL_TRANSACCIONES', 0)} movimientos."
        )

    lineas.append("")
    lineas.append("## 3. Auditoría de Riesgos y Detección de Anomalías")
    if anomalias:
        lineas.append(
            f"El algoritmo estadístico identificó **{len(anomalias)} anomalía(s)** con desvío Z-Score >= 2.5:"
        )
        for a in anomalias:
            obs = _formatear_millones(a.get("VALOR_OBSERVADO"))
            esp = _formatear_millones(a.get("VALOR_ESPERADO"))
            lineas.append(
                f"- **{a.get('CATEGORIA')} ({a.get('TIPO_ANOMALIA')})**: Observado {obs} vs Esperado {esp} "
                f"(Z={a.get('Z_SCORE')}). Motivo: {a.get('MOTIVO')}."
            )
    else:
        lineas.append(
            "No se detectaron anomalías estadísticas severas durante el periodo. Todas las categorías "
            "operaron dentro de los rangos históricos previstos (Z-Score < 2.5)."
        )

    lineas.extend([
        "",
        "## 4. Conclusiones y Recomendaciones para la Junta Directiva",
        "- Mantener estricto seguimiento a los costos logísticos y de compras mayoristas para salvaguardar el margen operativo.",
        "- Validar la liquidez de caja verificando la relación entre ventas de contado y cartera de ventas a crédito.",
        "",
        "---",
        "*Documento oficial emitido automáticamente por el motor de cierre DataFinance AI.*",
    ])

    return "\n".join(lineas)


def _redactar_narrativa_cierre(contexto: dict[str, Any]) -> tuple[str, str]:
    """Redacta la explicación ejecutiva usando Groq si está disponible o el fallback determinista."""
    load_dotenv(override=True)
    groq_key = (os.getenv("GROQ_API_KEY") or "").strip()
    groq_model = (os.getenv("GROQ_MODEL") or "openai/gpt-oss-120b").strip()

    if not groq_key or groq_key == "TU_GROQ_API_KEY":
        logger.info("GROQ_API_KEY no configurada. Usando motor narrativo determinista.")
        return "Motor Determinista DataFinance", _generar_narrativa_cierre_fallback(contexto)

    try:
        from groq import Groq

        client = Groq(api_key=groq_key)
        system_prompt = (
            "Eres el Director Financiero Senior de Distribuidora del Caribe S.A.S. (Barranquilla, Colombia, moneda COP).\n"
            "Tu tarea es redactar el Informe Ejecutivo Oficial de Cierre Mensual para la Junta Directiva.\n"
            "Reglas estrictas:\n"
            "1. Basa tu análisis EXCLUSIVAMENTE en los datos numéricos provistos en el JSON.\n"
            "2. No inventes cifras, clientes, proveedores ni explicaciones causales no comprobadas.\n"
            "3. Estructura el informe con: Resumen Ejecutivo, Comportamiento de Ingresos y Gastos, "
            "Anomalías Detectadas y Recomendaciones Operativas.\n"
            "4. Redacta en español profesional, tono ejecutivo y formal."
        )

        resp = client.chat.completions.create(
            model=groq_model,
            temperature=0.1,
            max_tokens=1100,
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": f"Datos consolidados del cierre mensual:\n{json.dumps(contexto, ensure_ascii=False)}",
                },
            ],
        )
        texto = (resp.choices[0].message.content or "").strip()
        if texto:
            return f"Groq {groq_model} (Cierre Automático)", texto
    except Exception as exc:
        logger.warning("Fallo en llamada a Groq (%s). Aplicando fallback determinista.", exc)

    return "Motor Determinista DataFinance (Fallback)", _generar_narrativa_cierre_fallback(contexto)


def obtener_ultimo_mes_completo() -> str | None:
    """Consulta en Snowflake el último mes con transacciones completas (día >= 28)."""
    _, rows = query_dicts(
        """
        SELECT ANIO_MES
        FROM DATAFINANCE.PUBLIC.TRANSACCIONES
        GROUP BY MES, ANIO_MES
        HAVING DAY(MAX(FECHA)) >= 28
        ORDER BY MES DESC
        LIMIT 1
        """
    )
    if rows:
        return str(rows[0].get("ANIO_MES"))
    return None


def verificar_cierre_previo(mes: str) -> dict[str, Any] | None:
    """Comprueba si el periodo ya fue cerrado exitosamente con anterioridad."""
    _, rows = query_dicts(
        """
        SELECT
            ID_CIERRE,
            MES_CERRADO,
            FECHA_EJECUCION,
            ESTADO,
            TOTAL_TRANSACCIONES,
            INGRESOS,
            GASTOS,
            UTILIDAD,
            MARGEN_PCT,
            TOTAL_ANOMALIAS,
            ID_REPORTE,
            NOMBRE_ARCHIVO_PDF,
            EJECUTADO_POR,
            MENSAJE
        FROM DATAFINANCE.PUBLIC.AUDITORIA_CIERRES
        WHERE MES_CERRADO = %s AND ESTADO IN ('EXITOSO', 'CON_ANOMALIAS')
        ORDER BY ID_CIERRE DESC
        LIMIT 1
        """,
        (mes,),
    )
    return rows[0] if rows else None


def listar_historial_cierres(limite: int = 20) -> list[dict[str, Any]]:
    """Devuelve la bitácora histórica de cierres mensuales realizados."""
    _, rows = query_dicts(
        """
        SELECT
            ID_CIERRE,
            MES_CERRADO,
            FECHA_EJECUCION,
            ESTADO,
            TOTAL_TRANSACCIONES,
            INGRESOS,
            GASTOS,
            UTILIDAD,
            MARGEN_PCT,
            TOTAL_ANOMALIAS,
            ID_REPORTE,
            NOMBRE_ARCHIVO_PDF,
            EJECUTADO_POR,
            MENSAJE
        FROM DATAFINANCE.PUBLIC.AUDITORIA_CIERRES
        ORDER BY ID_CIERRE DESC
        LIMIT %s
        """,
        (limite,),
    )
    return rows


def obtener_ruta_pdf_cierre(id_cierre: int) -> Path | None:
    """Localiza el archivo PDF generado en disco a partir del ID de cierre."""
    _, rows = query_dicts(
        """
        SELECT NOMBRE_ARCHIVO_PDF
        FROM DATAFINANCE.PUBLIC.AUDITORIA_CIERRES
        WHERE ID_CIERRE = %s
        LIMIT 1
        """,
        (id_cierre,),
    )
    if not rows:
        return None
    nombre = rows[0].get("NOMBRE_ARCHIVO_PDF")
    if not nombre:
        return None
    ruta = STORAGE_REPORTS_DIR / str(nombre)
    return ruta if ruta.is_file() else None


def ejecutar_cierre_mensual(
    mes: str | None = None,
    forzar: bool = False,
    disparador: str = "MANUAL_CLI",
) -> dict[str, Any]:
    """Orquesta de principio a fin el cierre financiero mensual y la compilación del PDF."""
    if not mes:
        mes = obtener_ultimo_mes_completo()
        if not mes:
            raise RuntimeError(
                "No se encontró ningún mes completo en DATAFINANCE.PUBLIC.TRANSACCIONES para cerrar."
            )

    # Validar formato YYYY-MM
    if not re.match(r"^\d{4}-\d{2}$", mes):
        raise ValueError(f"Formato de mes inválido: '{mes}'. Se requiere formato 'YYYY-MM'.")

    # Idempotencia: Verificar si ya fue cerrado
    cierre_previo = verificar_cierre_previo(mes)
    if cierre_previo and not forzar:
        logger.info("El periodo %s ya fue cerrado previamente (ID: %s).", mes, cierre_previo["ID_CIERRE"])
        return {
            "estado": "ALREADY_CLOSED",
            "mes_cerrado": mes,
            "mensaje": f"El periodo {mes} ya fue cerrado previamente. Usa 'forzar=True' para reprocesarlo.",
            "id_cierre": cierre_previo["ID_CIERRE"],
            "id_reporte": cierre_previo.get("ID_REPORTE"),
            "nombre_archivo_pdf": cierre_previo.get("NOMBRE_ARCHIVO_PDF"),
            "cierre_existente": cierre_previo,
        }

    logger.info("Iniciando Cierre Financiero para el periodo %s (Disparador: %s)...", mes, disparador)

    # 1. Refrescar KPIs y Anomalías en Snowflake ejecutando cierre_mensual.sql
    ruta_sql = Path(__file__).resolve().parent.parent / "snowflake" / "sql" / "cierre_mensual.sql"
    execute_file_sql(ruta_sql)
    logger.info("Recálculo SQL de KPI_MENSUAL y ANOMALIAS completado con éxito en Snowflake.")

    # 2. Consultar los KPIs consolidados del mes
    _, kpi_rows = query_dicts(
        """
        SELECT
            MES,
            ANIO_MES,
            ANIO,
            NUMERO_MES,
            TOTAL_TRANSACCIONES,
            INGRESOS,
            GASTOS,
            UTILIDAD,
            MARGEN_PCT,
            INGRESOS_MES_ANTERIOR,
            GASTOS_MES_ANTERIOR,
            UTILIDAD_MES_ANTERIOR,
            VAR_INGRESOS_PCT,
            VAR_GASTOS_PCT,
            VAR_UTILIDAD_PCT
        FROM DATAFINANCE.PUBLIC.KPI_MENSUAL
        WHERE ANIO_MES = %s
        LIMIT 1
        """,
        (mes,),
    )
    if not kpi_rows:
        raise ValueError(f"No se encontraron indicadores calculados para el mes {mes} en KPI_MENSUAL.")
    kpi_mes = kpi_rows[0]

    # 3. Consultar desglose por categoría
    _, cat_rows = query_dicts(
        """
        SELECT
            TIPO,
            CATEGORIA,
            TOTAL_TRANSACCIONES,
            MONTO_TOTAL,
            VAR_PCT
        FROM DATAFINANCE.PUBLIC.KPI_CATEGORIA_MENSUAL
        WHERE ANIO_MES = %s
        ORDER BY MONTO_TOTAL DESC
        """,
        (mes,),
    )

    # 4. Consultar anomalías estadísticas detectadas en el mes
    _, anomalias_rows = query_dicts(
        """
        SELECT
            CATEGORIA,
            TIPO,
            VALOR_OBSERVADO,
            VALOR_ESPERADO,
            Z_SCORE,
            TIPO_ANOMALIA,
            MOTIVO
        FROM DATAFINANCE.PUBLIC.ANOMALIAS
        WHERE ANIO_MES = %s
        ORDER BY ABS(Z_SCORE) DESC
        """,
        (mes,),
    )

    # 5. Redacción de análisis cualitativo con IA
    contexto = {
        "mes": mes,
        "resumen": kpi_mes,
        "por_categoria": cat_rows,
        "anomalias": anomalias_rows,
    }
    modelo_narrativa, reporte_texto = _redactar_narrativa_cierre(contexto)
    logger.info("Narrativa ejecutiva generada con: %s", modelo_narrativa)

    # 6. Persistencia del informe oficial en DATAFINANCE.PUBLIC.REPORTES
    resumen_datos = {
        "resumen_periodo": kpi_mes,
        "por_categoria": cat_rows,
        "anomalias": anomalias_rows,
        "cierre_automatico": True,
        "disparador": disparador,
    }
    execute_dml(
        """
        INSERT INTO DATAFINANCE.PUBLIC.REPORTES (
            GENERADO_EN,
            MODELO,
            PERIODO_DESDE,
            PERIODO_HASTA,
            RESUMEN_DATOS,
            REPORTE_TEXTO
        )
        SELECT
            CURRENT_TIMESTAMP()::TIMESTAMP_NTZ,
            %s,
            %s,
            %s,
            PARSE_JSON(%s),
            %s
        """,
        (
            modelo_narrativa,
            mes,
            mes,
            json.dumps(resumen_datos, ensure_ascii=False),
            reporte_texto,
        ),
    )
    _, rep_id_rows = query_dicts("SELECT MAX(ID_REPORTE) AS ID_REPORTE FROM DATAFINANCE.PUBLIC.REPORTES")
    id_reporte = rep_id_rows[0]["ID_REPORTE"] if rep_id_rows else None

    # 7. Compilación y almacenamiento del 'Executive Pack' en PDF corporativo
    pdf_bytes = generar_pdf_reporte(
        periodo_desde=mes,
        periodo_hasta=mes,
        modelo=modelo_narrativa,
        reporte_texto=reporte_texto,
        resumen_sql={
            "ingresos_totales": kpi_mes.get("INGRESOS"),
            "gastos_totales": kpi_mes.get("GASTOS"),
            "utilidad_total": kpi_mes.get("UTILIDAD"),
            "margen_pct": kpi_mes.get("MARGEN_PCT"),
        },
        por_categoria=cat_rows,
        mensual=[kpi_mes],
    )

    STORAGE_REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    nombre_pdf = f"Executive_Pack_{mes}.pdf"
    ruta_pdf = STORAGE_REPORTS_DIR / nombre_pdf
    ruta_pdf.write_bytes(pdf_bytes)
    logger.info("PDF Ejecutivo generado exitosamente: %s (%d bytes)", ruta_pdf, len(pdf_bytes))

    # 8. Registro en la tabla de auditoría DATAFINANCE.PUBLIC.AUDITORIA_CIERRES
    estado_cierre = "CON_ANOMALIAS" if len(anomalias_rows) > 0 else "EXITOSO"
    mensaje_cierre = (
        f"Cierre de {mes} completado. {len(anomalias_rows)} anomalía(s) detectada(s)."
        if anomalias_rows
        else f"Cierre de {mes} completado sin anomalías detectadas."
    )

    execute_dml(
        """
        INSERT INTO DATAFINANCE.PUBLIC.AUDITORIA_CIERRES (
            MES_CERRADO,
            FECHA_EJECUCION,
            ESTADO,
            TOTAL_TRANSACCIONES,
            INGRESOS,
            GASTOS,
            UTILIDAD,
            MARGEN_PCT,
            TOTAL_ANOMALIAS,
            ID_REPORTE,
            NOMBRE_ARCHIVO_PDF,
            EJECUTADO_POR,
            MENSAJE
        )
        VALUES (
            %s,
            CURRENT_TIMESTAMP()::TIMESTAMP_NTZ,
            %s,
            %s,
            %s,
            %s,
            %s,
            %s,
            %s,
            %s,
            %s,
            %s,
            %s
        )
        """,
        (
            mes,
            estado_cierre,
            kpi_mes.get("TOTAL_TRANSACCIONES", 0),
            kpi_mes.get("INGRESOS", 0),
            kpi_mes.get("GASTOS", 0),
            kpi_mes.get("UTILIDAD", 0),
            kpi_mes.get("MARGEN_PCT", 0),
            len(anomalias_rows),
            id_reporte,
            nombre_pdf,
            disparador,
            mensaje_cierre,
        ),
    )
    _, cierre_id_rows = query_dicts("SELECT MAX(ID_CIERRE) AS ID_CIERRE FROM DATAFINANCE.PUBLIC.AUDITORIA_CIERRES")
    id_cierre = cierre_id_rows[0]["ID_CIERRE"] if cierre_id_rows else None

    logger.info("Cierre mensual completado exitosamente con ID_CIERRE=%s", id_cierre)

    return {
        "estado": estado_cierre,
        "mes_cerrado": mes,
        "id_cierre": id_cierre,
        "id_reporte": id_reporte,
        "nombre_archivo_pdf": nombre_pdf,
        "kpis": kpi_mes,
        "total_anomalias": len(anomalias_rows),
        "anomalias": anomalias_rows,
        "reporte_texto": reporte_texto,
        "mensaje": mensaje_cierre,
    }
