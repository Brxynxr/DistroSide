# Arquitectura de DataFinance AI

## 1. Visión general y principio rector

**DataFinance AI** es la plataforma de análisis financiero de **Distribuidora del Caribe S.A.S.** (Barranquilla, moneda `COP`).

Su principio rector es **«SQL calcula; la IA explica»**:
- Toda cifra, suma, margen, variación mensual y detección estadística se calcula de forma reproducible en **Snowflake**.
- Los modelos generativos (**Snowflake AISQL `AI_AGG`** para reportes por lotes y **Groq `openai/gpt-oss-120b`** para consultas ad-hoc en lenguaje natural) nunca inventan ni recalculan métricas: únicamente traducen preguntas autorizadas a `SELECT` de solo lectura y redactan explicaciones sobre resultados devueltos por Snowflake.

## 2. Flujo de componentes

```text
[Snowflake: DATAFINANCE.PUBLIC (WH_DATAFINANCE XSMALL · ROL_DATAFINANCE)]
    ├── TRANSACCIONES: 37,391 registros limpios, deduplicados y tipados
    ├── KPI_MENSUAL: 25 meses históricos con ingresos, gastos, utilidad y variaciones
    ├── KPI_CATEGORIA_MENSUAL: Vista analítica agrupada por categoría
    ├── KPI_AREA_MENSUAL: Vista analítica agrupada por área
    ├── ANOMALIAS: 10 anomalías detectadas por Z-score y ratios atípicos
    └── REPORTES: Historial de informes ejecutivos redactados
    ▼
[FastAPI (:8002)]
    ├── Consultas analíticas seguras y directas a Snowflake
    ├── Validador SQL solo lectura (backend/sql_guard.py)
    ├── Analista Text-to-SQL con Groq (openai/gpt-oss-120b)
    └── Generador de Reportes Ejecutivos PDF con ReportLab (backend/report_pdf.py)
    ▼
[React + Vite + Tailwind CSS v4 + Plotly.js (:5173)]
    ├── Dashboard interactivo (KPIs, Plotly Spline / Bars / Donut)
    ├── Chat Text-to-SQL con trazabilidad de consultas
    ├── Módulo de Anomalías clasificadas
    └── Descarga instantánea de Reportes en PDF ejecutivo
```

## 3. Decisiones técnicas sustentadas

1. **Consolidación en Esquema Limpio Único (`DATAFINANCE.PUBLIC`)**:
   - Una vez concluida la ingestión inicial y la validación de las reglas de depuración de calidad de datos, se consolidaron los datos en una única capa limpia (`DATAFINANCE.PUBLIC`), eliminando la sobrecarga de múltiples esquemas intermedios y contenedores pesados de Airflow/PostgreSQL.
   - El 100% de los datos consumidos por la API y los modelos de IA son limpios, consistentes y trazables.
2. **Generación de Reportes Ejecutivos en PDF (ReportLab)**:
   - Los informes redactados por IA ya no saturan la interfaz con texto crudo. Se entregan directamente en formato PDF corporativo con doble pasada (`Página X de Y`), scorecard de KPIs, desglose por categorías y tablas estilizadas.
3. **Analista Text-to-SQL con Groq (`openai/gpt-oss-120b`) + Guardián SQL**:
   - FastAPI actúa como orquestador seguro: Groq traduce preguntas de negocio a una única consulta `SELECT`/`WITH` sobre `DATAFINANCE.PUBLIC.*`. El guardián [sql_guard.py](file:///home/cohorte5/Escritorio/proyecto%20/backend/sql_guard.py) bloquea cualquier comando destructivo, inyecciones, o acceso a esquemas no autorizados.
4. **Mes parcial excluido por defecto de agregaciones globales y anomalías**:
   - Los meses con fecha máxima inferior al día 28 se marcan como mes parcial (`ES_COMPLETO = FALSE`) para evitar falsos positivos de caídas de ingresos o variaciones distorsionadas al inicio de un mes.
