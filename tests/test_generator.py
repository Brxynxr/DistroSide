"""Pruebas unitarias del generador de datos sintéticos (Bronze)."""

from datetime import date

import pandas as pd

from scripts.generar_dataset import generar_dia, generar_historico

COLUMNAS_ESPERADAS = [
    "id_transaccion",
    "fecha",
    "tipo",
    "categoria",
    "monto",
    "area",
    "descripcion",
]


def test_generar_historico_columnas_y_reproducibilidad():
    df1 = generar_historico(date(2026, 1, 1), date(2026, 1, 15), seed=42)
    df2 = generar_historico(date(2026, 1, 1), date(2026, 1, 15), seed=42)

    assert list(df1.columns) == COLUMNAS_ESPERADAS
    assert len(df1) > 500
    pd.testing.assert_frame_equal(df1, df2)


def test_generar_dia_determinista_y_prefijo_idempotente():
    df1 = generar_dia("2026-06-15")
    df2 = generar_dia("2026-06-15")

    pd.testing.assert_frame_equal(df1, df2)
    assert df1["id_transaccion"].str.startswith("T-20260615-").all()


def test_suciedad_controlada_presente_en_bronze():
    df = generar_historico(date(2026, 1, 1), date(2026, 2, 28), seed=99)
    total = len(df)

    pct_nulos = df["monto"].isna().sum() / total
    pct_duplicados = df.duplicated().sum() / total
    fechas_slash = df["fecha"].str.contains("/", na=False).sum()
    fechas_iso = df["fecha"].str.contains("-", na=False).sum()
    tipos_sucios = (df["tipo"] != df["tipo"].str.strip().str.upper()).sum()

    assert 0.01 <= pct_nulos <= 0.04
    assert 0.005 <= pct_duplicados <= 0.025
    assert fechas_slash > 0 and fechas_iso > 0
    assert tipos_sucios > 0


def test_anomalias_negocio_inyectadas_en_periodos_configurados():
    # Compara enero/febrero normales vs marzo (marketing x5), junio (ingresos x0.62) y agosto (logística x3.5)
    df = generar_historico(date(2026, 1, 1), date(2026, 8, 31), seed=42)
    limpio = df.drop_duplicates().dropna(subset=["monto"]).copy()

    es_iso = limpio["fecha"].str.contains("-", na=False)
    limpio["fecha_dt"] = pd.NaT
    limpio.loc[es_iso, "fecha_dt"] = pd.to_datetime(limpio.loc[es_iso, "fecha"], format="%Y-%m-%d")
    limpio.loc[~es_iso, "fecha_dt"] = pd.to_datetime(limpio.loc[~es_iso, "fecha"], format="%d/%m/%Y")
    limpio["anio_mes"] = limpio["fecha_dt"].dt.to_period("M").astype(str)
    limpio["tipo_norm"] = limpio["tipo"].str.strip().str.upper()
    limpio["cat_norm"] = limpio["categoria"].str.strip().str.upper()

    # Pico de marketing en 2026-03
    mkt_normal = (
        limpio[(limpio["anio_mes"].isin(["2026-01", "2026-02"])) & (limpio["cat_norm"] == "MARKETING")]
        .groupby("anio_mes")["monto"]
        .sum()
        .mean()
    )
    mkt_marzo = limpio[(limpio["anio_mes"] == "2026-03") & (limpio["cat_norm"] == "MARKETING")]["monto"].sum()
    assert mkt_marzo > mkt_normal * 3.0

    # Caída de ingresos en 2026-06
    ing_normal = (
        limpio[(limpio["anio_mes"].isin(["2026-01", "2026-02", "2026-04", "2026-05"])) & (limpio["tipo_norm"] == "INGRESO")]
        .groupby("anio_mes")["monto"]
        .sum()
        .mean()
    )
    ing_junio = limpio[(limpio["anio_mes"] == "2026-06") & (limpio["tipo_norm"] == "INGRESO")]["monto"].sum()
    assert ing_junio < ing_normal * 0.75

    # Pico de logística en 2026-08
    log_normal = (
        limpio[(limpio["anio_mes"].isin(["2026-01", "2026-02"])) & (limpio["cat_norm"] == "LOGISTICA")]
        .groupby("anio_mes")["monto"]
        .sum()
        .mean()
    )
    log_agosto = limpio[(limpio["anio_mes"] == "2026-08") & (limpio["cat_norm"] == "LOGISTICA")]["monto"].sum()
    assert log_agosto > log_normal * 2.5
