"""DAG de generación de reportes ejecutivos con Snowflake Cortex.

Se mantiene separado y en ejecución manual (schedule=None) para controlar
el consumo de créditos de modelos generativos.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from airflow import DAG
from airflow.providers.common.sql.operators.sql import SQLExecuteQueryOperator

default_args = {
    "owner": "datafinance",
    "retries": 1,
    "retry_delay": timedelta(minutes=2),
    "execution_timeout": timedelta(minutes=10),
}

with DAG(
    dag_id="datafinance_reporte",
    description="Redacta reporte financiero ejecutivo con Snowflake Cortex sobre KPIs Gold",
    start_date=datetime(2026, 11, 1),
    schedule=None,
    catchup=False,
    max_active_runs=1,
    default_args=default_args,
    template_searchpath=["/opt/airflow/dags/sql"],
    tags=["datafinance", "reporte", "cortex"],
) as dag:
    generar_reporte_llm = SQLExecuteQueryOperator(
        task_id="generar_reporte_llm",
        conn_id="snowflake_default",
        sql="reporte.sql",
    )
