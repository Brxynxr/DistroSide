"""Pruebas de reglas financieras, seguridad SQL de solo lectura y manejo sin datos."""

import pytest
from fastapi.testclient import TestClient

from backend.groq_analyst import _extraer_sql_de_respuesta
from backend.main import app
from backend.sql_guard import validar_sql_solo_lectura


def calcular_kpis_referencia(ingresos: float, gastos: float) -> dict[str, float]:
    """Fórmula de referencia (AGENTS.md + gold_kpi_mensual.sql) para validar agregaciones."""
    utilidad = round(ingresos - gastos, 2)
    margen_pct = round((utilidad / ingresos) * 100, 2) if ingresos else 0.0
    return {"utilidad": utilidad, "margen_pct": margen_pct}


def test_formulas_utilidad_margen_y_division_cero():
    assert calcular_kpis_referencia(200_000_000, 155_000_000) == {
        "utilidad": 45_000_000,
        "margen_pct": 22.5,
    }
    assert calcular_kpis_referencia(0, 10_000_000) == {
        "utilidad": -10_000_000,
        "margen_pct": 0.0,
    }


def test_sql_guard_permite_select_y_agrega_limit():
    sql = validar_sql_solo_lectura(
        "```sql\nSELECT ANIO_MES, INGRESOS FROM DATAFINANCE.PUBLIC.KPI_MENSUAL ORDER BY INGRESOS DESC;\n```"
    )
    assert sql.startswith("SELECT ANIO_MES")
    assert "ORDER BY INGRESOS DESC" in sql
    assert sql.endswith("LIMIT 200")


def test_sql_guard_permite_cte_autorizado():
    sql = validar_sql_solo_lectura(
        "WITH base AS (SELECT ANIO_MES, UTILIDAD FROM DATAFINANCE.PUBLIC.KPI_MENSUAL) "
        "SELECT * FROM base LIMIT 12"
    )
    assert "FROM base" in sql
    assert "LIMIT 12" in sql


@pytest.mark.parametrize(
    "sql_inseguro",
    [
        "",
        "DELETE FROM DATAFINANCE.PUBLIC.KPI_MENSUAL",
        "DROP TABLE DATAFINANCE.PUBLIC.TRANSACCIONES",
        "SELECT * FROM DATAFINANCE.BRONZE.TRANSACCIONES",
        "SELECT * FROM DATAFINANCE.SILVER.TRANSACCIONES",
        "SELECT * FROM DATAFINANCE.GOLD.KPI_MENSUAL",
        "SELECT * FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY",
        "SELECT * FROM INFORMATION_SCHEMA.TABLES",
        "SELECT 1 FROM DATAFINANCE.PUBLIC.KPI_MENSUAL; DROP TABLE DATAFINANCE.PUBLIC.KPI_MENSUAL",
        "DESC TABLE DATAFINANCE.PUBLIC.KPI_MENSUAL",
        "SELECT * FROM DATAFINANCE.OTRO_ESQUEMA.SECRETO",
    ],
)
def test_sql_guard_bloquea_consultas_no_autorizadas(sql_inseguro):
    with pytest.raises(ValueError):
        validar_sql_solo_lectura(sql_inseguro)


def test_extractor_sql_desde_json_o_texto():
    assert (
        _extraer_sql_de_respuesta('{"sql": "SELECT 1 FROM DATAFINANCE.PUBLIC.KPI_MENSUAL"}')
        == "SELECT 1 FROM DATAFINANCE.PUBLIC.KPI_MENSUAL"
    )
    assert (
        _extraer_sql_de_respuesta('Texto previo {"sql": "SELECT ANIO_MES FROM PUBLIC.KPI_MENSUAL"} fin')
        == "SELECT ANIO_MES FROM PUBLIC.KPI_MENSUAL"
    )


def test_endpoint_kpis_maneja_periodo_sin_datos(monkeypatch):
    def fake_query_dicts(sql, _params=None):
        if "ORDER BY MES" in sql and "ES_COMPLETO" in sql:
            return ["ANIO_MES", "ES_COMPLETO"], []
        if "DISTINCT CATEGORIA" in sql:
            return ["CATEGORIA", "TIPO"], []
        if "DISTINCT AREA" in sql:
            return ["AREA"], []
        return [], []

    monkeypatch.setattr("backend.main.query_dicts", fake_query_dicts)
    client = TestClient(app)
    resp = client.get("/api/kpis?fecha_inicio=2099-01&fecha_fin=2099-02")
    assert resp.status_code == 200
    res = resp.json()

    assert res["resumen"]["ingresos_totales"] == 0
    assert res["resumen"]["gastos_totales"] == 0
    assert res["resumen"]["utilidad_total"] == 0
    assert res["resumen"]["margen_pct"] == 0.0
    assert res["resumen"]["periodo_desde"] is None
    assert res["mensual"] == []


def test_generacion_y_descarga_pdf_reporte():
    client = TestClient(app)
    payload = {
        "periodo_desde": "2026-01",
        "periodo_hasta": "2026-03",
        "modelo": "test-model",
        "reporte_texto": "## Resumen\nTexto de prueba para el informe.\n- Viñeta 1\n- Viñeta 2",
        "resumen_sql": {
            "ingresos_totales": 600000000,
            "gastos_totales": 450000000,
            "utilidad_total": 150000000,
            "margen_pct": 25.0,
        },
    }
    resp = client.post("/api/reportes/descargar-pdf", json=payload)
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.content.startswith(b"%PDF")
    assert len(resp.content) > 1000
