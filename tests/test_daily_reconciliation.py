"""Pruebas unitarias e integrales para el Cuadre Diario de Ventas y Monitoreo de Liquidez."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from backend.daily_reconciliation import (
    _formatear_millones,
    _formatear_pesos,
    _generar_sintesis_fallback,
    ejecutar_cuadre_diario,
    listar_historial_cuadres,
    obtener_tendencia_liquidez_diaria,
    obtener_ultimo_cuadre,
)
from backend.main import app


def test_formatear_pesos_y_millones():
    assert _formatear_pesos(None) == "$0 COP"
    assert _formatear_pesos(1_500_000) == "$1,500,000 COP"
    assert _formatear_millones(None) == "$0.00 M COP"
    assert _formatear_millones(5_730_000) == "$5.73 M COP"


def test_generar_sintesis_fallback_optima():
    cuadre = {
        "FECHA": "2026-11-11",
        "TOTAL_VENTAS": 5_730_685.71,
        "VENTAS_CONTADO": 2_893_506.26,
        "VENTAS_CREDITO": 2_301_231.31,
        "RATIO_CONTADO_PCT": 50.49,
        "RATIO_CREDITO_PCT": 40.16,
        "ESTADO_LIQUIDEZ": "OPTIMA",
        "TOTAL_TRANSACCIONES": 34,
    }
    sintesis = _generar_sintesis_fallback(cuadre, [])
    assert "✅ LIQUIDEZ ÓPTIMA" in sintesis
    assert "50.5%" in sintesis
    assert "$5.73 M COP" in sintesis
    assert "garantiza el cumplimiento" in sintesis


def test_generar_sintesis_fallback_advertencia():
    cuadre = {
        "FECHA": "2026-10-15",
        "TOTAL_VENTAS": 4_000_000.0,
        "VENTAS_CONTADO": 1_600_000.0,
        "VENTAS_CREDITO": 2_200_000.0,
        "RATIO_CONTADO_PCT": 40.0,
        "RATIO_CREDITO_PCT": 55.0,
        "ESTADO_LIQUIDEZ": "ADVERTENCIA",
        "TOTAL_TRANSACCIONES": 25,
    }
    sintesis = _generar_sintesis_fallback(cuadre, [])
    assert "⚠️ ADVERTENCIA DE LIQUIDEZ" in sintesis
    assert "40.0%" in sintesis
    assert "Priorizar cobro de cartera" in sintesis


def test_generar_sintesis_fallback_critica():
    cuadre = {
        "FECHA": "2026-10-04",
        "TOTAL_VENTAS": 3_265_134.83,
        "VENTAS_CONTADO": 1_020_853.07,
        "VENTAS_CREDITO": 2_067_264.25,
        "RATIO_CONTADO_PCT": 31.27,
        "RATIO_CREDITO_PCT": 63.31,
        "ESTADO_LIQUIDEZ": "CRITICA",
        "TOTAL_TRANSACCIONES": 19,
    }
    sintesis = _generar_sintesis_fallback(cuadre, [])
    assert "🚨 RIESGO CRÍTICO DE ILIQUIDEZ" in sintesis
    assert "31.3%" in sintesis
    assert "Suspender despachos a clientes con cartera vencida" in sintesis


def test_ejecutar_cuadre_diario_mocked(monkeypatch):
    mock_query = MagicMock()
    mock_dml = MagicMock()

    # Primera llamada: V_CUADRE_DIARIO_CONSOLIDADO
    # Segunda llamada: Top 5 ventas
    # Tercera llamada: ID_CUADRE generado
    def fake_query(sql, params=None):
        if "V_CUADRE_DIARIO_CONSOLIDADO" in sql:
            return ["FECHA"], [
                {
                    "FECHA": "2026-10-31",
                    "TOTAL_VENTAS": 7562156.19,
                    "VENTAS_CONTADO": 4565996.73,
                    "VENTAS_CREDITO": 2101627.59,
                    "SERVICIOS": 894531.87,
                    "TOTAL_TRANSACCIONES": 47,
                    "RATIO_CONTADO_PCT": 60.38,
                    "RATIO_CREDITO_PCT": 27.79,
                    "RATIO_SERVICIOS_PCT": 11.83,
                    "ESTADO_LIQUIDEZ": "OPTIMA",
                }
            ]
        if "TRANSACCIONES" in sql and "ORDER BY MONTO DESC" in sql:
            return ["ID_TRANSACCION"], [
                {"ID_TRANSACCION": 1, "CATEGORIA": "VENTA CONTADO", "MONTO": 500000.0, "DESCRIPCION": "Venta mostrador"}
            ]
        if "ID_CUADRE FROM" in sql:
            return ["ID_CUADRE"], [{"ID_CUADRE": 999}]
        return [], []

    monkeypatch.setattr("backend.daily_reconciliation.query_dicts", fake_query)
    monkeypatch.setattr("backend.daily_reconciliation.execute_dml", mock_dml)
    # Forzar fallback para evitar llamadas externas de red en el test unitario
    monkeypatch.setattr(
        "backend.daily_reconciliation._redactar_sintesis_con_ia",
        lambda cuadre, top: _generar_sintesis_fallback(cuadre, top),
    )

    resultado = ejecutar_cuadre_diario(fecha="2026-10-31", disparador="TEST_RUNNER")

    assert resultado["id_cuadre"] == 999
    assert resultado["fecha"] == "2026-10-31"
    assert resultado["estado_liquidez"] == "OPTIMA"
    assert resultado["ratio_contado_pct"] == 60.38
    assert resultado["ejecutado_por"] == "TEST_RUNNER"
    assert mock_dml.call_count == 2  # DELETE idempotente + INSERT


def test_ejecutar_cuadre_diario_fecha_inexistente(monkeypatch):
    def fake_empty_query(sql, params=None):
        return [], []

    monkeypatch.setattr("backend.daily_reconciliation.query_dicts", fake_empty_query)

    with pytest.raises(ValueError, match="No existen transacciones de ingresos"):
        ejecutar_cuadre_diario(fecha="1999-01-01")


def test_api_cuadre_diario_endpoints(monkeypatch):
    client = TestClient(app)

    # Mock de datos para evitar depender del estado vivo de Snowflake en el test de endpoints
    monkeypatch.setattr(
        "backend.main.obtener_ultimo_cuadre",
        lambda: {
            "ID_CUADRE": 88,
            "FECHA": "2026-11-11",
            "TOTAL_VENTAS": 5730685.71,
            "VENTAS_CONTADO": 2893506.26,
            "VENTAS_CREDITO": 2301231.31,
            "SERVICIOS": 535948.14,
            "RATIO_CONTADO_PCT": 50.49,
            "RATIO_CREDITO_PCT": 40.16,
            "ESTADO_LIQUIDEZ": "OPTIMA",
            "TOTAL_TRANSACCIONES": 34,
            "SINTESIS_TESORERIA": "Síntesis mockeada",
        },
    )
    monkeypatch.setattr(
        "backend.main.listar_historial_cuadres",
        lambda limite=15: [
            {"ID_CUADRE": 88, "FECHA": "2026-11-11", "ESTADO_LIQUIDEZ": "OPTIMA"}
        ],
    )
    monkeypatch.setattr(
        "backend.main.obtener_tendencia_liquidez_diaria",
        lambda dias=14: [
            {"FECHA": "2026-11-11", "RATIO_CONTADO_PCT": 50.49, "TOTAL_VENTAS": 5730685.71}
        ],
    )

    # 1. GET /api/automation/cuadre-diario
    resp_get = client.get("/api/automation/cuadre-diario")
    assert resp_get.status_code == 200
    data = resp_get.json()
    assert "ultimo" in data
    assert data["ultimo"]["ESTADO_LIQUIDEZ"] == "OPTIMA"
    assert "historial" in data
    assert len(data["historial"]) == 1

    # 2. POST /api/automation/cuadre-diario/ejecutar
    monkeypatch.setattr(
        "backend.main.ejecutar_cuadre_diario",
        lambda fecha=None, disparador="API_TRIGGER": {
            "id_cuadre": 105,
            "fecha": fecha or "2026-11-11",
            "estado_liquidez": "OPTIMA",
            "ratio_contado_pct": 52.0,
            "total_ventas": 6000000.0,
            "ejecutado_por": disparador,
        },
    )
    resp_post = client.post(
        "/api/automation/cuadre-diario/ejecutar",
        json={"fecha": "2026-11-11", "disparador": "TEST_UNIT"},
    )
    assert resp_post.status_code == 200
    res_json = resp_post.json()
    assert res_json["id_cuadre"] == 105
    assert res_json["estado_liquidez"] == "OPTIMA"
    assert res_json["ejecutado_por"] == "TEST_UNIT"
