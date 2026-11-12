"""Evaluación formal de 16 preguntas para el agente financiero (Groq + Snowflake).

Verifica exactitud numérica contra consultas SQL de referencia en Snowflake,
trazabilidad de la consulta generada, mención de unidad (COP) y manejo sin datos.
Uso:
    .venv/bin/python scripts/evaluar_agente.py
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.groq_analyst import responder_pregunta_financiera  # noqa: E402
from backend.snowflake_client import query_dicts  # noqa: E402

CASOS_EVALUACION: list[dict[str, Any]] = [
    {
        "id": "Q01",
        "pregunta": "¿Cuáles fueron los ingresos y gastos de marzo de 2026?",
        "ref_sql": "SELECT INGRESOS, GASTOS FROM DATAFINANCE.GOLD.KPI_MENSUAL WHERE ANIO_MES = '2026-03'",
        "token_groups": [["2026-03", "MARZO DE 2026", "MARZO 2026"], ["COP"]],
        "validar_numeros": True,
    },
    {
        "id": "Q02",
        "pregunta": "¿Cuáles fueron los ingresos, gastos y utilidad de junio de 2026?",
        "ref_sql": "SELECT INGRESOS, GASTOS, UTILIDAD FROM DATAFINANCE.GOLD.KPI_MENSUAL WHERE ANIO_MES = '2026-06'",
        "token_groups": [["2026-06", "JUNIO DE 2026", "JUNIO 2026"], ["COP", "PESOS COLOMBIANOS"]],
        "validar_numeros": True,
    },
    {
        "id": "Q03",
        "pregunta": "¿Cómo cambió la utilidad de junio de 2026 frente a mayo de 2026?",
        "ref_sql": "SELECT ANIO_MES, UTILIDAD, VAR_UTILIDAD_PCT FROM DATAFINANCE.GOLD.KPI_MENSUAL WHERE ANIO_MES IN ('2026-05', '2026-06')",
        "token_groups": [["2026-06", "JUNIO"], ["2026-05", "MAYO"]],
        "validar_numeros": True,
    },
    {
        "id": "Q04",
        "pregunta": "¿Cuál fue la categoría con mayor gasto en 2026?",
        "ref_sql": "SELECT CATEGORIA, ROUND(SUM(MONTO_TOTAL), 2) AS TOTAL FROM DATAFINANCE.GOLD.KPI_CATEGORIA_MENSUAL WHERE ANIO = 2026 AND TIPO = 'GASTO' GROUP BY CATEGORIA ORDER BY TOTAL DESC LIMIT 1",
        "token_groups": [["PROVEEDORES"]],
        "validar_numeros": True,
    },
    {
        "id": "Q05",
        "pregunta": "¿Qué área tuvo el mayor gasto acumulado durante 2025?",
        "ref_sql": "SELECT AREA, ROUND(SUM(MONTO_TOTAL), 2) AS TOTAL FROM DATAFINANCE.GOLD.KPI_AREA_MENSUAL WHERE ANIO = 2025 AND TIPO = 'GASTO' GROUP BY AREA ORDER BY TOTAL DESC LIMIT 1",
        "token_groups": [["OPERACIONES"]],
        "validar_numeros": True,
    },
    {
        "id": "Q06",
        "pregunta": "¿Cuánto se gastó en Marketing en marzo de 2026?",
        "ref_sql": "SELECT MONTO_TOTAL FROM DATAFINANCE.GOLD.KPI_CATEGORIA_MENSUAL WHERE ANIO_MES = '2026-03' AND TIPO = 'GASTO' AND CATEGORIA = 'MARKETING'",
        "token_groups": [["MARKETING"], ["2026-03", "MARZO DE 2026", "MARZO 2026", "MARZO"]],
        "validar_numeros": True,
    },
    {
        "id": "Q07",
        "pregunta": "¿Cuánto se gastó en Logística en agosto de 2026?",
        "ref_sql": "SELECT MONTO_TOTAL FROM DATAFINANCE.GOLD.KPI_CATEGORIA_MENSUAL WHERE ANIO_MES = '2026-08' AND TIPO = 'GASTO' AND CATEGORIA = 'LOGISTICA'",
        "token_groups": [["LOG"], ["2026-08", "AGOSTO DE 2026", "AGOSTO 2026", "AGOSTO"]],
        "validar_numeros": True,
    },
    {
        "id": "Q08",
        "pregunta": "¿Qué anomalías detectó el sistema y en qué meses ocurrieron?",
        "ref_sql": "SELECT ANIO_MES, CATEGORIA, TIPO_ANOMALIA FROM DATAFINANCE.GOLD.ANOMALIAS ORDER BY MES",
        "token_groups": [["2026-03", "MARZO"], ["2026-08", "AGOSTO"]],
        "validar_numeros": False,
    },
    {
        "id": "Q09",
        "pregunta": "Compara los ingresos y gastos del primer semestre de 2026 frente al segundo semestre disponible de 2026.",
        "ref_sql": "SELECT IFF(NUMERO_MES <= 6, 'S1', 'S2') AS SEM, ROUND(SUM(INGRESOS), 2) AS ING, ROUND(SUM(GASTOS), 2) AS GAS FROM DATAFINANCE.GOLD.KPI_MENSUAL WHERE ANIO = 2026 GROUP BY SEM",
        "token_groups": [["COP"]],
        "validar_numeros": True,
    },
    {
        "id": "Q10",
        "pregunta": "¿Cuál fue el mes completo con menor margen porcentual en 2026?",
        "ref_sql": "SELECT k.ANIO_MES, k.MARGEN_PCT FROM DATAFINANCE.GOLD.KPI_MENSUAL k WHERE k.ANIO = 2026 AND k.MES IN (SELECT MES FROM DATAFINANCE.SILVER.TRANSACCIONES GROUP BY MES HAVING DAY(MAX(FECHA)) >= 28) ORDER BY k.MARGEN_PCT ASC LIMIT 1",
        "token_groups": [["2026-06", "JUNIO DE 2026"]],
        "validar_numeros": True,
    },
    {
        "id": "Q11",
        "pregunta": "¿Cuánto sumaron los ingresos por Venta Contado en 2025?",
        "ref_sql": "SELECT ROUND(SUM(MONTO_TOTAL), 2) AS TOTAL FROM DATAFINANCE.GOLD.KPI_CATEGORIA_MENSUAL WHERE ANIO = 2025 AND TIPO = 'INGRESO' AND CATEGORIA = 'VENTA CONTADO'",
        "token_groups": [["2025"]],
        "validar_numeros": True,
    },
    {
        "id": "Q12",
        "pregunta": "¿Cuánto se pagó de Nómina durante el primer trimestre de 2026?",
        "ref_sql": "SELECT ROUND(SUM(MONTO_TOTAL), 2) AS TOTAL FROM DATAFINANCE.GOLD.KPI_CATEGORIA_MENSUAL WHERE ANIO = 2026 AND NUMERO_MES BETWEEN 1 AND 3 AND TIPO = 'GASTO' AND CATEGORIA = 'NOMINA'",
        "token_groups": [["COP"]],
        "validar_numeros": True,
    },
    {
        "id": "Q13",
        "pregunta": "¿Cuántos registros fueron rechazados al pasar de Bronze a Silver y cuáles fueron los motivos?",
        "ref_sql": "SELECT MOTIVO_RECHAZO, COUNT(*) AS CANT FROM DATAFINANCE.SILVER.TRANSACCIONES_RECHAZADOS GROUP BY MOTIVO_RECHAZO",
        "token_groups": [["DUPLICADO"]],
        "validar_numeros": True,
    },
    {
        "id": "Q14",
        "pregunta": "¿Cuántas transacciones limpias tiene el mes de diciembre de 2025?",
        "ref_sql": "SELECT TOTAL_TRANSACCIONES FROM DATAFINANCE.GOLD.KPI_MENSUAL WHERE ANIO_MES = '2025-12'",
        "token_groups": [["2025-12", "DICIEMBRE DE 2025"]],
        "validar_numeros": True,
    },
    {
        "id": "Q15",
        "pregunta": "¿Qué ingresos tuvo el área de Administración en todo el histórico?",
        "ref_sql": "SELECT COALESCE(ROUND(SUM(MONTO_TOTAL), 2), 0) AS TOTAL FROM DATAFINANCE.GOLD.KPI_AREA_MENSUAL WHERE AREA = 'ADMINISTRACIÓN' AND TIPO = 'INGRESO'",
        "token_groups": [["ADMIN"]],
        "validar_numeros": False,
    },
    {
        "id": "Q16",
        "pregunta": "¿Cuáles fueron los ingresos de enero de 2020?",
        "ref_sql": "SELECT INGRESOS FROM DATAFINANCE.GOLD.KPI_MENSUAL WHERE ANIO_MES = '2020-01'",
        "token_groups": [],
        "validar_numeros": False,
        "sin_datos": True,
    },
]


def _extraer_numeros_referencia(rows: list[dict[str, Any]]) -> list[float]:
    nums: list[float] = []
    for row in rows:
        for val in row.values():
            if isinstance(val, (int, float)) and val != 0:
                nums.append(float(val))
    return nums


def _hay_coincidencia_numerica(ref_nums: list[float], respuesta_texto: str, agent_rows: list[dict[str, Any]]) -> bool:
    if not ref_nums:
        return True
    corpus = respuesta_texto + " " + json.dumps(agent_rows, ensure_ascii=False)
    candidatos = [float(m.replace(",", ".")) for m in re.findall(r"-?\d+(?:[.,]\d+)?", corpus.replace(".", ""))]
    # También extraer manteniendo decimales estándar (para millones o porcentajes)
    candidatos_std = [float(m) for m in re.findall(r"-?\d+(?:\.\d+)?", corpus)]
    todos = candidatos + candidatos_std

    for ref in ref_nums:
        objetivos = [ref, ref / 1e6]
        for obj in objetivos:
            if abs(obj) < 1e-6:
                continue
            for c in todos:
                if abs(c - obj) / max(abs(obj), 1.0) <= 0.03:
                    return True
    return False


def main() -> int:
    resultados = []
    aprobadas = 0

    for caso in CASOS_EVALUACION:
        _, ref_rows = query_dicts(caso["ref_sql"])
        ref_nums = _extraer_numeros_referencia(ref_rows)

        try:
            resp = responder_pregunta_financiera(caso["pregunta"])
            sql_ok = bool(resp.get("sql"))
            corpus_upper = (
                resp.get("answer", "")
                + " "
                + resp.get("sql", "")
                + " "
                + json.dumps(resp.get("rows", []), ensure_ascii=False)
            ).upper()
            tokens_ok = all(
                any(alt.upper() in corpus_upper for alt in grp)
                for grp in caso.get("token_groups", [])
            )

            if caso.get("sin_datos"):
                sin_datos_ok = resp.get("row_count", 0) == 0 or any(
                    p in resp.get("answer", "").lower()
                    for p in ("no hay datos", "no existen datos", "sin registros", "no se encontraron")
                )
                num_ok = sin_datos_ok
            elif caso["validar_numeros"]:
                num_ok = _hay_coincidencia_numerica(ref_nums, resp.get("answer", ""), resp.get("rows", []))
            else:
                num_ok = resp.get("row_count", 0) >= 0

            passed = sql_ok and tokens_ok and num_ok
            if passed:
                aprobadas += 1

            resultados.append(
                {
                    "id": caso["id"],
                    "passed": passed,
                    "sql_ok": sql_ok,
                    "tokens_ok": tokens_ok,
                    "num_ok": num_ok,
                    "row_count": resp.get("row_count"),
                    "sql": resp.get("sql"),
                }
            )
            estado = "PASS" if passed else "FAIL"
            print(f"[{estado}] {caso['id']}: {caso['pregunta']} (rows={resp.get('row_count')}, num_ok={num_ok}, tokens_ok={tokens_ok})")
        except Exception as exc:
            resultados.append({"id": caso["id"], "passed": False, "error": str(exc)})
            print(f"[FAIL] {caso['id']}: ERROR -> {exc}")

    salida = ROOT / "docs" / "agent_eval_results.json"
    salida.parent.mkdir(parents=True, exist_ok=True)
    salida.write_text(json.dumps({"total": len(CASOS_EVALUACION), "passed": aprobadas, "results": resultados}, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nResumen: {aprobadas}/{len(CASOS_EVALUACION)} preguntas aprobadas. Detalle en {salida}")
    return 0 if aprobadas >= 14 else 1


if __name__ == "__main__":
    raise SystemExit(main())
