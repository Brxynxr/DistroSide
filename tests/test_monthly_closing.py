"""Pruebas unitarias y de integración para la Automatización del Cierre Financiero Mensual."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.monthly_closing import (
    STORAGE_REPORTS_DIR,
    _formatear_millones,
    _generar_narrativa_cierre_fallback,
    ejecutar_cierre_mensual,
    listar_historial_cierres,
    obtener_ultimo_mes_completo,
    verificar_cierre_previo,
)


def test_formatear_millones():
    assert _formatear_millones(None) == "$0.00 M COP"
    assert _formatear_millones(100_000_000) == "$100.00 M COP"
    assert _formatear_millones(12_345_678) == "$12.35 M COP"


def test_generador_narrativa_cierre_fallback_con_anomalias():
    contexto = {
        "mes": "2026-08",
        "resumen": {
            "INGRESOS": 200_000_000,
            "GASTOS": 160_000_000,
            "UTILIDAD": 40_000_000,
            "MARGEN_PCT": 20.0,
            "TOTAL_TRANSACCIONES": 1500,
            "VAR_INGRESOS_PCT": 5.2,
            "VAR_GASTOS_PCT": -2.1,
        },
        "por_categoria": [
            {"TIPO": "GASTO", "CATEGORIA": "LOGISTICA", "MONTO_TOTAL": 35_000_000, "TOTAL_TRANSACCIONES": 120, "VAR_PCT": 150.0},
            {"TIPO": "INGRESO", "CATEGORIA": "VENTA CONTADO", "MONTO_TOTAL": 110_000_000, "TOTAL_TRANSACCIONES": 800, "VAR_PCT": 3.0},
        ],
        "anomalias": [
            {
                "CATEGORIA": "LOGISTICA",
                "TIPO_ANOMALIA": "PICO_ATIPICO",
                "VALOR_OBSERVADO": 35_000_000,
                "VALOR_ESPERADO": 10_000_000,
                "Z_SCORE": 3.4,
                "MOTIVO": "Sobrecosto en fletes y reparaciones de flota",
            }
        ],
    }

    texto = _generar_narrativa_cierre_fallback(contexto)
    assert "# Informe Ejecutivo de Cierre Mensual — Periodo 2026-08" in texto
    assert "$200.00 M COP" in texto
    assert "20.00%" in texto
    assert "LOGISTICA" in texto
    assert "PICO_ATIPICO" in texto
    assert "Z=3.4" in texto


def test_generador_narrativa_cierre_fallback_sin_anomalias():
    contexto = {
        "mes": "2026-05",
        "resumen": {
            "INGRESOS": 190_000_000,
            "GASTOS": 150_000_000,
            "UTILIDAD": 40_000_000,
            "MARGEN_PCT": 21.05,
            "TOTAL_TRANSACCIONES": 1400,
        },
        "por_categoria": [],
        "anomalias": [],
    }

    texto = _generar_narrativa_cierre_fallback(contexto)
    assert "No se detectaron anomalías estadísticas severas" in texto


def test_valida_formato_mes_invalido():
    with pytest.raises(ValueError, match="Formato de mes inválido"):
        ejecutar_cierre_mensual(mes="08-2026")

    with pytest.raises(ValueError, match="Formato de mes inválido"):
        ejecutar_cierre_mensual(mes="2026/08")


def test_cierre_idempotente_si_ya_existe(monkeypatch):
    cierre_mock = {
        "ID_CIERRE": 42,
        "MES_CERRADO": "2026-07",
        "FECHA_EJECUCION": "2026-08-01T02:00:00",
        "ESTADO": "EXITOSO",
        "ID_REPORTE": 10,
        "NOMBRE_ARCHIVO_PDF": "Executive_Pack_2026-07.pdf",
    }

    monkeypatch.setattr(
        "backend.monthly_closing.verificar_cierre_previo",
        lambda mes: cierre_mock if mes == "2026-07" else None,
    )

    resultado = ejecutar_cierre_mensual(mes="2026-07", forzar=False)
    assert resultado["estado"] == "ALREADY_CLOSED"
    assert resultado["id_cierre"] == 42
    assert resultado["nombre_archivo_pdf"] == "Executive_Pack_2026-07.pdf"
    assert "ya fue cerrado previamente" in resultado["mensaje"]


def test_ejecucion_cierre_completo_con_mocks(monkeypatch, tmp_path):
    monkeypatch.setattr("backend.monthly_closing.STORAGE_REPORTS_DIR", tmp_path)

    # 1. Mock de verificar_cierre_previo -> None
    monkeypatch.setattr("backend.monthly_closing.verificar_cierre_previo", lambda mes: None)

    # 2. Mock de execute_file_sql
    execute_file_mock = MagicMock()
    monkeypatch.setattr("backend.monthly_closing.execute_file_sql", execute_file_mock)

    # 3. Mock de execute_dml
    execute_dml_mock = MagicMock(return_value=1)
    monkeypatch.setattr("backend.monthly_closing.execute_dml", execute_dml_mock)

    # 4. Mock de query_dicts
    kpi_datos = [
        {
            "MES": "2026-09-01",
            "ANIO_MES": "2026-09",
            "TOTAL_TRANSACCIONES": 1600,
            "INGRESOS": 210000000.0,
            "GASTOS": 165000000.0,
            "UTILIDAD": 45000000.0,
            "MARGEN_PCT": 21.43,
            "VAR_INGRESOS_PCT": 2.5,
            "VAR_GASTOS_PCT": 1.1,
            "VAR_UTILIDAD_PCT": 8.0,
        }
    ]
    cat_datos = [
        {"TIPO": "INGRESO", "CATEGORIA": "VENTA CONTADO", "TOTAL_TRANSACCIONES": 900, "MONTO_TOTAL": 115000000.0, "VAR_PCT": 3.0},
        {"TIPO": "GASTO", "CATEGORIA": "PROVEEDORES", "TOTAL_TRANSACCIONES": 200, "MONTO_TOTAL": 105000000.0, "VAR_PCT": 1.5},
    ]

    def fake_query_dicts(sql, params=None):
        if "FROM DATAFINANCE.PUBLIC.KPI_MENSUAL" in sql:
            return ["ANIO_MES"], kpi_datos
        if "FROM DATAFINANCE.PUBLIC.KPI_CATEGORIA_MENSUAL" in sql:
            return ["CATEGORIA"], cat_datos
        if "FROM DATAFINANCE.PUBLIC.ANOMALIAS" in sql:
            return ["CATEGORIA"], []
        if "MAX(ID_REPORTE)" in sql:
            return ["ID_REPORTE"], [{"ID_REPORTE": 99}]
        if "MAX(ID_CIERRE)" in sql:
            return ["ID_CIERRE"], [{"ID_CIERRE": 55}]
        return [], []

    monkeypatch.setattr("backend.monthly_closing.query_dicts", fake_query_dicts)

    resultado = ejecutar_cierre_mensual(mes="2026-09", forzar=True, disparador="TEST_SUITE")

    assert resultado["estado"] == "EXITOSO"
    assert resultado["mes_cerrado"] == "2026-09"
    assert resultado["id_cierre"] == 55
    assert resultado["id_reporte"] == 99
    assert resultado["total_anomalias"] == 0
    assert resultado["nombre_archivo_pdf"] == "Executive_Pack_2026-09.pdf"

    # Verificar que el PDF se escribió físicamente
    pdf_path = tmp_path / "Executive_Pack_2026-09.pdf"
    assert pdf_path.is_file()
    assert pdf_path.stat().st_size > 500  # Archivo PDF válido no vacío
    assert execute_file_mock.called
    assert execute_dml_mock.called


def test_endpoint_cierre_mensual_api(monkeypatch):
    def fake_ejecutar(mes=None, forzar=False, disparador="API_DISPATCH"):
        return {
            "estado": "EXITOSO",
            "mes_cerrado": mes or "2026-10",
            "id_cierre": 101,
            "id_reporte": 50,
            "nombre_archivo_pdf": "Executive_Pack_2026-10.pdf",
            "total_anomalias": 0,
            "mensaje": "Cierre completado con éxito.",
        }

    monkeypatch.setattr("backend.main.ejecutar_cierre_mensual", fake_ejecutar)

    client = TestClient(app)
    resp = client.post(
        "/api/automation/cierre-mensual",
        json={"mes": "2026-10", "forzar": True, "disparador": "TEST_API"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["estado"] == "EXITOSO"
    assert data["id_cierre"] == 101
    assert data["mes_cerrado"] == "2026-10"


def test_endpoint_listar_cierres_api(monkeypatch):
    cierres_mock = [
        {
            "ID_CIERRE": 1,
            "MES_CERRADO": "2026-09",
            "FECHA_EJECUCION": "2026-10-01T02:00:00",
            "ESTADO": "EXITOSO",
            "INGRESOS": 200000000.0,
            "GASTOS": 160000000.0,
            "UTILIDAD": 40000000.0,
            "MARGEN_PCT": 20.0,
            "NOMBRE_ARCHIVO_PDF": "Executive_Pack_2026-09.pdf",
        }
    ]
    monkeypatch.setattr("backend.main.listar_historial_cierres", lambda limite: cierres_mock)

    client = TestClient(app)
    resp = client.get("/api/automation/cierres?limite=5")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["cierres"][0]["MES_CERRADO"] == "2026-09"


def test_endpoint_descargar_pdf_cierre_api(monkeypatch, tmp_path):
    archivo_pdf = tmp_path / "Executive_Pack_2026-09.pdf"
    archivo_pdf.write_bytes(b"%PDF-1.4 Mock PDF content")

    monkeypatch.setattr("backend.main.obtener_ruta_pdf_cierre", lambda id_cierre: archivo_pdf if id_cierre == 1 else None)

    client = TestClient(app)
    resp = client.get("/api/automation/cierres/1/descargar-pdf")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert b"%PDF-1.4" in resp.content
