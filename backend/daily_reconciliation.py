"""Módulo de Cuadre Diario de Ventas y Monitoreo de Liquidez (DataFinance AI).

Principio rector: «SQL calcula (Ventas Contado vs Crédito y Ratios); la IA explica».
1. Agrega y valida el recaudo diario de ventas (Contado, Crédito, Servicios).
2. Calcula la relación de liquidez (Ratio Contado %) frente al umbral mínimo del 45%.
3. Clasifica la salud de tesorería: ÓPTIMA (>=45%), ADVERTENCIA (35-44%) o CRÍTICA (<35%).
4. Redacta la síntesis ejecutiva de tesorería con IA para el comité de cartera y caja.
5. Registra el cuadre en DATAFINANCE.PUBLIC.CUADRE_DIARIO_LIQUIDEZ de manera idempotente.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime
from typing import Any

from dotenv import load_dotenv

from backend.snowflake_client import execute_dml, query_dicts

logger = logging.getLogger("datafinance.daily_reconciliation")


def _formatear_pesos(monto: float | None) -> str:
    if monto is None:
        return "$0 COP"
    return f"${monto:,.0f} COP"


def _formatear_millones(monto: float | None) -> str:
    if monto is None:
        return "$0.00 M COP"
    return f"${monto / 1_000_000:,.2f} M COP"


def _generar_sintesis_fallback(
    cuadre: dict[str, Any], top_ventas: list[dict[str, Any]]
) -> str:
    """Genera una síntesis ejecutiva de tesorería determinista si Groq no está disponible."""
    fecha = cuadre.get("FECHA", "N/A")
    total = _formatear_millones(cuadre.get("TOTAL_VENTAS"))
    contado = _formatear_millones(cuadre.get("VENTAS_CONTADO"))
    credito = _formatear_millones(cuadre.get("VENTAS_CREDITO"))
    ratio_c = cuadre.get("RATIO_CONTADO_PCT", 0.0)
    ratio_cr = cuadre.get("RATIO_CREDITO_PCT", 0.0)
    estado = cuadre.get("ESTADO_LIQUIDEZ", "OPTIMA")
    tx_count = cuadre.get("TOTAL_TRANSACCIONES", 0)

    if estado == "OPTIMA":
        return (
            f"✅ LIQUIDEZ ÓPTIMA ({fecha}): Recaudo diario cerrado en {total} a través de {tx_count} transacciones. "
            f"El recaudo en efectivo y transferencias de contado alcanzó {contado} ({ratio_c:.1f}% de la venta), "
            f"superando holgadamente la meta prudencial del 45%. Ventas a crédito se ubicaron en {credito} ({ratio_cr:.1f}%). "
            f"El flujo de caja disponible garantiza el cumplimiento de compromisos inmediatos con proveedores y nómina operativa."
        )
    elif estado == "ADVERTENCIA":
        return (
            f"⚠️ ADVERTENCIA DE LIQUIDEZ ({fecha}): Venta diaria cerrada en {total} ({tx_count} transacciones). "
            f"El recaudo de contado descendió al {ratio_c:.1f}% ({contado}), situándose por debajo del umbral óptimo del 45%. "
            f"La colocación a crédito aumentó a {credito} ({ratio_cr:.1f}%). "
            f"Acción recomendada: Priorizar cobro de cartera a tiendas aliadas y limitar cupos extraordinarios de crédito "
            f"para evitar desfase en el pago de facturas a fabricantes."
        )
    else:
        return (
            f"🚨 RIESGO CRÍTICO DE ILIQUIDEZ ({fecha}): Cierre de ruta en {total} con severo desbalance de cartera. "
            f"El recaudo de contado representó apenas el {ratio_c:.1f}% ({contado}), mientras el crédito absorbió el {ratio_cr:.1f}% ({credito}). "
            f"Nivel de liquidez crítico (<35%). "
            f"Acción urgente: Suspender despachos a clientes con cartera vencida >30 días y exigir anticipos "
            f"en pedidos mayoristas del día siguiente para preservar el capital de trabajo de Distribuidora del Caribe S.A.S."
        )


def _redactar_sintesis_con_ia(
    cuadre: dict[str, Any], top_ventas: list[dict[str, Any]]
) -> str:
    """Invoca Groq (openai/gpt-oss-120b) para redactar el briefing ejecutivo de tesorería."""
    load_dotenv(override=True)
    api_key = (os.getenv("GROQ_API_KEY") or "").strip()
    if not api_key or api_key == "TU_GROQ_API_KEY":
        return _generar_sintesis_fallback(cuadre, top_ventas)

    try:
        from groq import Groq

        client = Groq(api_key=api_key)
        model = (os.getenv("GROQ_MODEL") or "openai/gpt-oss-120b").strip()

        fecha = cuadre.get("FECHA")
        total = _formatear_millones(cuadre.get("TOTAL_VENTAS"))
        contado = _formatear_millones(cuadre.get("VENTAS_CONTADO"))
        credito = _formatear_millones(cuadre.get("VENTAS_CREDITO"))
        servicios = _formatear_millones(cuadre.get("SERVICIOS"))
        ratio_c = cuadre.get("RATIO_CONTADO_PCT", 0.0)
        ratio_cr = cuadre.get("RATIO_CREDITO_PCT", 0.0)
        estado = cuadre.get("ESTADO_LIQUIDEZ", "OPTIMA")
        tx_count = cuadre.get("TOTAL_TRANSACCIONES", 0)

        tx_resumen = [
            f"- {tx.get('DESCRIPCION')}: {_formatear_pesos(tx.get('MONTO'))} ({tx.get('CATEGORIA')})"
            for tx in top_ventas[:4]
        ]
        tx_texto = "\n".join(tx_resumen) if tx_resumen else "Sin detalle de transacciones"

        system_prompt = (
            "Eres el Director de Tesorería y Riesgo de Cartera de 'Distribuidora del Caribe S.A.S.' en Barranquilla. "
            "Tu labor es emitir el informe ejecutivo del Cuadre Diario de Ventas y Liquidez al cierre de ruta. "
            "Reglas inquebrantables:\n"
            "1. Cita las cifras exactas provistas en COP (Total, Contado, Crédito, Ratios %).\n"
            "2. Jamás inventes transacciones ni recalcules los montos.\n"
            "3. Si el estado es 'OPTIMA' (Contado >= 45%), resalta la solidez de caja para pago a proveedores masivos.\n"
            "4. Si el estado es 'ADVERTENCIA' o 'CRITICA', alerta con firmeza sobre el sobreendeudamiento comercial de tiendas y el riesgo de liquidez operativa.\n"
            "5. Redacta en español formal y ejecutivo, en un párrafo contundente (máximo 120 palabras)."
        )

        user_prompt = f"""Cuadre de Ventas del día {fecha}:
- Ventas Totales: {total} ({tx_count} transacciones)
- Venta Contado (Efectivo/Transferencia): {contado} ({ratio_c:.2f}%)
- Venta a Crédito: {credito} ({ratio_cr:.2f}%)
- Servicios: {servicios}
- Estado de Liquidez: {estado} (Meta prudencial de contado: >= 45.0%)

Mayores movimientos comerciales del día:
{tx_texto}

Genera el dictamen de tesorería para el equipo directivo."""

        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
            max_tokens=500,
        )
        content = (response.choices[0].message.content or "").strip()
        return content if content else _generar_sintesis_fallback(cuadre, top_ventas)
    except Exception as exc:
        logger.warning(
            "Fallo llamada a Groq para síntesis de tesorería (%s). Usando fallback.", exc
        )
        return _generar_sintesis_fallback(cuadre, top_ventas)


def ejecutar_cuadre_diario(
    fecha: str | None = None, disparador: str = "AUTOMATION_DAILY"
) -> dict[str, Any]:
    """Calcula y audita el recaudo diario, evaluando la liquidez contado vs crédito de forma idempotente."""
    # 1. Determinar fecha objetivo
    if not fecha:
        _, filas_fecha = query_dicts(
            "SELECT MAX(FECHA) AS ULTIMA_FECHA FROM DATAFINANCE.PUBLIC.TRANSACCIONES WHERE TIPO = 'INGRESO'"
        )
        if not filas_fecha or not filas_fecha[0].get("ULTIMA_FECHA"):
            raise ValueError("No se encontraron transacciones de ingresos registradas en Snowflake.")
        fecha = str(filas_fecha[0]["ULTIMA_FECHA"])

    # 2. Consultar métricas del día desde la vista analítica
    sql_vista = """
        SELECT
            FECHA,
            TOTAL_VENTAS,
            VENTAS_CONTADO,
            VENTAS_CREDITO,
            SERVICIOS,
            TOTAL_TRANSACCIONES,
            RATIO_CONTADO_PCT,
            RATIO_CREDITO_PCT,
            RATIO_SERVICIOS_PCT,
            ESTADO_LIQUIDEZ
        FROM DATAFINANCE.PUBLIC.V_CUADRE_DIARIO_CONSOLIDADO
        WHERE FECHA = %s
    """
    _, filas_cuadre = query_dicts(sql_vista, [fecha])
    if not filas_cuadre:
        raise ValueError(f"No existen transacciones de ingresos para la fecha solicitada: {fecha}")

    cuadre_base = filas_cuadre[0]

    # 3. Consultar transacciones comerciales destacadas del día
    sql_tx = """
        SELECT
            ID_TRANSACCION,
            CATEGORIA,
            MONTO,
            DESCRIPCION,
            AREA
        FROM DATAFINANCE.PUBLIC.TRANSACCIONES
        WHERE FECHA = %s AND TIPO = 'INGRESO'
        ORDER BY MONTO DESC
        LIMIT 5
    """
    _, top_ventas = query_dicts(sql_tx, [fecha])

    # 4. Redactar síntesis de tesorería con IA
    sintesis = _redactar_sintesis_con_ia(cuadre_base, top_ventas)
    registrado_en = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # 5. Idempotencia: limpiar registro previo para esa fecha e insertar nuevo
    execute_dml(
        "DELETE FROM DATAFINANCE.PUBLIC.CUADRE_DIARIO_LIQUIDEZ WHERE FECHA = %s",
        [fecha],
    )

    sql_insert = """
        INSERT INTO DATAFINANCE.PUBLIC.CUADRE_DIARIO_LIQUIDEZ (
            FECHA,
            TOTAL_VENTAS,
            VENTAS_CONTADO,
            VENTAS_CREDITO,
            SERVICIOS,
            RATIO_CONTADO_PCT,
            RATIO_CREDITO_PCT,
            ESTADO_LIQUIDEZ,
            TOTAL_TRANSACCIONES,
            SINTESIS_TESORERIA,
            REGISTRADO_EN,
            EJECUTADO_POR
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    params = [
        fecha,
        cuadre_base["TOTAL_VENTAS"],
        cuadre_base["VENTAS_CONTADO"],
        cuadre_base["VENTAS_CREDITO"],
        cuadre_base["SERVICIOS"],
        cuadre_base["RATIO_CONTADO_PCT"],
        cuadre_base["RATIO_CREDITO_PCT"],
        cuadre_base["ESTADO_LIQUIDEZ"],
        cuadre_base["TOTAL_TRANSACCIONES"],
        sintesis,
        registrado_en,
        disparador,
    ]
    execute_dml(sql_insert, params)

    # 6. Obtener el ID asignado
    _, fila_id = query_dicts(
        "SELECT ID_CUADRE FROM DATAFINANCE.PUBLIC.CUADRE_DIARIO_LIQUIDEZ WHERE FECHA = %s ORDER BY ID_CUADRE DESC LIMIT 1",
        [fecha],
    )
    id_cuadre = fila_id[0]["ID_CUADRE"] if fila_id else None

    resultado = {
        "id_cuadre": id_cuadre,
        "fecha": str(cuadre_base["FECHA"]),
        "total_ventas": float(cuadre_base["TOTAL_VENTAS"]),
        "ventas_contado": float(cuadre_base["VENTAS_CONTADO"]),
        "ventas_credito": float(cuadre_base["VENTAS_CREDITO"]),
        "servicios": float(cuadre_base["SERVICIOS"]),
        "ratio_contado_pct": float(cuadre_base["RATIO_CONTADO_PCT"]),
        "ratio_credito_pct": float(cuadre_base["RATIO_CREDITO_PCT"]),
        "estado_liquidez": str(cuadre_base["ESTADO_LIQUIDEZ"]),
        "total_transacciones": int(cuadre_base["TOTAL_TRANSACCIONES"]),
        "sintesis_tesoreria": sintesis,
        "top_ventas": top_ventas,
        "registrado_en": registrado_en,
        "ejecutado_por": disparador,
    }
    return resultado


def listar_historial_cuadres(limite: int = 15) -> list[dict[str, Any]]:
    """Devuelve los cuadres diarios registrados en orden cronológico descendente."""
    sql = """
        SELECT
            ID_CUADRE,
            FECHA,
            TOTAL_VENTAS,
            VENTAS_CONTADO,
            VENTAS_CREDITO,
            SERVICIOS,
            RATIO_CONTADO_PCT,
            RATIO_CREDITO_PCT,
            ESTADO_LIQUIDEZ,
            TOTAL_TRANSACCIONES,
            SINTESIS_TESORERIA,
            REGISTRADO_EN,
            EJECUTADO_POR
        FROM DATAFINANCE.PUBLIC.CUADRE_DIARIO_LIQUIDEZ
        ORDER BY FECHA DESC
        LIMIT %s
    """
    _, filas = query_dicts(sql, [limite])
    return filas


def obtener_ultimo_cuadre() -> dict[str, Any] | None:
    """Retorna el último cuadre registrado. Si no hay ninguno, ejecuta automáticamente el más reciente."""
    historial = listar_historial_cuadres(limite=1)
    if historial:
        cuadre = historial[0]
        # Consultar top ventas para enriquecerlo
        fecha = str(cuadre["FECHA"])
        _, top_ventas = query_dicts(
            """
            SELECT ID_TRANSACCION, CATEGORIA, MONTO, DESCRIPCION, AREA
            FROM DATAFINANCE.PUBLIC.TRANSACCIONES
            WHERE FECHA = %s AND TIPO = 'INGRESO'
            ORDER BY MONTO DESC
            LIMIT 5
            """,
            [fecha],
        )
        cuadre["top_ventas"] = top_ventas
        return cuadre

    # Si está vacío, ejecutamos el cuadre del último día disponible
    try:
        return ejecutar_cuadre_diario(disparador="AUTOMATIC_INIT")
    except Exception as exc:
        logger.error("No se pudo auto-inicializar el último cuadre diario: %s", exc)
        return None


def obtener_tendencia_liquidez_diaria(dias: int = 14) -> list[dict[str, Any]]:
    """Consulta la tendencia reciente de ventas y ratios desde la vista analítica."""
    sql = """
        SELECT
            FECHA,
            TOTAL_VENTAS,
            VENTAS_CONTADO,
            VENTAS_CREDITO,
            SERVICIOS,
            TOTAL_TRANSACCIONES,
            RATIO_CONTADO_PCT,
            RATIO_CREDITO_PCT,
            ESTADO_LIQUIDEZ
        FROM DATAFINANCE.PUBLIC.V_CUADRE_DIARIO_CONSOLIDADO
        ORDER BY FECHA DESC
        LIMIT %s
    """
    _, filas = query_dicts(sql, [dias])
    # Ordenar cronológicamente para gráficas
    filas.reverse()
    return filas
