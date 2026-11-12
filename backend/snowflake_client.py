"""Cliente centralizado y seguro de lectura para Snowflake."""

from __future__ import annotations

import os
from datetime import date, datetime
from decimal import Decimal
from typing import Any

import snowflake.connector
from dotenv import load_dotenv


def _serializar_valor(valor: Any) -> Any:
    """Convierte tipos de Snowflake (Decimal, date, datetime) a JSON válido."""
    if isinstance(valor, Decimal):
        return float(valor)
    if isinstance(valor, (datetime, date)):
        return valor.isoformat()
    return valor


def get_snowflake_connection() -> snowflake.connector.SnowflakeConnection:
    """Crea una conexión usando ROL_DATAFINANCE (nunca ACCOUNTADMIN)."""
    load_dotenv(override=True)
    required = ["SNOWFLAKE_ACCOUNT", "SNOWFLAKE_USER", "SNOWFLAKE_PASSWORD"]
    faltantes = [k for k in required if not os.getenv(k)]
    if faltantes:
        raise RuntimeError(
            f"Faltan variables de Snowflake en .env: {', '.join(faltantes)}"
        )

    role = os.getenv("SNOWFLAKE_ROLE", "ROL_DATAFINANCE")
    if role.strip().upper() == "ACCOUNTADMIN":
        raise RuntimeError("Por seguridad, la aplicación no debe usar ACCOUNTADMIN.")

    return snowflake.connector.connect(
        account=os.environ["SNOWFLAKE_ACCOUNT"],
        user=os.environ["SNOWFLAKE_USER"],
        password=os.environ["SNOWFLAKE_PASSWORD"],
        role=role,
        warehouse=os.getenv("SNOWFLAKE_WAREHOUSE", "WH_DATAFINANCE"),
        database=os.getenv("SNOWFLAKE_DATABASE", "DATAFINANCE"),
        schema=os.getenv("SNOWFLAKE_SCHEMA", "GOLD"),
    )


def query_dicts(sql: str, params: tuple | list | None = None) -> tuple[list[str], list[dict[str, Any]]]:
    """Ejecuta una consulta SELECT parametrizada y retorna columnas + lista de dicts."""
    conn = get_snowflake_connection()
    try:
        cur = conn.cursor()
        try:
            if params:
                cur.execute(sql, params)
            else:
                cur.execute(sql)
            columns = [desc[0] for desc in (cur.description or [])]
            rows = [
                {
                    col: _serializar_valor(val)
                    for col, val in zip(columns, raw_row)
                }
                for raw_row in cur.fetchall()
            ]
            return columns, rows
        finally:
            cur.close()
    finally:
        conn.close()
