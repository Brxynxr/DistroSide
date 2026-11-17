"""Pruebas unitarias e integrales para el Centinela Semanal de Sobrecostos Operativos."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.weekly_sentinel import (
    _formatear_millones,
    _generar_diagnostico_fallback,
    actualizar_estado_alerta,
    evaluar_centinela_semanal,
    listar_alertas_centinela,
)


def test_formatear_millones_sentinel():
    assert _formatear_millones(None) == "$0.00 M COP"
    assert _formatear_millones(50_000_000) == "$50.00 M COP"


def test_generar_diagnostico_fallback_sentinel():
    alerta = {
        "CATEGORIA": "LOGISTICA",
        "AREA": "OPERACIONES",
        "NIVEL_RIESGO": "CRITICO",
        "DESVIO_PROYECTADO_PCT": 237.4,
        "PORCENTAJE_CONSUMIDO": 337.4,
        "DIAS_TRANSCURRIDOS": 31,
        "GASTO_ACUMULADO": 35_860_000.0,
        "PROMEDIO_HISTORICO_MENSUAL": 10_620_000.0,
        "PROYECCION_FIN_MES": 35_860_000.0,
    }
    txs = [
        {"DESCRIPCION": "Reparación mayor caja camión", "MONTO": 5_000_000.0, "FECHA": "2026-08-15"},
        {"DESCRIPCION": "Fletes emergencia ruta Soledad", "MONTO": 3_500_000.0, "FECHA": "2026-08-20"},
    ]

    diagnostico = _generar_diagnostico_fallback(alerta, txs)
    assert "⚠️ ALERTA TEMPRANA [CRITICO] en LOGISTICA (Área OPERACIONES)" in diagnostico
    assert "337.4%" in diagnostico
    assert "+237.4%" in diagnostico
    assert "Reparación mayor caja camión" in diagnostico
    assert "Fletes emergencia ruta Soledad" in diagnostico


def test_evaluar_centinela_sin_alertas_cuando_todo_es_normal(monkeypatch):
    filas_normales = [
        {
            "PERIODO": "2026-10",
            "FECHA_CORTE": "2026-10-31",
            "DIAS_TRANSCURRIDOS": 31,
            "DIAS_TOTALES_MES": 31,
            "CATEGORIA": "NOMINA",
            "AREA": "ADMINISTRACIÓN",
            "GASTO_ACUMULADO": 22_000_000.0,
            "TOTAL_TRANSACCIONES": 30,
            "PROMEDIO_HISTORICO": 22_500_000.0,
            "PORCENTAJE_CONSUMIDO": 97.78,
            "PROYECCION_FIN_MES": 22_000_000.0,
            "DESVIO_PROYECTADO_PCT": -2.22,
            "NIVEL_RIESGO": "NORMAL",
        }
    ]

    def fake_query_dicts(sql, params=None):
        return ["CATEGORIA"], filas_normales

    monkeypatch.setattr("backend.weekly_sentinel.query_dicts", fake_query_dicts)

    resultado = evaluar_centinela_semanal(mes="2026-10", persistir=False)
    assert resultado["periodo"] == "2026-10"
    assert resultado["total_alertas"] == 0
    assert len(resultado["alertas"]) == 0


def test_evaluar_centinela_detecta_alerta_critica(monkeypatch):
    filas_con_sobrecosto = [
        {
            "PERIODO": "2026-08",
            "FECHA_CORTE": "2026-08-31",
            "DIAS_TRANSCURRIDOS": 31,
            "DIAS_TOTALES_MES": 31,
            "CATEGORIA": "LOGISTICA",
            "AREA": "OPERACIONES",
            "GASTO_ACUMULADO": 35_860_000.0,
            "TOTAL_TRANSACCIONES": 110,
            "PROMEDIO_HISTORICO": 10_620_000.0,
            "PORCENTAJE_CONSUMIDO": 337.66,
            "PROYECCION_FIN_MES": 35_860_000.0,
            "DESVIO_PROYECTADO_PCT": 237.66,
            "NIVEL_RIESGO": "CRITICO",
        }
    ]

    txs_criticas = [
        {"ID_TRANSACCION": "T-01", "FECHA": "2026-08-10", "AREA": "OPERACIONES", "MONTO": 8_000_000.0, "DESCRIPCION": "Mantenimiento mayor flota"}
    ]

    def fake_query_dicts(sql, params=None):
        if "ORDER BY DESVIO_PROYECTADO_PCT" in sql:
            return ["CATEGORIA"], filas_con_sobrecosto
        if "ORDER BY MONTO DESC" in sql:
            return ["ID_TRANSACCION"], txs_criticas
        return [], []

    execute_dml_mock = MagicMock(return_value=1)
    monkeypatch.setattr("backend.weekly_sentinel.query_dicts", fake_query_dicts)
    monkeypatch.setattr("backend.weekly_sentinel.execute_dml", execute_dml_mock)

    resultado = evaluar_centinela_semanal(mes="2026-08", persistir=True)
    assert resultado["total_alertas"] == 1
    assert resultado["alertas"][0]["CATEGORIA"] == "LOGISTICA"
    assert resultado["alertas"][0]["NIVEL_RIESGO"] == "CRITICO"
    assert execute_dml_mock.called


def test_actualizar_estado_alerta_validaciones(monkeypatch):
    with pytest.raises(ValueError, match="no válido"):
        actualizar_estado_alerta(id_alerta=1, nuevo_estado="INVALIDO")

    monkeypatch.setattr("backend.weekly_sentinel.execute_dml", lambda sql, params: 1)
    res = actualizar_estado_alerta(id_alerta=1, nuevo_estado="mitigada")
    assert res["id_alerta"] == 1
    assert res["estado"] == "MITIGADA"


def test_endpoint_centinela_alertas_api(monkeypatch):
    alertas_mock = [
        {
            "ID_ALERTA": 10,
            "PERIODO": "2026-08",
            "CATEGORIA": "LOGISTICA",
            "NIVEL_RIESGO": "CRITICO",
            "DESVIO_PROYECTADO_PCT": 237.4,
            "ESTADO": "ACTIVA",
        }
    ]
    monkeypatch.setattr("backend.main.listar_alertas_centinela", lambda limite, solo_activas: alertas_mock)

    client = TestClient(app)
    resp = client.get("/api/automation/centinela/alertas?solo_activas=true")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["alertas"][0]["CATEGORIA"] == "LOGISTICA"


def test_endpoint_centinela_evaluar_api(monkeypatch):
    def fake_evaluar(mes=None, persistir=True):
        return {
            "periodo": mes or "2026-11",
            "total_alertas": 0,
            "alertas": [],
            "total_categorias_evaluadas": 5,
        }

    monkeypatch.setattr("backend.main.evaluar_centinela_semanal", fake_evaluar)

    client = TestClient(app)
    resp = client.post(
        "/api/automation/centinela/evaluar",
        json={"mes": "2026-11", "persistir": False},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["periodo"] == "2026-11"
    assert data["total_alertas"] == 0
