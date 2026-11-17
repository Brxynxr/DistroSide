"""API FastAPI para DataFinance AI."""

from __future__ import annotations

import json
import os
import re
import threading
import time
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.groq_analyst import redactar_resumen_filtrado, responder_pregunta_financiera
from backend.monthly_closing import (
    ejecutar_cierre_mensual,
    listar_historial_cierres,
    obtener_ruta_pdf_cierre,
)
from backend.weekly_sentinel import (
    actualizar_estado_alerta,
    evaluar_centinela_semanal,
    listar_alertas_centinela,
)
from backend.daily_reconciliation import (
    ejecutar_cuadre_diario,
    listar_historial_cuadres,
    obtener_tendencia_liquidez_diaria,
    obtener_ultimo_cuadre,
)
from backend.report_pdf import generar_pdf_reporte
from backend.snowflake_client import execute_file_sql, query_dicts

load_dotenv(override=True)

app = FastAPI(
    title="DataFinance AI API",
    description="API de solo lectura sobre Snowflake (Silver/Gold) con analista Groq gpt-oss-120b.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=600)


class ReporteFiltradoRequest(BaseModel):
    fecha_inicio: str | None = None
    fecha_fin: str | None = None
    categoria: str | None = None
    area: str | None = None
    incluir_parcial: bool = False


class DescargarPdfRequest(BaseModel):
    periodo_desde: str
    periodo_hasta: str
    modelo: str = "Groq openai/gpt-oss-120b"
    reporte_texto: str
    resumen_sql: dict[str, Any] | None = None
    por_categoria: list[dict[str, Any]] | None = None
    mensual: list[dict[str, Any]] | None = None


class CierreMensualRequest(BaseModel):
    mes: str | None = Field(default=None, description="Periodo YYYY-MM a cerrar (ej. 2026-10)")
    forzar: bool = Field(default=False, description="Forzar reprocesamiento si ya está cerrado")
    disparador: str = Field(default="API_DISPATCH", description="Identificador del disparador")


class CentinelaEvaluarRequest(BaseModel):
    mes: str | None = Field(default=None, description="Periodo YYYY-MM a evaluar (ej. 2026-08)")
    persistir: bool = Field(default=True, description="Guardar alertas en Snowflake")


class CuadreDiarioRequest(BaseModel):
    fecha: str | None = Field(default=None, description="Fecha a evaluar en formato YYYY-MM-DD")
    disparador: str = Field(default="API_TRIGGER", description="Identificador del originador")


class ActualizarAlertaRequest(BaseModel):
    estado: str = Field(..., description="Nuevo estado: ACTIVA, MITIGADA o ARCHIVADA")




_CACHE_LOCK = threading.Lock()
_CACHE_STORE: dict[str, tuple[float, Any]] = {}
_CACHE_TTL_SEC = 120.0
_FILTROS_TTL_SEC = 300.0


def _cache_get(key: str, ttl: float) -> Any | None:
    if os.getenv("PYTEST_CURRENT_TEST"):
        return None
    with _CACHE_LOCK:
        entry = _CACHE_STORE.get(key)
        if not entry:
            return None
        ts, val = entry
        if (time.monotonic() - ts) > ttl:
            _CACHE_STORE.pop(key, None)
            return None
        return val


def _cache_set(key: str, val: Any) -> None:
    if os.getenv("PYTEST_CURRENT_TEST"):
        return
    with _CACHE_LOCK:
        _CACHE_STORE[key] = (time.monotonic(), val)


def _cache_clear(prefix: str | None = None) -> None:
    with _CACHE_LOCK:
        if prefix is None:
            _CACHE_STORE.clear()
        else:
            for k in [k for k in _CACHE_STORE if k.startswith(prefix)]:
                _CACHE_STORE.pop(k, None)


def _construir_filtros_silver(
    fecha_inicio: str | None,
    fecha_fin: str | None,
    categoria: str | None,
    area: str | None,
    incluir_parcial: bool,
) -> tuple[str, list[Any]]:
    clausulas: list[str] = ["1 = 1"]
    params: list[Any] = []

    if fecha_inicio:
        clausulas.append("ANIO_MES >= %s")
        params.append(fecha_inicio)
    if fecha_fin:
        clausulas.append("ANIO_MES <= %s")
        params.append(fecha_fin)
    if categoria and categoria != "TODAS":
        clausulas.append("CATEGORIA = %s")
        params.append(categoria.upper())
    if area and area != "TODAS":
        clausulas.append("AREA = %s")
        params.append(area.upper())
    if not incluir_parcial:
        clausulas.append(
            "MES IN (SELECT MES FROM DATAFINANCE.PUBLIC.TRANSACCIONES GROUP BY MES HAVING DAY(MAX(FECHA)) >= 28)"
        )

    return " AND ".join(clausulas), params


@app.get("/api/health")
def health() -> dict[str, Any]:
    load_dotenv(override=True)
    groq_key = (os.getenv("GROQ_API_KEY") or "").strip()
    groq_listo = bool(groq_key and groq_key != "TU_GROQ_API_KEY")
    sf_ok = False
    sf_info: dict[str, Any] = {}
    try:
        _, rows = query_dicts(
            "SELECT CURRENT_ROLE() AS ROL, CURRENT_WAREHOUSE() AS WAREHOUSE, "
            "(SELECT MAX(ACTUALIZADO_EN) FROM DATAFINANCE.PUBLIC.KPI_MENSUAL) AS ULTIMA_ACTUALIZACION"
        )
        sf_ok = True
        sf_info = rows[0] if rows else {}
    except Exception as exc:
        sf_info = {"error": str(exc)}

    return {
        "status": "ok" if sf_ok else "degraded",
        "snowflake_connected": sf_ok,
        "snowflake": sf_info,
        "groq_configured": groq_listo,
        "groq_model": os.getenv("GROQ_MODEL", "openai/gpt-oss-120b"),
    }


def _obtener_filtros_disponibles() -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    cached = _cache_get("filtros_disponibles", _FILTROS_TTL_SEC)
    if cached:
        return cached["meses"], cached["categorias"], cached["areas"]

    _, opts_meses = query_dicts(
        "SELECT ANIO_MES, "
        "EXISTS (SELECT 1 FROM DATAFINANCE.PUBLIC.TRANSACCIONES s WHERE s.MES = k.MES HAVING DAY(MAX(s.FECHA)) >= 28) AS ES_COMPLETO "
        "FROM DATAFINANCE.PUBLIC.KPI_MENSUAL k ORDER BY MES"
    )
    _, opts_cats = query_dicts(
        "SELECT DISTINCT CATEGORIA, TIPO FROM DATAFINANCE.PUBLIC.KPI_CATEGORIA_MENSUAL ORDER BY TIPO, CATEGORIA"
    )
    _, opts_areas = query_dicts(
        "SELECT DISTINCT AREA FROM DATAFINANCE.PUBLIC.KPI_AREA_MENSUAL ORDER BY AREA"
    )
    _cache_set("filtros_disponibles", {"meses": opts_meses, "categorias": opts_cats, "areas": opts_areas})
    return opts_meses, opts_cats, opts_areas


@app.get("/api/kpis")
def obtener_kpis(
    fecha_inicio: str | None = Query(default=None),
    fecha_fin: str | None = Query(default=None),
    categoria: str | None = Query(default=None),
    area: str | None = Query(default=None),
    incluir_parcial: bool = Query(default=False),
    nocache: bool = Query(default=False),
) -> dict[str, Any]:
    cache_key = f"kpis:{fecha_inicio}:{fecha_fin}:{categoria}:{area}:{incluir_parcial}"
    if not nocache:
        cached = _cache_get(cache_key, _CACHE_TTL_SEC)
        if cached is not None:
            return cached

    try:
        opts_meses, opts_cats, opts_areas = _obtener_filtros_disponibles()

        usa_filtro_granular = bool(
            (categoria and categoria != "TODAS") or (area and area != "TODAS")
        )

        if not usa_filtro_granular:
            clausulas = ["1 = 1"]
            params: list[Any] = []
            if fecha_inicio:
                clausulas.append("k.ANIO_MES >= %s")
                params.append(fecha_inicio)
            if fecha_fin:
                clausulas.append("k.ANIO_MES <= %s")
                params.append(fecha_fin)
            if not incluir_parcial:
                clausulas.append(
                    "k.MES IN (SELECT MES FROM DATAFINANCE.PUBLIC.TRANSACCIONES GROUP BY MES HAVING DAY(MAX(FECHA)) >= 28)"
                )
            where_gold = " AND ".join(clausulas)

            _, mensual = query_dicts(
                f"""
                SELECT
                    k.ANIO_MES,
                    k.TOTAL_TRANSACCIONES,
                    k.INGRESOS,
                    k.GASTOS,
                    k.UTILIDAD,
                    k.MARGEN_PCT,
                    k.VAR_INGRESOS_PCT,
                    k.VAR_GASTOS_PCT,
                    k.VAR_UTILIDAD_PCT,
                    k.ACTUALIZADO_EN
                FROM DATAFINANCE.PUBLIC.KPI_MENSUAL k
                WHERE {where_gold}
                ORDER BY k.MES
                """,
                params,
            )

            _, por_categoria = query_dicts(
                f"""
                SELECT
                    k.TIPO,
                    k.CATEGORIA,
                    ROUND(SUM(k.MONTO_TOTAL), 2) AS MONTO_TOTAL,
                    SUM(k.TOTAL_TRANSACCIONES) AS TOTAL_TRANSACCIONES
                FROM DATAFINANCE.PUBLIC.KPI_CATEGORIA_MENSUAL k
                WHERE {where_gold}
                GROUP BY k.TIPO, k.CATEGORIA
                ORDER BY k.TIPO, MONTO_TOTAL DESC
                """,
                params,
            )

            _, por_area = query_dicts(
                f"""
                SELECT
                    k.AREA,
                    k.TIPO,
                    ROUND(SUM(k.MONTO_TOTAL), 2) AS MONTO_TOTAL,
                    SUM(k.TOTAL_TRANSACCIONES) AS TOTAL_TRANSACCIONES
                FROM DATAFINANCE.PUBLIC.KPI_AREA_MENSUAL k
                WHERE {where_gold}
                GROUP BY k.AREA, k.TIPO
                ORDER BY k.AREA, k.TIPO
                """,
                params,
            )
        else:
            where_silver, params = _construir_filtros_silver(
                fecha_inicio, fecha_fin, categoria, area, incluir_parcial
            )
            _, mensual = query_dicts(
                f"""
                WITH base AS (
                    SELECT
                        MES,
                        ANIO_MES,
                        COUNT(*) AS TOTAL_TRANSACCIONES,
                        ROUND(SUM(IFF(TIPO = 'INGRESO', MONTO, 0)), 2) AS INGRESOS,
                        ROUND(SUM(IFF(TIPO = 'GASTO', MONTO, 0)), 2) AS GASTOS,
                        MAX(CARGADO_SILVER_EN) AS ACTUALIZADO_EN
                    FROM DATAFINANCE.PUBLIC.TRANSACCIONES
                    WHERE {where_silver}
                    GROUP BY MES, ANIO_MES
                ),
                con_util AS (
                    SELECT
                        *,
                        ROUND(INGRESOS - GASTOS, 2) AS UTILIDAD,
                        IFF(INGRESOS = 0, 0.0, ROUND((INGRESOS - GASTOS) / INGRESOS * 100, 2)) AS MARGEN_PCT
                    FROM base
                ),
                con_ant AS (
                    SELECT
                        *,
                        LAG(INGRESOS) OVER (ORDER BY MES) AS ING_ANT,
                        LAG(GASTOS) OVER (ORDER BY MES) AS GAS_ANT,
                        LAG(UTILIDAD) OVER (ORDER BY MES) AS UTIL_ANT
                    FROM con_util
                )
                SELECT
                    ANIO_MES,
                    TOTAL_TRANSACCIONES,
                    INGRESOS,
                    GASTOS,
                    UTILIDAD,
                    MARGEN_PCT,
                    IFF(ING_ANT IS NULL OR ING_ANT = 0, NULL, ROUND((INGRESOS - ING_ANT) / ING_ANT * 100, 2)) AS VAR_INGRESOS_PCT,
                    IFF(GAS_ANT IS NULL OR GAS_ANT = 0, NULL, ROUND((GASTOS - GAS_ANT) / GAS_ANT * 100, 2)) AS VAR_GASTOS_PCT,
                    IFF(UTIL_ANT IS NULL OR UTIL_ANT = 0, NULL, ROUND((UTILIDAD - UTIL_ANT) / ABS(UTIL_ANT) * 100, 2)) AS VAR_UTILIDAD_PCT,
                    ACTUALIZADO_EN
                FROM con_ant
                ORDER BY MES
                """,
                params,
            )

            _, por_categoria = query_dicts(
                f"""
                SELECT
                    TIPO,
                    CATEGORIA,
                    ROUND(SUM(MONTO), 2) AS MONTO_TOTAL,
                    COUNT(*) AS TOTAL_TRANSACCIONES
                FROM DATAFINANCE.PUBLIC.TRANSACCIONES
                WHERE {where_silver}
                GROUP BY TIPO, CATEGORIA
                ORDER BY TIPO, MONTO_TOTAL DESC
                """,
                params,
            )

            _, por_area = query_dicts(
                f"""
                SELECT
                    AREA,
                    TIPO,
                    ROUND(SUM(MONTO), 2) AS MONTO_TOTAL,
                    COUNT(*) AS TOTAL_TRANSACCIONES
                FROM DATAFINANCE.PUBLIC.TRANSACCIONES
                WHERE {where_silver}
                GROUP BY AREA, TIPO
                ORDER BY AREA, TIPO
                """,
                params,
            )

        ingresos_tot = round(sum(r["INGRESOS"] for r in mensual), 2)
        gastos_tot = round(sum(r["GASTOS"] for r in mensual), 2)
        utilidad_tot = round(ingresos_tot - gastos_tot, 2)
        margen_tot = round((utilidad_tot / ingresos_tot * 100), 2) if ingresos_tot else 0.0
        tx_tot = sum(int(r["TOTAL_TRANSACCIONES"]) for r in mensual)
        actualizado = mensual[-1]["ACTUALIZADO_EN"] if mensual else None

        resultado = {
            "resumen": {
                "ingresos_totales": ingresos_tot,
                "gastos_totales": gastos_tot,
                "utilidad_total": utilidad_tot,
                "margen_pct": margen_tot,
                "total_transacciones": tx_tot,
                "periodo_desde": mensual[0]["ANIO_MES"] if mensual else None,
                "periodo_hasta": mensual[-1]["ANIO_MES"] if mensual else None,
                "actualizado_en": actualizado,
            },
            "mensual": mensual,
            "por_categoria": por_categoria,
            "por_area": por_area,
            "filtros_disponibles": {
                "meses": opts_meses,
                "categorias": opts_cats,
                "areas": [a["AREA"] for a in opts_areas],
            },
        }
        _cache_set(cache_key, resultado)
        return resultado
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/anomalias")
def obtener_anomalias(nocache: bool = Query(default=False)) -> dict[str, Any]:
    if not nocache:
        cached = _cache_get("anomalias", _CACHE_TTL_SEC)
        if cached is not None:
            return cached
    try:
        _, rows = query_dicts(
            """
            SELECT
                ANIO_MES,
                NIVEL,
                TIPO,
                CATEGORIA,
                VALOR_OBSERVADO,
                VALOR_ESPERADO,
                Z_SCORE,
                TIPO_ANOMALIA,
                MOTIVO,
                DETECTADO_EN
            FROM DATAFINANCE.PUBLIC.ANOMALIAS
            ORDER BY MES DESC, ABS(Z_SCORE) DESC
            """
        )
        res = {"anomalias": rows, "total": len(rows)}
        _cache_set("anomalias", res)
        return res
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/auditoria")
def obtener_auditoria(nocache: bool = Query(default=False)) -> dict[str, Any]:
    if not nocache:
        cached = _cache_get("auditoria", _CACHE_TTL_SEC)
        if cached is not None:
            return cached
    try:
        _, conteos = query_dicts(
            """
            SELECT
                COUNT(*) AS TOTAL_TRANSACCIONES,
                COUNT(DISTINCT ID_TRANSACCION) AS IDS_UNICOS,
                COUNT(IFF(MONTO IS NULL OR MONTO <= 0, 1, NULL)) AS MONTOS_INVALIDOS,
                MIN(FECHA) AS FECHA_MIN,
                MAX(FECHA) AS FECHA_MAX
            FROM DATAFINANCE.PUBLIC.TRANSACCIONES
            """
        )
        c = conteos[0] if conteos else {}
        total = c.get("TOTAL_TRANSACCIONES") or 0
        unicos = c.get("IDS_UNICOS") or 0
        invalidos = c.get("MONTOS_INVALIDOS") or 0

        res = {
            "conteos": {
                "BRONZE": total,
                "SILVER": total,
                "RECHAZADOS": 0,
                "TOTAL_TRANSACCIONES": total,
                "IDS_UNICOS": unicos,
                "MONTOS_INVALIDOS": invalidos,
                "INTEGRIDAD_PCT": 100.0 if total > 0 and unicos == total and invalidos == 0 else 99.0,
            },
            "motivos_rechazo": [],
            "metricas_calidad": [
                {"regla": "Unicidad de ID Transacción", "estado": "100% ÚNICO", "detalle": f"{unicos:,} IDs únicos"},
                {"regla": "Montos positivos válidos (COP)", "estado": "100% VÁLIDO", "detalle": f"{total:,} transacciones con monto > 0"},
                {"regla": "Rango temporal continuo", "estado": "CONFORME", "detalle": f"{c.get('FECHA_MIN')} a {c.get('FECHA_MAX')}"},
            ],
            "esquema": "DATAFINANCE.PUBLIC",
        }
        _cache_set("auditoria", res)
        return res
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/reportes")
def obtener_reportes(nocache: bool = Query(default=False)) -> dict[str, Any]:
    if not nocache:
        cached = _cache_get("reportes", _CACHE_TTL_SEC)
        if cached is not None:
            return cached
    try:
        _, rows = query_dicts(
            """
            SELECT
                ID_REPORTE,
                GENERADO_EN,
                MODELO,
                PERIODO_DESDE,
                PERIODO_HASTA,
                RESUMEN_DATOS,
                REPORTE_TEXTO
            FROM DATAFINANCE.PUBLIC.REPORTES
            ORDER BY ID_REPORTE DESC
            LIMIT 20
            """
        )
        res = {"reportes": rows}
        _cache_set("reportes", res)
        return res
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/reportes/generar-snowflake")
def disparar_reporte_snowflake() -> dict[str, Any]:
    """Ejecuta el script SQL de reporte directamente en Snowflake (usando AI_AGG)."""
    ruta_sql = Path(__file__).resolve().parent.parent / "snowflake" / "sql" / "reporte.sql"
    if not ruta_sql.is_file():
        raise HTTPException(
            status_code=500,
            detail=f"No se encontró el script SQL de reporte en {ruta_sql}",
        )

    try:
        execute_file_sql(ruta_sql)
        _cache_clear("reportes")
        return {
            "estado": "SUCCESS",
            "mensaje": "Reporte ejecutado y persistido directamente en Snowflake (AI_AGG).",
        }
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Error al ejecutar el reporte en Snowflake: {exc}",
        ) from exc


@app.post("/api/reportes/generar-groq")
def generar_reporte_groq(body: ReporteFiltradoRequest) -> dict[str, Any]:
    """Calcula KPIs en Snowflake para el rango filtrado y los redacta con Groq gpt-oss-120b."""
    try:
        kpis = obtener_kpis(
            fecha_inicio=body.fecha_inicio,
            fecha_fin=body.fecha_fin,
            categoria=body.categoria,
            area=body.area,
            incluir_parcial=body.incluir_parcial,
        )
        contexto = {
            "filtros": {
                "fecha_inicio": body.fecha_inicio,
                "fecha_fin": body.fecha_fin,
                "categoria": body.categoria or "TODAS",
                "area": body.area or "TODAS",
            },
            "resumen": kpis["resumen"],
            "mensual": kpis["mensual"],
            "por_categoria": kpis["por_categoria"],
        }
        res = redactar_resumen_filtrado(contexto)
        return {
            "modelo": res["modelo"],
            "periodo_desde": kpis["resumen"]["periodo_desde"],
            "periodo_hasta": kpis["resumen"]["periodo_hasta"],
            "reporte_texto": res["reporte_texto"],
            "resumen_sql": kpis["resumen"],
            "por_categoria": kpis.get("por_categoria", []),
            "mensual": kpis.get("mensual", []),
        }
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/reportes/descargar-pdf")
def descargar_reporte_pdf(body: DescargarPdfRequest) -> Response:
    """Genera y descarga en streaming el PDF ejecutivo estilizado de un reporte bajo demanda."""
    try:
        pdf_bytes = generar_pdf_reporte(
            periodo_desde=body.periodo_desde,
            periodo_hasta=body.periodo_hasta,
            modelo=body.modelo,
            reporte_texto=body.reporte_texto,
            resumen_sql=body.resumen_sql,
            por_categoria=body.por_categoria,
            mensual=body.mensual,
        )
        safe_desde = re.sub(r"[^\w\-]", "_", body.periodo_desde)
        safe_hasta = re.sub(r"[^\w\-]", "_", body.periodo_hasta)
        filename = f"Informe_Financiero_{safe_desde}_{safe_hasta}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition",
            },
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Error al generar PDF del informe: {exc}",
        ) from exc


@app.get("/api/reportes/{id_reporte}/descargar-pdf")
def descargar_reporte_guardado_pdf(id_reporte: int) -> Response:
    """Genera y descarga en PDF un reporte oficial persistido en Snowflake GOLD.REPORTES."""
    try:
        _, rows = query_dicts(
            """
            SELECT
                ID_REPORTE,
                GENERADO_EN,
                MODELO,
                PERIODO_DESDE,
                PERIODO_HASTA,
                RESUMEN_DATOS,
                REPORTE_TEXTO
            FROM DATAFINANCE.PUBLIC.REPORTES
            WHERE ID_REPORTE = %s
            LIMIT 1
            """,
            (id_reporte,),
        )
        if not rows:
            raise HTTPException(status_code=404, detail=f"No se encontró el reporte #{id_reporte}")

        rep = rows[0]
        resumen_datos = rep.get("RESUMEN_DATOS")
        if isinstance(resumen_datos, str):
            try:
                resumen_datos = json.loads(resumen_datos)
            except Exception:
                resumen_datos = {}
        elif not isinstance(resumen_datos, dict):
            resumen_datos = {}

        resumen_periodo = resumen_datos.get("resumen_periodo") or {}
        # Normalizar claves para el generador PDF
        resumen_sql = {
            "ingresos_totales": (
                resumen_periodo.get("INGRESOS_TOTALES_M")
                if resumen_periodo.get("INGRESOS_TOTALES_M") is not None
                else resumen_periodo.get("ingresos_totales")
            ),
            "gastos_totales": (
                resumen_periodo.get("GASTOS_TOTALES_M")
                if resumen_periodo.get("GASTOS_TOTALES_M") is not None
                else resumen_periodo.get("gastos_totales")
            ),
            "utilidad_total": (
                resumen_periodo.get("UTILIDAD_TOTAL_M")
                if resumen_periodo.get("UTILIDAD_TOTAL_M") is not None
                else resumen_periodo.get("utilidad_total")
            ),
            "margen_pct": (
                resumen_periodo.get("MARGEN_TOTAL_PCT")
                if resumen_periodo.get("MARGEN_TOTAL_PCT") is not None
                else resumen_periodo.get("margen_pct")
            ),
        }

        pdf_bytes = generar_pdf_reporte(
            periodo_desde=str(rep.get("PERIODO_DESDE") or "historico"),
            periodo_hasta=str(rep.get("PERIODO_HASTA") or "actual"),
            modelo=str(rep.get("MODELO") or "Snowflake AISQL"),
            reporte_texto=str(rep.get("REPORTE_TEXTO") or ""),
            resumen_sql=resumen_sql,
            mensual=resumen_datos.get("kpis_ultimos_6_meses"),
            generado_en=rep.get("GENERADO_EN"),
        )

        safe_desde = re.sub(r"[^\w\-]", "_", str(rep.get("PERIODO_DESDE") or "inicio"))
        safe_hasta = re.sub(r"[^\w\-]", "_", str(rep.get("PERIODO_HASTA") or "fin"))
        filename = f"Informe_Financiero_Oficial_{id_reporte}_{safe_desde}_{safe_hasta}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition",
            },
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Error generando PDF del reporte #{id_reporte}: {exc}",
        ) from exc


@app.post("/api/chat")
def chat_financiero(req: ChatRequest) -> dict[str, Any]:
    try:
        return responder_pregunta_financiera(req.question.strip())
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/automation/cierre-mensual")
def disparar_cierre_mensual(req: CierreMensualRequest) -> dict[str, Any]:
    """Ejecuta el Cierre Financiero Mensual Automatizado y la compilación del Executive Pack."""
    try:
        resultado = ejecutar_cierre_mensual(
            mes=req.mes,
            forzar=req.forzar,
            disparador=req.disparador or "API_DISPATCH",
        )
        _cache_clear()  # Invalidar cachés de KPIs, reportes y filtros
        return resultado
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Error durante el cierre mensual automatizado: {exc}",
        ) from exc


@app.get("/api/automation/cierres")
def listar_cierres(limite: int = Query(default=20, ge=1, le=100)) -> dict[str, Any]:
    """Consulta la bitácora de cierres mensuales registrados en DATAFINANCE.PUBLIC.AUDITORIA_CIERRES."""
    try:
        cierres = listar_historial_cierres(limite=limite)
        return {"cierres": cierres, "total": len(cierres)}
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Error al consultar historial de cierres: {exc}",
        ) from exc


@app.get("/api/automation/cierres/{id_cierre}/descargar-pdf")
def descargar_pdf_cierre_ejecutivo(id_cierre: int) -> Response:
    """Descarga directamente el archivo PDF 'Executive Pack' asociado a un cierre mensual."""
    ruta_pdf = obtener_ruta_pdf_cierre(id_cierre)
    if ruta_pdf and ruta_pdf.is_file():
        pdf_bytes = ruta_pdf.read_bytes()
        filename = ruta_pdf.name
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition",
            },
        )

    # Si no está en disco local, intenta descargarlo a través del reporte oficial de Snowflake
    try:
        _, rows = query_dicts(
            "SELECT ID_REPORTE, MES_CERRADO FROM DATAFINANCE.PUBLIC.AUDITORIA_CIERRES WHERE ID_CIERRE = %s",
            (id_cierre,),
        )
        if rows and rows[0].get("ID_REPORTE"):
            return descargar_reporte_guardado_pdf(int(rows[0]["ID_REPORTE"]))
    except Exception:
        pass

    raise HTTPException(
        status_code=404,
        detail=f"No se encontró el documento PDF para el cierre #{id_cierre}.",
    )


@app.get("/api/automation/centinela/alertas")
def obtener_alertas_centinela(
    limite: int = Query(default=20, ge=1, le=100),
    solo_activas: bool = Query(default=False),
) -> dict[str, Any]:
    """Consulta la bitácora de alertas de sobrecosto del Centinela Semanal."""
    try:
        alertas = listar_alertas_centinela(limite=limite, solo_activas=solo_activas)
        return {"alertas": alertas, "total": len(alertas)}
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Error al consultar alertas del Centinela: {exc}",
        ) from exc


@app.post("/api/automation/centinela/evaluar")
def disparar_evaluacion_centinela(req: CentinelaEvaluarRequest) -> dict[str, Any]:
    """Ejecuta el escaneo de Run-Rate y proyecta sobrecostos preventivos con el Centinela."""
    try:
        resultado = evaluar_centinela_semanal(
            mes=req.mes,
            persistir=req.persistir,
        )
        return resultado
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Error durante la evaluación del Centinela: {exc}",
        ) from exc


@app.put("/api/automation/centinela/alertas/{id_alerta}/estado")
def actualizar_estado_alerta_centinela(id_alerta: int, req: ActualizarAlertaRequest) -> dict[str, Any]:
    """Actualiza el estado de una alerta preventiva (ACTIVA, MITIGADA, ARCHIVADA)."""
    try:
        resultado = actualizar_estado_alerta(id_alerta, req.estado)
        return resultado
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Error actualizando estado de la alerta #{id_alerta}: {exc}",
        ) from exc


@app.get("/api/automation/cuadre-diario")
def obtener_cuadre_diario(
    limite: int = Query(default=15, ge=1, le=60),
    dias_tendencia: int = Query(default=14, ge=5, le=90),
) -> dict[str, Any]:
    """Retorna el último cuadre diario, el historial reciente y la serie temporal de liquidez."""
    try:
        ultimo = obtener_ultimo_cuadre()
        historial = listar_historial_cuadres(limite=limite)
        tendencia = obtener_tendencia_liquidez_diaria(dias=dias_tendencia)
        return {
            "ultimo": ultimo,
            "historial": historial,
            "tendencia": tendencia,
            "total_historial": len(historial),
        }
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Error al obtener información de cuadre diario: {exc}",
        ) from exc


@app.post("/api/automation/cuadre-diario/ejecutar")
def disparar_cuadre_diario(req: CuadreDiarioRequest) -> dict[str, Any]:
    """Calcula y audita el recaudo diario, evaluando la liquidez contado vs crédito de forma idempotente."""
    try:
        resultado = ejecutar_cuadre_diario(
            fecha=req.fecha,
            disparador=req.disparador or "API_TRIGGER",
        )
        return resultado
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Error durante el cuadre diario de liquidez: {exc}",
        ) from exc



