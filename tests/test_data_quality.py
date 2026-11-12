"""Pruebas de calidad de datos Silver y estructura estática de DAGs/SQL de Airflow."""

import ast
from datetime import date
from pathlib import Path

import pandas as pd

from scripts.generar_dataset import generar_historico

ROOT = Path(__file__).resolve().parent.parent


def _simular_silver(df_bronze: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Replica las reglas explícitas de airflow/dags/sql/silver_transacciones.sql."""
    work = df_bronze.copy()
    work["id_norm"] = work["id_transaccion"].astype(str).str.strip()
    work["tipo_norm"] = work["tipo"].astype(str).str.strip().str.upper()
    work["cat_norm"] = work["categoria"].astype(str).str.strip().str.upper()
    work["area_norm"] = work["area"].astype(str).str.strip().str.upper()

    work["fecha_dt"] = pd.to_datetime(work["fecha"], format="%Y-%m-%d", errors="coerce")
    faltantes = work["fecha_dt"].isna()
    work.loc[faltantes, "fecha_dt"] = pd.to_datetime(
        work.loc[faltantes, "fecha"], format="%d/%m/%Y", errors="coerce"
    )

    # Prioriza filas con monto no nulo antes de marcar duplicados (equivalente a ORDER BY IFF(MONTO IS NULL, 1, 0))
    work["_monto_null"] = work["monto"].isna().astype(int)
    work = work.sort_values(["id_norm", "_monto_null"]).reset_index(drop=True)
    work["es_duplicado"] = work.duplicated(subset=["id_norm"], keep="first")

    def motivo(row: pd.Series) -> str | None:
        if not row["id_norm"] or row["id_norm"] == "nan":
            return "ID_NULO"
        if row["es_duplicado"]:
            return "DUPLICADO"
        if pd.isna(row["fecha_dt"]):
            return "FECHA_INVALIDA"
        if pd.isna(row["monto"]) or float(row["monto"]) <= 0:
            return "MONTO_NULO_O_NO_POSITIVO"
        if row["tipo_norm"] not in ("INGRESO", "GASTO"):
            return "TIPO_INVALIDO"
        return None

    work["motivo_rechazo"] = work.apply(motivo, axis=1)
    silver = work[work["motivo_rechazo"].isna()].copy()
    rechazados = work[work["motivo_rechazo"].notna()].copy()
    return silver, rechazados


def test_reglas_silver_no_descartan_silenciosamente():
    df = generar_historico(date(2026, 3, 1), date(2026, 3, 10), seed=7)
    silver, rechazados = _simular_silver(df)

    # Trazabilidad total: Bronze = Silver + Rechazados
    assert len(silver) + len(rechazados) == len(df)
    assert len(silver) > 0
    assert len(rechazados) > 0

    # Silver no conserva nulos, duplicados ni inconsistencias de texto
    assert silver["monto"].isna().sum() == 0
    assert (silver["monto"] > 0).all()
    assert silver["fecha_dt"].isna().sum() == 0
    assert silver["id_norm"].is_unique
    assert (silver["tipo_norm"].isin(["INGRESO", "GASTO"])).all()
    assert (silver["cat_norm"] == silver["cat_norm"].str.strip().str.upper()).all()
    assert (silver["area_norm"] == silver["area_norm"].str.strip().str.upper()).all()

    # Motivos explícitos registrados en rechazados
    motivos_presentes = set(rechazados["motivo_rechazo"].unique())
    assert "MONTO_NULO_O_NO_POSITIVO" in motivos_presentes
    assert "DUPLICADO" in motivos_presentes


def test_archivos_sql_y_dags_airflow_validos():
    sql_dir = ROOT / "airflow" / "dags" / "sql"
    esperados = [
        "silver_transacciones.sql",
        "validar_silver.sql",
        "gold_kpi_mensual.sql",
        "anomalias.sql",
        "reporte.sql",
    ]
    for nombre in esperados:
        ruta = sql_dir / nombre
        assert ruta.exists(), f"Falta archivo SQL requerido: {ruta}"
        assert ruta.read_text(encoding="utf-8").strip() != ""

    # Verifica sintaxis AST y contratos críticos de ambos DAGs sin requerir Airflow runtime
    etl_src = (ROOT / "airflow" / "dags" / "datafinance_etl.py").read_text(encoding="utf-8")
    rep_src = (ROOT / "airflow" / "dags" / "datafinance_reporte.py").read_text(encoding="utf-8")
    ast.parse(etl_src)
    ast.parse(rep_src)

    assert "cargar_bronze_task >> transformar_silver >> validar_silver >> construir_gold >> detectar_anomalias" in etl_src
    assert "catchup=False" in etl_src
    assert "schedule=None" in rep_src
    assert "catchup=False" in rep_src
