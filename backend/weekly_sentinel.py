"""Módulo Centinela Semanal de Sobrecostos Operativos (DataFinance AI).

Principio rector: «SQL calcula (Run-rate y Proyección); la IA explica».
1. Evalúa el ritmo de gasto acumulado (burn rate) por categoría frente a promedios históricos.
2. Identifica proyecciones de sobrecosto atípicas antes del cierre de mes.
3. Aísla las transacciones individuales que originaron el desvío.
4. Redacta un diagnóstico preventivo de contingencia operativa con IA.
5. Registra las alertas en DATAFINANCE.PUBLIC.ALERTAS_CENTINELA.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime
from typing import Any

from dotenv import load_dotenv

from backend.snowflake_client import execute_dml, query_dicts

logger = logging.getLogger("datafinance.weekly_sentinel")


def _formatear_millones(monto: float | None) -> str:
    if monto is None:
        return "$0.00 M COP"
    return f"${monto / 1_000_000:,.2f} M COP"


def _generar_diagnostico_fallback(alerta: dict[str, Any], transacciones: list[dict[str, Any]]) -> str:
    """Genera diagnóstico preventivo determinista si Groq no está disponible."""
    cat = alerta.get("CATEGORIA", "N/A")
    area = alerta.get("AREA", "N/A")
    riesgo = alerta.get("NIVEL_RIESGO", "ALTO")
    desvio = alerta.get("DESVIO_PROYECTADO_PCT", 0.0)
    consumido = alerta.get("PORCENTAJE_CONSUMIDO", 0.0)
    dias = alerta.get("DIAS_TRANSCURRIDOS", 0)
    gasto = _formatear_millones(alerta.get("GASTO_ACUMULADO"))
    prom = _formatear_millones(alerta.get("PROMEDIO_HISTORICO_MENSUAL"))
    proy = _formatear_millones(alerta.get("PROYECCION_FIN_MES"))

    tx_desc = []
    for tx in transacciones[:3]:
        monto_str = _formatear_millones(tx.get("MONTO"))
        tx_desc.append(f"'{tx.get('DESCRIPCION')}' ({monto_str}, fecha {tx.get('FECHA')})")

    tx_texto = "; ".join(tx_desc) if tx_desc else "movimientos operativos acumulados"

    return (
        f"⚠️ ALERTA TEMPRANA [{riesgo}] en {cat} (Área {area}):\n"
        f"Al día {dias} del mes se ha consumido el {consumido:.1f}% del promedio histórico ({gasto} vs {prom} esperado). "
        f"A este ritmo, la proyección de fin de mes se ubica en {proy} (+{desvio:.1f}% de sobrecosto).\n"
        f"Causas principales identificadas en Snowflake: {tx_texto}.\n"
        f"Acción preventiva recomendada: Congelar gastos extraordinarios no esenciales en {area} "
        f"y auditar las órdenes de compra para evitar erosión del margen neto del mes."
    )


def _redactar_diagnostico_ia(alerta: dict[str, Any], transacciones: list[dict[str, Any]]) -> str:
    """Utiliza Groq gpt-oss-120b para redactar una alerta operativa contextualizada."""
    load_dotenv(override=True)
    groq_key = (os.getenv("GROQ_API_KEY") or "").strip()
    groq_model = (os.getenv("GROQ_MODEL") or "openai/gpt-oss-120b").strip()

    if not groq_key or groq_key == "TU_GROQ_API_KEY":
        return _generar_diagnostico_fallback(alerta, transacciones)

    try:
        from groq import Groq

        client = Groq(api_key=groq_key)
        system_prompt = (
            "Eres el Auditor de Control de Gestión y Centinela Operativo de Distribuidora del Caribe S.A.S. (moneda COP).\n"
            "Tu labor es emitir una ALERTA TEMPRANA PREVENTIVA para el Gerente de Operaciones y Director Financiero.\n"
            "Reglas:\n"
            "1. Explica el desvío proyectado con los números exactos calculados en Snowflake.\n"
            "2. Cita expresamente las transacciones y conceptos que dispararon el sobrecosto.\n"
            "3. Concluye con 2 medidas de contingencia inmediatas para mitigar el impacto antes de fin de mes.\n"
            "4. Sé directo, riguroso, urgente y conciso (máximo 150 palabras)."
        )

        payload = {
            "alerta": alerta,
            "transacciones_mas_costosas": transacciones[:5],
        }

        resp = client.chat.completions.create(
            model=groq_model,
            temperature=0.1,
            max_tokens=400,
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": f"Datos de alerta detectados por SQL:\n{json.dumps(payload, ensure_ascii=False)}",
                },
            ],
        )
        texto = (resp.choices[0].message.content or "").strip()
        if texto:
            return texto
    except Exception as exc:
        logger.warning("Fallo en llamada a Groq Centinela (%s). Usando fallback.", exc)

    return _generar_diagnostico_fallback(alerta, transacciones)


def evaluar_centinela_semanal(
    mes: str | None = None,
    persistir: bool = True,
) -> dict[str, Any]:
    """Evalúa el ritmo de gasto semanal y proyecta sobrecostos antes del cierre del mes."""
    # 1. Determinar periodo a evaluar
    if not mes:
        _, mes_rows = query_dicts(
            "SELECT ANIO_MES FROM DATAFINANCE.PUBLIC.TRANSACCIONES ORDER BY MES DESC LIMIT 1"
        )
        if not mes_rows:
            raise RuntimeError("No hay transacciones en Snowflake para evaluar con el Centinela.")
        mes = str(mes_rows[0]["ANIO_MES"])

    # 2. Query de Run-rate y proyección para el periodo indicado
    sql_evaluacion = """
    WITH meses_completos AS (
        SELECT MES
        FROM DATAFINANCE.PUBLIC.TRANSACCIONES
        GROUP BY MES
        HAVING DAY(MAX(FECHA)) >= 28
    ),
    promedios_historicos AS (
        SELECT
            k.TIPO,
            k.CATEGORIA,
            ROUND(AVG(k.MONTO_TOTAL), 2) AS PROMEDIO_HISTORICO
        FROM DATAFINANCE.PUBLIC.KPI_CATEGORIA_MENSUAL k
        INNER JOIN meses_completos mc ON k.MES = mc.MES
        WHERE k.TIPO = 'GASTO'
        GROUP BY k.TIPO, k.CATEGORIA
    ),
    periodo_evaluado AS (
        SELECT
            ANIO_MES,
            MES,
            MAX(FECHA) AS FECHA_CORTE,
            DAY(MAX(FECHA)) AS DIAS_TRANSCURRIDOS,
            DAY(LAST_DAY(MAX(FECHA))) AS DIAS_TOTALES_MES
        FROM DATAFINANCE.PUBLIC.TRANSACCIONES
        WHERE ANIO_MES = %s
        GROUP BY ANIO_MES, MES
    ),
    gasto_acumulado AS (
        SELECT
            t.ANIO_MES,
            t.CATEGORIA,
            t.AREA,
            ROUND(SUM(t.MONTO), 2) AS GASTO_ACUMULADO,
            COUNT(*) AS TOTAL_TRANSACCIONES
        FROM DATAFINANCE.PUBLIC.TRANSACCIONES t
        WHERE t.ANIO_MES = %s AND t.TIPO = 'GASTO'
        GROUP BY t.ANIO_MES, t.CATEGORIA, t.AREA
    )
    SELECT
        g.ANIO_MES AS PERIODO,
        pe.FECHA_CORTE,
        pe.DIAS_TRANSCURRIDOS,
        pe.DIAS_TOTALES_MES,
        g.CATEGORIA,
        g.AREA,
        g.GASTO_ACUMULADO,
        g.TOTAL_TRANSACCIONES,
        p.PROMEDIO_HISTORICO,
        ROUND((g.GASTO_ACUMULADO / NULLIF(p.PROMEDIO_HISTORICO, 0)) * 100, 2) AS PORCENTAJE_CONSUMIDO,
        ROUND((g.GASTO_ACUMULADO / NULLIF(pe.DIAS_TRANSCURRIDOS, 0)) * pe.DIAS_TOTALES_MES, 2) AS PROYECCION_FIN_MES,
        ROUND(
            (
                ((g.GASTO_ACUMULADO / NULLIF(pe.DIAS_TRANSCURRIDOS, 0)) * pe.DIAS_TOTALES_MES - p.PROMEDIO_HISTORICO)
                / NULLIF(p.PROMEDIO_HISTORICO, 0)
            ) * 100,
            2
        ) AS DESVIO_PROYECTADO_PCT,
        CASE
            WHEN ((g.GASTO_ACUMULADO / NULLIF(pe.DIAS_TRANSCURRIDOS, 0)) * pe.DIAS_TOTALES_MES) >= (p.PROMEDIO_HISTORICO * 1.5)
                 OR (pe.DIAS_TRANSCURRIDOS <= 15 AND (g.GASTO_ACUMULADO / NULLIF(p.PROMEDIO_HISTORICO, 0)) >= 0.70)
                 THEN 'CRITICO'
            WHEN ((g.GASTO_ACUMULADO / NULLIF(pe.DIAS_TRANSCURRIDOS, 0)) * pe.DIAS_TOTALES_MES) >= (p.PROMEDIO_HISTORICO * 1.25)
                 OR (pe.DIAS_TRANSCURRIDOS <= 15 AND (g.GASTO_ACUMULADO / NULLIF(p.PROMEDIO_HISTORICO, 0)) >= 0.55)
                 THEN 'ALTO'
            WHEN ((g.GASTO_ACUMULADO / NULLIF(pe.DIAS_TRANSCURRIDOS, 0)) * pe.DIAS_TOTALES_MES) >= (p.PROMEDIO_HISTORICO * 1.15)
                 THEN 'MODERADO'
            ELSE 'NORMAL'
        END AS NIVEL_RIESGO
    FROM gasto_acumulado g
    CROSS JOIN periodo_evaluado pe
    LEFT JOIN promedios_historicos p ON g.CATEGORIA = p.CATEGORIA
    ORDER BY DESVIO_PROYECTADO_PCT DESC
    """

    _, filas = query_dicts(sql_evaluacion, (mes, mes))

    alertas_detectadas = []
    for f in filas:
        nivel = f.get("NIVEL_RIESGO")
        if nivel in ("CRITICO", "ALTO", "MODERADO"):
            cat = f.get("CATEGORIA")
            # 3. Buscar transacciones críticas causantes del desvío
            _, tx_rows = query_dicts(
                """
                SELECT ID_TRANSACCION, FECHA, AREA, MONTO, DESCRIPCION
                FROM DATAFINANCE.PUBLIC.TRANSACCIONES
                WHERE ANIO_MES = %s AND CATEGORIA = %s AND TIPO = 'GASTO'
                ORDER BY MONTO DESC
                LIMIT 5
                """,
                (mes, cat),
            )

            # 4. Redacción diagnóstica
            diagnostico = _redactar_diagnostico_ia(f, tx_rows)

            alerta_item = {
                **f,
                "DIAGNOSTICO_IA": diagnostico,
                "TRANSACCIONES_CRITICAS": tx_rows,
                "ESTADO": "ACTIVA",
            }

            # 5. Persistir en Snowflake si se solicita
            if persistir:
                execute_dml(
                    """
                    INSERT INTO DATAFINANCE.PUBLIC.ALERTAS_CENTINELA (
                        FECHA_EVALUACION,
                        PERIODO,
                        FECHA_CORTE,
                        DIAS_TRANSCURRIDOS,
                        DIAS_TOTALES_MES,
                        CATEGORIA,
                        AREA,
                        GASTO_ACUMULADO,
                        PROMEDIO_HISTORICO_MENSUAL,
                        PORCENTAJE_CONSUMIDO,
                        PROYECCION_FIN_MES,
                        DESVIO_PROYECTADO_PCT,
                        NIVEL_RIESGO,
                        DIAGNOSTICO_IA,
                        TRANSACCIONES_CRITICAS,
                        ESTADO
                    )
                    SELECT
                        CURRENT_TIMESTAMP()::TIMESTAMP_NTZ,
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        PARSE_JSON(%s), 'ACTIVA'
                    """,
                    (
                        f["PERIODO"],
                        f["FECHA_CORTE"],
                        f["DIAS_TRANSCURRIDOS"],
                        f["DIAS_TOTALES_MES"],
                        f["CATEGORIA"],
                        f["AREA"],
                        f["GASTO_ACUMULADO"],
                        f["PROMEDIO_HISTORICO"] or 0,
                        f["PORCENTAJE_CONSUMIDO"] or 0,
                        f["PROYECCION_FIN_MES"] or 0,
                        f["DESVIO_PROYECTADO_PCT"] or 0,
                        nivel,
                        diagnostico,
                        json.dumps(tx_rows, ensure_ascii=False),
                    ),
                )

            alertas_detectadas.append(alerta_item)

    return {
        "periodo": mes,
        "evaluado_en": datetime.now().isoformat(),
        "total_categorias_evaluadas": len(filas),
        "total_alertas": len(alertas_detectadas),
        "alertas": alertas_detectadas,
        "resumen_categorias": filas,
    }


def listar_alertas_centinela(limite: int = 20, solo_activas: bool = False) -> list[dict[str, Any]]:
    """Devuelve las alertas registradas en DATAFINANCE.PUBLIC.ALERTAS_CENTINELA."""
    clausula = "WHERE ESTADO = 'ACTIVA'" if solo_activas else ""
    sql = f"""
    SELECT
        ID_ALERTA,
        FECHA_EVALUACION,
        PERIODO,
        FECHA_CORTE,
        DIAS_TRANSCURRIDOS,
        DIAS_TOTALES_MES,
        CATEGORIA,
        AREA,
        GASTO_ACUMULADO,
        PROMEDIO_HISTORICO_MENSUAL,
        PORCENTAJE_CONSUMIDO,
        PROYECCION_FIN_MES,
        DESVIO_PROYECTADO_PCT,
        NIVEL_RIESGO,
        DIAGNOSTICO_IA,
        TRANSACCIONES_CRITICAS,
        ESTADO
    FROM DATAFINANCE.PUBLIC.ALERTAS_CENTINELA
    {clausula}
    ORDER BY ID_ALERTA DESC
    LIMIT %s
    """
    _, rows = query_dicts(sql, (limite,))
    for r in rows:
        tc = r.get("TRANSACCIONES_CRITICAS")
        if isinstance(tc, str):
            try:
                r["TRANSACCIONES_CRITICAS"] = json.loads(tc)
            except Exception:
                r["TRANSACCIONES_CRITICAS"] = []
    return rows


def actualizar_estado_alerta(id_alerta: int, nuevo_estado: str) -> dict[str, Any]:
    """Actualiza el estado de una alerta ('ACTIVA', 'MITIGADA', 'ARCHIVADA')."""
    estado_normalizado = nuevo_estado.strip().upper()
    if estado_normalizado not in ("ACTIVA", "MITIGADA", "ARCHIVADA"):
        raise ValueError(f"Estado '{nuevo_estado}' no válido. Use: ACTIVA, MITIGADA o ARCHIVADA.")

    rowcount = execute_dml(
        "UPDATE DATAFINANCE.PUBLIC.ALERTAS_CENTINELA SET ESTADO = %s WHERE ID_ALERTA = %s",
        (estado_normalizado, id_alerta),
    )
    if rowcount == 0:
        raise ValueError(f"No se encontró la alerta #{id_alerta}.")

    return {
        "id_alerta": id_alerta,
        "estado": estado_normalizado,
        "mensaje": f"Alerta #{id_alerta} actualizada a {estado_normalizado}.",
    }
