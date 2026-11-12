"""Cliente centralizado y seguro de lectura para Snowflake con pool de conexiones."""

from __future__ import annotations

import os
import queue
import threading
from datetime import date, datetime
from decimal import Decimal
from typing import Any

import snowflake.connector
from dotenv import load_dotenv

_POOL_MAX_SIZE = 4
_pool: queue.LifoQueue[snowflake.connector.SnowflakeConnection] = queue.LifoQueue(
    maxsize=_POOL_MAX_SIZE
)
_env_lock = threading.Lock()
_env_loaded = False


def _serializar_valor(valor: Any) -> Any:
    """Convierte tipos de Snowflake (Decimal, date, datetime) a JSON válido."""
    if isinstance(valor, Decimal):
        return float(valor)
    if isinstance(valor, (datetime, date)):
        return valor.isoformat()
    return valor


def _ensure_env() -> None:
    global _env_loaded
    if not _env_loaded:
        with _env_lock:
            if not _env_loaded:
                load_dotenv(override=True)
                _env_loaded = True


def get_snowflake_connection() -> snowflake.connector.SnowflakeConnection:
    """Crea una conexión usando ROL_DATAFINANCE (nunca ACCOUNTADMIN)."""
    _ensure_env()
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


def _acquire_connection() -> snowflake.connector.SnowflakeConnection:
    while True:
        try:
            conn = _pool.get_nowait()
        except queue.Empty:
            return get_snowflake_connection()
        try:
            if not conn.is_closed():
                return conn
        except Exception:
            pass


def _release_connection(conn: snowflake.connector.SnowflakeConnection, broken: bool = False) -> None:
    if broken:
        try:
            conn.close()
        except Exception:
            pass
        return
    try:
        if conn.is_closed():
            return
        _pool.put_nowait(conn)
    except queue.Full:
        try:
            conn.close()
        except Exception:
            pass


def _ejecutar_en_conexion(
    conn: snowflake.connector.SnowflakeConnection,
    sql: str,
    params: tuple | list | None = None,
) -> tuple[list[str], list[dict[str, Any]]]:
    cur = conn.cursor()
    try:
        if params:
            cur.execute(sql, params)
        else:
            cur.execute(sql)
        columns = [desc[0] for desc in (cur.description or [])]
        rows = [
            {col: _serializar_valor(val) for col, val in zip(columns, raw_row)}
            for raw_row in cur.fetchall()
        ]
        return columns, rows
    finally:
        cur.close()


def query_dicts(sql: str, params: tuple | list | None = None) -> tuple[list[str], list[dict[str, Any]]]:
    """Ejecuta una consulta SELECT parametrizada reutilizando conexiones activas del pool."""
    conn = _acquire_connection()
    try:
        result = _ejecutar_en_conexion(conn, sql, params)
        _release_connection(conn)
        return result
    except snowflake.connector.errors.Error:
        # Reintenta una vez con una conexión nueva si la sesión del pool expiró
        _release_connection(conn, broken=True)
        conn_fresh = get_snowflake_connection()
        try:
            result = _ejecutar_en_conexion(conn_fresh, sql, params)
            _release_connection(conn_fresh)
            return result
        except Exception:
            _release_connection(conn_fresh, broken=True)
            raise
    except Exception:
        _release_connection(conn, broken=True)
        raise
