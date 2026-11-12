"""Ejecutor de scripts SQL de DataFinance AI en Snowflake y verificador de capas."""

from __future__ import annotations

import argparse
import os
from pathlib import Path

import snowflake.connector
from dotenv import load_dotenv


def conectar_snowflake() -> snowflake.connector.SnowflakeConnection:
    """Abre una conexión a Snowflake usando las variables de .env."""
    load_dotenv(override=True)
    return snowflake.connector.connect(
        account=os.environ["SNOWFLAKE_ACCOUNT"],
        user=os.environ["SNOWFLAKE_USER"],
        password=os.environ["SNOWFLAKE_PASSWORD"],
        role=os.getenv("SNOWFLAKE_ROLE", "ROL_DATAFINANCE"),
        warehouse=os.getenv("SNOWFLAKE_WAREHOUSE", "WH_DATAFINANCE"),
        database=os.getenv("SNOWFLAKE_DATABASE", "DATAFINANCE"),
    )


def ejecutar_archivo_sql(conn: snowflake.connector.SnowflakeConnection, ruta: Path) -> list:
    """Ejecuta todas las sentencias SQL de un archivo en Snowflake."""
    sql_text = ruta.read_text(encoding="utf-8")
    cursores = conn.execute_string(sql_text)
    resultados = []
    for cur in cursores:
        if cur.description:
            resultados.append(cur.fetchall())
    return resultados


def imprimir_verificacion_capas(conn: snowflake.connector.SnowflakeConnection) -> None:
    """Consulta y muestra conteos de auditoría y KPIs Gold."""
    cur = conn.cursor()

    cur.execute("""
        SELECT
            (SELECT COUNT(*) FROM DATAFINANCE.BRONZE.TRANSACCIONES) AS bronze,
            (SELECT COUNT(*) FROM DATAFINANCE.SILVER.TRANSACCIONES) AS silver,
            (SELECT COUNT(*) FROM DATAFINANCE.SILVER.TRANSACCIONES_RECHAZADOS) AS rechazados
    """)
    bronze, silver, rechazados = cur.fetchone()
    print("=== AUDITORÍA BRONZE -> SILVER ===")
    print(f"Bronze     : {bronze:,}")
    print(f"Silver     : {silver:,}")
    print(f"Rechazados : {rechazados:,}")
    print(f"Cuadre     : {silver + rechazados:,} == {bronze:,} ({silver + rechazados == bronze})")

    cur.execute("""
        SELECT MOTIVO_RECHAZO, COUNT(*) AS CANTIDAD
        FROM DATAFINANCE.SILVER.TRANSACCIONES_RECHAZADOS
        GROUP BY MOTIVO_RECHAZO
        ORDER BY CANTIDAD DESC
    """)
    print("\n=== MOTIVOS DE RECHAZO ===")
    for motivo, cant in cur.fetchall():
        print(f"- {motivo}: {cant:,}")

    cur.execute("""
        SELECT
            ANIO_MES,
            ROUND(INGRESOS / 1e6, 2) AS INGRESOS_M,
            ROUND(GASTOS / 1e6, 2) AS GASTOS_M,
            ROUND(UTILIDAD / 1e6, 2) AS UTILIDAD_M,
            MARGEN_PCT,
            VAR_INGRESOS_PCT,
            VAR_GASTOS_PCT
        FROM DATAFINANCE.GOLD.KPI_MENSUAL
        ORDER BY MES
    """)
    print("\n=== GOLD.KPI_MENSUAL (MILLONES COP) ===")
    print(f"{'MES':<8} {'ING_M':>8} {'GAS_M':>8} {'UTIL_M':>8} {'MARG%':>7} {'VAR_ING%':>9} {'VAR_GAS%':>9}")
    for row in cur.fetchall():
        mes, ing, gas, util, marg, ving, vgas = row
        ving_s = f"{ving:>8.2f}%" if ving is not None else "      N/A"
        vgas_s = f"{vgas:>8.2f}%" if vgas is not None else "      N/A"
        print(f"{mes:<8} {ing:>8.2f} {gas:>8.2f} {util:>8.2f} {marg:>6.2f}% {ving_s} {vgas_s}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Ejecuta SQLs de Silver/Gold en Snowflake")
    parser.add_argument(
        "archivos",
        nargs="*",
        default=[
            "airflow/dags/sql/silver_transacciones.sql",
            "airflow/dags/sql/validar_silver.sql",
            "airflow/dags/sql/gold_kpi_mensual.sql",
        ],
        help="Archivos .sql a ejecutar en orden.",
    )
    args = parser.parse_args()

    conn = conectar_snowflake()
    try:
        for archivo in args.archivos:
            ruta = Path(archivo)
            print(f"Ejecutando {ruta}...")
            res = ejecutar_archivo_sql(conn, ruta)
            if ruta.name == "validar_silver.sql":
                valido = bool(res and res[-1] and res[-1][0][0])
                print(f"Validación Silver: {'OK (TRUE)' if valido else 'FALLÓ'}")
                if not valido:
                    raise SystemExit("La validación de Silver falló; abortando.")
        imprimir_verificacion_capas(conn)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
