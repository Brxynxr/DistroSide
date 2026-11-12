"""Generador de dataset sintético financiero para DataFinance AI.

Simula las transacciones de ingresos y gastos de la empresa ficticia
"Distribuidora del Caribe S.A.S." con:
- Suciedad controlada (~2% montos nulos, fechas en dos formatos,
  mayúsculas/espacios inconsistentes y ~1% filas duplicadas) para justificar
  la limpieza en la capa Silver de Snowflake.
- Anomalías intencionales inyectadas en 2026 para validar la detección
  automática (Cortex ML) y las preguntas analíticas del agente.
- Soporte para carga histórica inicial (24 meses) y carga diaria incremental.
"""

from __future__ import annotations

import argparse
import os
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Literal

import numpy as np
import pandas as pd
from dotenv import load_dotenv

# Referencias de negocio (COP / mes)
ANOMALIAS_MENSUALES = {
    (2026, 3): {
        "marketing_mult": 5.0,
        "descripcion": "Campaña agresiva no presupuestada en puntos de venta",
    },
    (2026, 6): {
        "ingresos_mult": 0.62,
        "descripcion": "Caída fuerte de ventas por cierre vial y desabastecimiento",
    },
    (2026, 8): {
        "logistica_mult": 3.5,
        "descripcion": "Reparación mayor de flota y fletes de emergencia",
    },
}

DESCRIPCIONES = {
    "Venta contado": [
        "Venta tienda de barrio",
        "Factura contado minimercado",
        "Despacho pago contraentrega",
        "Venta mostrador mayorista",
    ],
    "Venta credito": [
        "Venta a 30 días supermercado",
        "Pedido crédito cadena regional",
        "Factura crédito autoservicio",
    ],
    "Servicios": [
        "Cobro servicio de domicilio",
        "Tarifa exhibición en góndola",
        "Bonificación por distribución",
    ],
    "Proveedores": [
        "Pago fabricante bebidas",
        "Compra lote productos de aseo",
        "Reposición inventario snacks",
        "Factura proveedor lácteos",
    ],
    "Nomina": [
        "Pago nómina quincenal",
        "Aportes seguridad social",
    ],
    "Arriendo": [
        "Canon arrendamiento bodega principal",
        "Arriendo oficina administrativa",
    ],
    "Logistica": [
        "Tanqueo flota de reparto",
        "Mantenimiento preventivo camión",
        "Flete ruta interurbana",
        "Peajes y cargue mercancía",
    ],
    "Marketing": [
        "Pauta digital regional",
        "Material POP tiendas",
        "Promoción impulso supermercados",
    ],
    "Servicios publicos": [
        "Factura energía eléctrica bodega",
        "Servicio acueducto y alcantarillado",
        "Internet y telefonía corporativa",
    ],
    "Impuestos": [
        "Pago retención en la fuente",
        "Declaración IVA bimestral",
        "Impuesto industria y comercio",
    ],
}


def _variar_texto(texto: str, rng: np.random.Generator) -> str:
    """Introduce inconsistencias controladas de mayúsculas y espacios."""
    opcion = rng.random()
    if opcion < 0.65:
        return texto
    if opcion < 0.78:
        return texto.lower()
    if opcion < 0.88:
        return texto.upper()
    if opcion < 0.94:
        return f" {texto} "
    return f"  {texto.lower()}"


def _formatear_fecha(fecha: date, rng: np.random.Generator) -> str:
    """Mezcla formato ISO (YYYY-MM-DD) y formato latino (DD/MM/YYYY)."""
    if rng.random() < 0.25:
        return fecha.strftime("%d/%m/%Y")
    return fecha.strftime("%Y-%m-%d")


def _generar_transacciones_dia(
    fecha: date,
    rng: np.random.Generator,
    prefijo_id: str | None = None,
    contador_inicial: int = 1,
) -> tuple[list[dict], int]:
    """Genera las transacciones crudas de un día específico."""
    filas: list[dict] = []
    contador = contador_inicial
    reglas_mes = ANOMALIAS_MENSUALES.get((fecha.year, fecha.month), {})

    ingresos_mult = reglas_mes.get("ingresos_mult", 1.0)
    marketing_mult = reglas_mes.get("marketing_mult", 1.0)
    logistica_mult = reglas_mes.get("logistica_mult", 1.0)

    # Estacionalidad leve por día de semana (domingos baja operación)
    factor_dia = 0.45 if fecha.weekday() == 6 else (1.15 if fecha.weekday() in (4, 5) else 1.0)

    def agregar_fila(
        tipo: str,
        categoria: str,
        monto: float,
        area: str,
        desc: str | None = None,
    ) -> None:
        nonlocal contador
        id_tx = (
            f"{prefijo_id}-{contador:04d}"
            if prefijo_id
            else f"T-{contador:06d}"
        )
        contador += 1
        descripcion = desc or str(rng.choice(DESCRIPCIONES[categoria]))
        filas.append(
            {
                "id_transaccion": id_tx,
                "fecha": _formatear_fecha(fecha, rng),
                "tipo": _variar_texto(tipo, rng),
                "categoria": _variar_texto(categoria, rng),
                "monto": round(float(monto), 2),
                "area": area,
                "descripcion": descripcion,
            }
        )

    # --- INGRESOS DIARIOS (~200M COP/mes) ---
    n_contado = max(1, int(rng.poisson(25 * factor_dia)))
    for _ in range(n_contado):
        monto = rng.normal(155_000, 35_000) * ingresos_mult
        agregar_fila("INGRESO", "Venta contado", max(35_000, monto), "Ventas")

    n_credito = max(1, int(rng.poisson(12 * factor_dia)))
    for _ in range(n_credito):
        monto = rng.normal(200_000, 45_000) * ingresos_mult
        agregar_fila("INGRESO", "Venta credito", max(50_000, monto), "Ventas")

    n_servicios = int(rng.poisson(4 * factor_dia))
    for _ in range(n_servicios):
        monto = rng.normal(100_000, 22_000) * ingresos_mult
        agregar_fila("INGRESO", "Servicios", max(25_000, monto), "Operaciones")

    # --- GASTOS VARIABLES DIARIOS ---
    # Proveedores (~110M COP/mes)
    n_prov = max(1, int(rng.poisson(6 * factor_dia)))
    for _ in range(n_prov):
        monto = rng.normal(610_000, 110_000)
        agregar_fila("GASTO", "Proveedores", max(180_000, monto), "Operaciones")

    # Logística (~10M COP/mes normal; x3.5 en mes anómalo)
    n_log = max(1, int(rng.poisson(5 * factor_dia)))
    for _ in range(n_log):
        monto = rng.normal(66_000, 15_000) * logistica_mult
        desc = (
            reglas_mes["descripcion"]
            if logistica_mult > 1.0 and rng.random() < 0.35
            else None
        )
        agregar_fila("GASTO", "Logistica", max(20_000, monto), "Operaciones", desc)

    # Marketing (~3M COP/mes normal; x5 en mes anómalo)
    n_mkt = int(rng.poisson(1.5))
    for _ in range(n_mkt):
        monto = rng.normal(66_000, 15_000) * marketing_mult
        desc = (
            reglas_mes["descripcion"]
            if marketing_mult > 1.0 and rng.random() < 0.5
            else None
        )
        agregar_fila("GASTO", "Marketing", max(20_000, monto), "Ventas", desc)

    # --- GASTOS PERIÓDICOS EN FECHAS FIJAS DEL MES ---
    if fecha.day == 2:
        agregar_fila("GASTO", "Arriendo", rng.normal(5_800_000, 120_000), "Operaciones")
        agregar_fila("GASTO", "Arriendo", rng.normal(2_200_000, 60_000), "Administración")

    if fecha.day in (15, 28):
        agregar_fila("GASTO", "Nomina", rng.normal(5_200_000, 150_000), "Ventas")
        agregar_fila("GASTO", "Nomina", rng.normal(3_600_000, 100_000), "Operaciones")
        agregar_fila("GASTO", "Nomina", rng.normal(2_200_000, 80_000), "Administración")

    if fecha.day in (10, 18):
        agregar_fila("GASTO", "Servicios publicos", rng.normal(750_000, 60_000), "Operaciones")
        agregar_fila("GASTO", "Servicios publicos", rng.normal(250_000, 30_000), "Administración")

    if fecha.day in (12, 24):
        agregar_fila("GASTO", "Impuestos", rng.normal(4_000_000, 200_000), "Administración")

    return filas, contador


def _aplicar_suciedad(
    df: pd.DataFrame,
    rng: np.random.Generator,
    pct_nulos: float = 0.02,
    pct_duplicados: float = 0.01,
) -> pd.DataFrame:
    """Inyecta montos nulos (~2%) y filas duplicadas (~1%) sobre el lote."""
    df = df.copy()

    # ~2% de montos nulos
    mascara_nulos = rng.random(len(df)) < pct_nulos
    df.loc[mascara_nulos, "monto"] = np.nan

    # ~1% de filas duplicadas exactas
    n_duplicados = max(1, int(round(len(df) * pct_duplicados)))
    if len(df) > 0 and n_duplicados > 0:
        duplicados = df.sample(n=min(n_duplicados, len(df)), random_state=int(rng.integers(0, 1_000_000)))
        df = pd.concat([df, duplicados], ignore_index=True)

    # Mezclar orden para simular llegada desordenada a Bronze
    df = df.sample(frac=1.0, random_state=int(rng.integers(0, 1_000_000))).reset_index(drop=True)
    return df


def generar_historico(
    fecha_inicio: date = date(2024, 11, 1),
    fecha_fin: date = date(2026, 10, 31),
    seed: int = 42,
) -> pd.DataFrame:
    """Genera el dataset histórico completo (por defecto 24 meses)."""
    rng = np.random.default_rng(seed)
    todas_las_filas: list[dict] = []
    contador = 1

    actual = fecha_inicio
    while actual <= fecha_fin:
        filas_dia, contador = _generar_transacciones_dia(
            fecha=actual,
            rng=rng,
            prefijo_id=None,
            contador_inicial=contador,
        )
        todas_las_filas.extend(filas_dia)
        actual += timedelta(days=1)

    df = pd.DataFrame(todas_las_filas)
    return _aplicar_suciedad(df, rng)


def generar_dia(fecha: str | date, seed_base: int = 1000) -> pd.DataFrame:
    """Genera las transacciones crudas de un único día (uso incremental en Airflow)."""
    fecha_dt = (
        datetime.strptime(fecha, "%Y-%m-%d").date()
        if isinstance(fecha, str)
        else fecha
    )
    # Semilla determinista por fecha para garantizar reproducibilidad en reintentos
    seed_dia = seed_base + int(fecha_dt.strftime("%Y%m%d"))
    rng = np.random.default_rng(seed_dia)
    prefijo = f"T-{fecha_dt.strftime('%Y%m%d')}"

    filas, _ = _generar_transacciones_dia(
        fecha=fecha_dt,
        rng=rng,
        prefijo_id=prefijo,
        contador_inicial=1,
    )
    df = pd.DataFrame(filas)
    return _aplicar_suciedad(df, rng)


def cargar_bronze(
    df: pd.DataFrame,
    modo: Literal["replace", "append"] = "replace",
) -> tuple[bool, int, int]:
    """Carga un DataFrame a DATAFINANCE.BRONZE.TRANSACCIONES en Snowflake."""
    import snowflake.connector
    from snowflake.connector.pandas_tools import write_pandas

    load_dotenv()

    required = ["SNOWFLAKE_ACCOUNT", "SNOWFLAKE_USER", "SNOWFLAKE_PASSWORD"]
    faltantes = [var for var in required if not os.getenv(var)]
    if faltantes:
        raise EnvironmentError(
            f"Faltan variables de entorno en .env: {', '.join(faltantes)}"
        )

    conn = snowflake.connector.connect(
        account=os.environ["SNOWFLAKE_ACCOUNT"],
        user=os.environ["SNOWFLAKE_USER"],
        password=os.environ["SNOWFLAKE_PASSWORD"],
        role=os.getenv("SNOWFLAKE_ROLE", "ROL_DATAFINANCE"),
        warehouse=os.getenv("SNOWFLAKE_WAREHOUSE", "WH_DATAFINANCE"),
        database=os.getenv("SNOWFLAKE_DATABASE", "DATAFINANCE"),
        schema=os.getenv("SNOWFLAKE_SCHEMA", "BRONZE"),
    )

    try:
        df_subida = df.copy()
        df_subida.columns = [c.upper() for c in df_subida.columns]

        overwrite = modo == "replace"
        success, nchunks, nrows, _ = write_pandas(
            conn=conn,
            df=df_subida,
            table_name="TRANSACCIONES",
            database=os.getenv("SNOWFLAKE_DATABASE", "DATAFINANCE"),
            schema=os.getenv("SNOWFLAKE_SCHEMA", "BRONZE"),
            auto_create_table=True,
            overwrite=overwrite,
            quote_identifiers=False,
        )
        return bool(success), int(nchunks), int(nrows)
    finally:
        conn.close()


def imprimir_resumen_validacion(df: pd.DataFrame) -> None:
    """Imprime métricas de calidad y resumen mensual financiero para validación local."""
    total = len(df)
    nulos = int(df["monto"].isna().sum())
    duplicados = int(df.duplicated().sum())
    fechas_latam = int(df["fecha"].str.contains("/", na=False).sum())

    print("=== VALIDACIÓN DE SUCIEDAD CONTROLADA (BRONZE) ===")
    print(f"Total filas        : {total:,}")
    print(f"Montos nulos       : {nulos:,} ({nulos / total:.2%})")
    print(f"Filas duplicadas   : {duplicados:,} ({duplicados / total:.2%})")
    print(f"Fechas DD/MM/YYYY  : {fechas_latam:,} ({fechas_latam / total:.2%})")

    # Simulación de limpieza equivalente a Silver para validar calibración financiera
    limpio = df.drop_duplicates().copy()
    es_iso = limpio["fecha"].str.contains("-", na=False)
    limpio["fecha_dt"] = pd.NaT
    limpio.loc[es_iso, "fecha_dt"] = pd.to_datetime(limpio.loc[es_iso, "fecha"], format="%Y-%m-%d")
    limpio.loc[~es_iso, "fecha_dt"] = pd.to_datetime(limpio.loc[~es_iso, "fecha"], format="%d/%m/%Y")
    limpio["tipo_norm"] = limpio["tipo"].str.strip().str.upper()
    limpio["cat_norm"] = limpio["categoria"].str.strip().str.upper()
    limpio = limpio.dropna(subset=["monto"])
    limpio["mes"] = limpio["fecha_dt"].dt.to_period("M").astype(str)

    mensual = (
        limpio.pivot_table(
            index="mes",
            columns="tipo_norm",
            values="monto",
            aggfunc="sum",
            fill_value=0.0,
        )
        .rename(columns={"INGRESO": "ingresos", "GASTO": "gastos"})
    )
    mensual["utilidad"] = mensual["ingresos"] - mensual["gastos"]
    mensual["margen_%"] = (mensual["utilidad"] / mensual["ingresos"] * 100).round(2)

    print("\n=== RESUMEN MENSUAL (MILLONES COP) ===")
    vista_m = mensual.copy()
    for col in ("ingresos", "gastos", "utilidad"):
        vista_m[col] = (vista_m[col] / 1_000_000).round(2)
    print(vista_m.to_string())

    print("\n=== PROMEDIO MENSUAL POR CATEGORÍA (MILLONES COP, SIN ANOMALÍAS) ===")
    sin_anom = limpio[~limpio["mes"].isin(["2026-03", "2026-06", "2026-08"])]
    cat_mensual = (
        sin_anom.groupby(["mes", "tipo_norm", "cat_norm"])["monto"]
        .sum()
        .groupby(["tipo_norm", "cat_norm"])
        .mean()
        / 1_000_000
    ).round(2)
    print(cat_mensual.to_string())

    print("\n=== DETALLE MESES CON ANOMALÍA INYECTADA (MILLONES COP) ===")
    for mes_anom, cat_focus in [("2026-03", "MARKETING"), ("2026-08", "LOGISTICA")]:
        val = (
            limpio[(limpio["mes"] == mes_anom) & (limpio["cat_norm"] == cat_focus)]["monto"].sum()
            / 1_000_000
        )
        print(f"{mes_anom} | {cat_focus}: {val:.2f} M COP")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generador de datos DataFinance AI")
    parser.add_argument(
        "--modo",
        choices=["historico", "diario"],
        default="historico",
        help="Generar 24 meses históricos o un único día incremental.",
    )
    parser.add_argument(
        "--fecha",
        default=date.today().isoformat(),
        help="Fecha YYYY-MM-DD cuando --modo=diario.",
    )
    parser.add_argument(
        "--subir",
        action="store_true",
        help="Si se indica, sube el resultado a Snowflake (BRONZE.TRANSACCIONES).",
    )
    parser.add_argument(
        "--guardar-csv",
        default="data/bronze_transacciones.csv",
        help="Ruta local opcional para inspeccionar el CSV generado.",
    )
    args = parser.parse_args()

    if args.modo == "historico":
        df = generar_historico()
        modo_carga: Literal["replace", "append"] = "replace"
    else:
        df = generar_dia(args.fecha)
        modo_carga = "append"

    imprimir_resumen_validacion(df)

    if args.guardar_csv:
        ruta = Path(args.guardar_csv)
        ruta.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(ruta, index=False)
        print(f"\nCSV guardado en: {ruta}")

    if args.subir:
        ok, nchunks, nrows = cargar_bronze(df, modo=modo_carga)
        print(
            f"\nCarga a Snowflake ({modo_carga}) -> success={ok}, chunks={nchunks}, rows={nrows}"
        )


if __name__ == "__main__":
    main()
