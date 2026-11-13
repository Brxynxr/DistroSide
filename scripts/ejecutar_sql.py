"""Ejecutor de scripts SQL de DataFinance AI en Snowflake y verificador del esquema consolidado."""

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
        schema=os.getenv("SNOWFLAKE_SCHEMA", "PUBLIC"),
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


def imprimir_verificacion_snowflake(conn: snowflake.connector.SnowflakeConnection) -> None:
    """Consulta y muestra conteos de integridad y KPIs en DATAFINANCE.PUBLIC."""
    cur = conn.cursor()

    cur.execute("""
        SELECT
            COUNT(*) AS total,
            COUNT(DISTINCT ID_TRANSACCION) AS ids_unicos,
            MIN(FECHA) AS fecha_min,
            MAX(FECHA) AS fecha_max
        FROM DATAFINANCE.PUBLIC.TRANSACCIONES
    """)
    total, unicos, fmin, fmax = cur.fetchone()
    print("=== AUDITORÍA E INTEGRIDAD (DATAFINANCE.PUBLIC.TRANSACCIONES) ===")
    print(f"Total registros : {total:,}")
    print(f"IDs únicos      : {unicos:,} (100% únicos: {total == unicos})")
    print(f"Rango de fechas : {fmin} -> {fmax}")

    cur.execute("""
        SELECT TIPO, COUNT(*) AS CANTIDAD, ROUND(SUM(MONTO) / 1e6, 2) AS TOTAL_MILLONES
        FROM DATAFINANCE.PUBLIC.TRANSACCIONES
        GROUP BY TIPO
        ORDER BY TIPO
    """)
    print("\n=== DISTRIBUCIÓN POR TIPO ===")
    for tipo, cant, total_m in cur.fetchall():
        print(f"- {tipo:<8}: {cant:,} transacciones | ${total_m:,.2f}M COP")

    cur.execute("""
        SELECT
            ANIO_MES,
            ROUND(INGRESOS / 1e6, 2) AS INGRESOS_M,
            ROUND(GASTOS / 1e6, 2) AS GASTOS_M,
            ROUND(UTILIDAD / 1e6, 2) AS UTILIDAD_M,
            MARGEN_PCT,
            VAR_INGRESOS_PCT,
            VAR_GASTOS_PCT
        FROM DATAFINANCE.PUBLIC.KPI_MENSUAL
        ORDER BY MES
    """)
    print("\n=== PUBLIC.KPI_MENSUAL (MILLONES COP) ===")
    print(f"{'MES':<8} {'ING_M':>8} {'GAS_M':>8} {'UTIL_M':>8} {'MARG%':>7} {'VAR_ING%':>9} {'VAR_GAS%':>9}")
    for row in cur.fetchall():
        mes, ing, gas, util, marg, ving, vgas = row
        ving_s = f"{ving:>8.2f}%" if ving is not None else "      N/A"
        vgas_s = f"{vgas:>8.2f}%" if vgas is not None else "      N/A"
        print(f"{mes:<8} {ing:>8.2f} {gas:>8.2f} {util:>8.2f} {marg:>6.2f}% {ving_s} {vgas_s}")

    cur.execute("""
        SELECT COUNT(*) FROM DATAFINANCE.PUBLIC.ANOMALIAS
    """)
    anomalias_count = cur.fetchone()[0]
    cur.execute("""
        SELECT COUNT(*) FROM DATAFINANCE.PUBLIC.REPORTES
    """)
    reportes_count = cur.fetchone()[0]
    print(f"\nAnomalías detectadas registradas: {anomalias_count}")
    print(f"Reportes ejecutivos almacenados : {reportes_count}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Ejecuta SQLs sobre DATAFINANCE.PUBLIC en Snowflake")
    parser.add_argument(
        "archivos",
        nargs="*",
        default=[
            "snowflake/sql/schema.sql",
            "snowflake/sql/anomalias.sql",
        ],
        help="Archivos .sql a ejecutar en orden.",
    )
    args = parser.parse_args()

    conn = conectar_snowflake()
    try:
        for archivo in args.archivos:
            ruta = Path(archivo)
            print(f"Ejecutando {ruta}...")
            ejecutar_archivo_sql(conn, ruta)
            print(f"Ejecución completada: {ruta.name}")
        imprimir_verificacion_snowflake(conn)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
