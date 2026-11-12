# Arquitectura de DataFinance AI

## 1. Visión general y principio rector

**DataFinance AI** es la plataforma de análisis financiero de **Distribuidora del Caribe S.A.S.** (Barranquilla, moneda `COP`).

Su principio rector es **«SQL calcula; la IA explica»**:
- Toda cifra, suma, margen, variación mensual y detección estadística se calcula de forma reproducible en **Snowflake**.
- Los modelos generativos (**Snowflake AISQL `AI_AGG`** para reportes por lotes y **Groq `openai/gpt-oss-120b`** para consultas ad-hoc en lenguaje natural) nunca inventan ni recalculan métricas: únicamente traducen preguntas autorizadas a `SELECT` de solo lectura y redactan explicaciones sobre resultados devueltos por Snowflake.

## 2. Flujo de componentes

```text
[Python: generar_dataset.py]
    │  Genera datos sintéticos (24 meses + suciedad controlada + anomalías)
    ▼
[Apache Airflow en Docker (:8082)]
    ├── DAG datafinance_etl (@daily, catchup=False)
    │     1. generar_y_cargar_bronze (append idempotente)
    │     2. transformar_silver       -> SILVER.TRANSACCIONES + SILVER.TRANSACCIONES_RECHAZADOS
    │     3. validar_silver           -> SQLCheckOperator (detiene pipeline si falla)
    │     4. construir_gold           -> GOLD.KPI_MENSUAL, KPI_CATEGORIA_MENSUAL, KPI_AREA_MENSUAL
    │     5. detectar_anomalias       -> GOLD.ANOMALIAS (Z-Score >= 2.5 sobre meses completos)
    │
    └── DAG datafinance_reporte (schedule=None, manual / bajo demanda)
          └── generar_reporte_llm     -> GOLD.REPORTES vía Snowflake AI_AGG
    │
    ▼
[Snowflake (WH_DATAFINANCE XSMALL · ROL_DATAFINANCE)]
    │  Almacenamiento Medallion + ejecución SQL + AISQL
    ▼
[FastAPI (:8002)] ◄──── Validador SQL solo lectura (backend/sql_guard.py) + Groq analyst
    │
    ▼
[React + Vite + Tailwind CSS v4 + Plotly.js (:5173)]
```

## 3. Decisiones técnicas sustentadas

1. **Arquitectura Medallion real en Snowflake (`BRONZE` → `SILVER` → `GOLD`)**:
   - Bronze conserva las fechas mixtas (`YYYY-MM-DD` y `DD/MM/YYYY`), textos con espacios/mayúsculas mixtas, montos nulos (~2%) y duplicados (~1%).
   - Silver depura y registra cada fila descartada en `TRANSACCIONES_RECHAZADOS` con su `MOTIVO_RECHAZO` para evitar pérdidas silenciosas.
   - Gold expone KPIs precalculados con `LAG()` y división segura para el frontend y el agente.
2. **Separación de DAG ETL vs DAG de reportes IA**:
   - `datafinance_etl` no invoca LLMs en cada ciclo diario; `datafinance_reporte` corre con `schedule=None` para controlar créditos y costo de inferencia.
3. **Analista híbrido con Groq (`openai/gpt-oss-120b`) + Guardián SQL**:
   - En cuentas trial de Snowflake donde `CORTEX.COMPLETE` o `CORTEX.ANALYST` están restringidos, FastAPI actúa como puente controlado: Groq genera una única consulta `SELECT`/`WITH`, [sql_guard.py](file:///home/cohorte5/Escritorio/proyecto%20/backend/sql_guard.py) bloquea cualquier comando de escritura, esquemas del sistema (`INFORMATION_SCHEMA`, `SNOWFLAKE.*`) o acceso a `BRONZE`, y ejecuta bajo `ROL_DATAFINANCE`.
4. **Mes parcial excluido por defecto de agregaciones globales y anomalías**:
   - Los meses con fecha máxima inferior al día 28 (`DAY(MAX(FECHA)) < 28`) se excluyen de `GOLD.ANOMALIAS` y del filtro por defecto del dashboard para evitar falsos positivos de caída de ingresos al iniciar un mes.
