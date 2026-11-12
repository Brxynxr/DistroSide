"""DAG principal ETL de DataFinance AI.

Orquesta la ingesta incremental diaria a Bronze y delega en Snowflake
las transformaciones Silver, validación de calidad, capa Gold y detección
estadística de anomalías.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.providers.common.sql.operators.sql import (
    SQLCheckOperator,
    SQLExecuteQueryOperator,
)
from airflow.providers.snowflake.hooks.snowflake import SnowflakeHook

logger = logging.getLogger(__name__)

default_args = {
    "owner": "datafinance",
    "retries": 2,
    "retry_delay": timedelta(minutes=2),
    "execution_timeout": timedelta(minutes=15),
}


def generar_y_cargar_bronze(ds: str, **_context) -> dict:
    """Genera las transacciones del día lógico (ds) y las carga de forma idempotente a Bronze."""
    from scripts.generar_dataset import cargar_bronze, generar_dia

    df_dia = generar_dia(fecha=ds)
    prefijo = f"T-{ds.replace('-', '')}-"

    hook = SnowflakeHook(snowflake_conn_id="snowflake_default")
    conn = hook.get_conn()
    try:
        ok, nchunks, nrows = cargar_bronze(
            df_dia,
            modo="append",
            conn=conn,
            prefijo_idempotente=prefijo,
        )
    finally:
        conn.close()

    if not ok:
        raise RuntimeError(f"La carga a Bronze falló para la fecha {ds}")

    logger.info("Bronze actualizado | fecha=%s | filas=%s | chunks=%s", ds, nrows, nchunks)
    return {"fecha": ds, "filas_cargadas": nrows, "chunks": nchunks}


with DAG(
    dag_id="datafinance_etl",
    description="Pipeline diario Bronze -> Silver -> Validación -> Gold -> Anomalías en Snowflake",
    start_date=datetime(2026, 11, 1),
    schedule="@daily",
    catchup=False,
    max_active_runs=1,
    default_args=default_args,
    template_searchpath=["/opt/airflow/dags/sql"],
    tags=["datafinance", "etl", "snowflake"],
) as dag:
    cargar_bronze_task = PythonOperator(
        task_id="generar_y_cargar_bronze",
        python_callable=generar_y_cargar_bronze,
    )

    transformar_silver = SQLExecuteQueryOperator(
        task_id="transformar_silver",
        conn_id="snowflake_default",
        sql="silver_transacciones.sql",
    )

    validar_silver = SQLCheckOperator(
        task_id="validar_silver",
        conn_id="snowflake_default",
        sql="validar_silver.sql",
    )

    construir_gold = SQLExecuteQueryOperator(
        task_id="construir_gold",
        conn_id="snowflake_default",
        sql="gold_kpi_mensual.sql",
    )

    detectar_anomalias = SQLExecuteQueryOperator(
        task_id="detectar_anomalias",
        conn_id="snowflake_default",
        sql="anomalias.sql",
    )

    cargar_bronze_task >> transformar_silver >> validar_silver >> construir_gold >> detectar_anomalias
