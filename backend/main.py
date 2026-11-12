"""API FastAPI para DataFinance AI."""

from __future__ import annotations

import os
from typing import Any

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.groq_analyst import redactar_resumen_filtrado, responder_pregunta_financiera
from backend.snowflake_client import query_dicts

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
            "MES IN (SELECT MES FROM DATAFINANCE.SILVER.TRANSACCIONES GROUP BY MES HAVING DAY(MAX(FECHA)) >= 28)"
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
            "(SELECT MAX(ACTUALIZADO_EN) FROM DATAFINANCE.GOLD.KPI_MENSUAL) AS ULTIMA_ACTUALIZACION"
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


@app.get("/api/kpis")
def obtener_kpis(
    fecha_inicio: str | None = Query(default=None),
    fecha_fin: str | None = Query(default=None),
    categoria: str | None = Query(default=None),
    area: str | None = Query(default=None),
    incluir_parcial: bool = Query(default=False),
) -> dict[str, Any]:
    try:
        _, opts_meses = query_dicts(
            "SELECT ANIO_MES, "
            "EXISTS (SELECT 1 FROM DATAFINANCE.SILVER.TRANSACCIONES s WHERE s.MES = k.MES HAVING DAY(MAX(s.FECHA)) >= 28) AS ES_COMPLETO "
            "FROM DATAFINANCE.GOLD.KPI_MENSUAL k ORDER BY MES"
        )
        _, opts_cats = query_dicts(
            "SELECT DISTINCT CATEGORIA, TIPO FROM DATAFINANCE.GOLD.KPI_CATEGORIA_MENSUAL ORDER BY TIPO, CATEGORIA"
        )
        _, opts_areas = query_dicts(
            "SELECT DISTINCT AREA FROM DATAFINANCE.GOLD.KPI_AREA_MENSUAL ORDER BY AREA"
        )

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
                    "k.MES IN (SELECT MES FROM DATAFINANCE.SILVER.TRANSACCIONES GROUP BY MES HAVING DAY(MAX(FECHA)) >= 28)"
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
                FROM DATAFINANCE.GOLD.KPI_MENSUAL k
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
                FROM DATAFINANCE.GOLD.KPI_CATEGORIA_MENSUAL k
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
                FROM DATAFINANCE.GOLD.KPI_AREA_MENSUAL k
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
                    FROM DATAFINANCE.SILVER.TRANSACCIONES
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
                FROM DATAFINANCE.SILVER.TRANSACCIONES
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
                FROM DATAFINANCE.SILVER.TRANSACCIONES
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

        return {
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
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/anomalias")
def obtener_anomalias() -> dict[str, Any]:
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
            FROM DATAFINANCE.GOLD.ANOMALIAS
            ORDER BY MES DESC, ABS(Z_SCORE) DESC
            """
        )
        return {"anomalias": rows, "total": len(rows)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/auditoria")
def obtener_auditoria() -> dict[str, Any]:
    try:
        _, conteos = query_dicts(
            """
            SELECT
                (SELECT COUNT(*) FROM DATAFINANCE.BRONZE.TRANSACCIONES) AS BRONZE,
                (SELECT COUNT(*) FROM DATAFINANCE.SILVER.TRANSACCIONES) AS SILVER,
                (SELECT COUNT(*) FROM DATAFINANCE.SILVER.TRANSACCIONES_RECHAZADOS) AS RECHAZADOS
            """
        )
        _, motivos = query_dicts(
            """
            SELECT MOTIVO_RECHAZO, COUNT(*) AS CANTIDAD
            FROM DATAFINANCE.SILVER.TRANSACCIONES_RECHAZADOS
            GROUP BY MOTIVO_RECHAZO
            ORDER BY CANTIDAD DESC
            """
        )
        return {
            "conteos": conteos[0] if conteos else {},
            "motivos_rechazo": motivos,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/reportes")
def obtener_reportes() -> dict[str, Any]:
    try:
        _, rows = query_dicts(
            """
            SELECT
                ID_REPORTE,
                GENERADO_EN,
                MODELO,
                PERIODO_DESDE,
                PERIODO_HASTA,
                REPORTE_TEXTO
            FROM DATAFINANCE.GOLD.REPORTES
            ORDER BY ID_REPORTE DESC
            LIMIT 20
            """
        )
        return {"reportes": rows}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/reportes/generar-airflow")
async def disparar_reporte_airflow() -> dict[str, Any]:
    """Dispara el DAG manual datafinance_reporte (AI_AGG en Snowflake) vía API REST de Airflow."""
    api_url = os.getenv("AIRFLOW_API_URL", "http://localhost:8082/api/v1").rstrip("/")
    user = os.getenv("AIRFLOW_API_USER", "airflow")
    password = os.getenv("AIRFLOW_API_PASSWORD", "airflow")

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{api_url}/dags/datafinance_reporte/dagRuns",
                auth=(user, password),
                json={"conf": {}},
            )
        if resp.status_code >= 400:
            raise HTTPException(
                status_code=502,
                detail=f"Airflow respondió {resp.status_code}: {resp.text}",
            )
        data = resp.json()
        return {
            "dag_run_id": data.get("dag_run_id"),
            "state": data.get("state"),
            "mensaje": "DAG datafinance_reporte disparado en Airflow (AI_AGG en Snowflake). Espera unos segundos y recarga la lista.",
        }
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"No se pudo conectar a Airflow en {api_url}: {exc}",
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
        }
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/chat")
def chat_financiero(req: ChatRequest) -> dict[str, Any]:
    try:
        return responder_pregunta_financiera(req.question.strip())
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
