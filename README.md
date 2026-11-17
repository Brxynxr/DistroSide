# DataFinance AI — Distribuidora del Caribe S.A.S.

Plataforma académica de análisis financiero sobre **Snowflake (`DATAFINANCE.PUBLIC`)**, ejecutor SQL directo en Python, backend en **FastAPI** con generación de reportes ejecutivos en PDF (**ReportLab**), analista Text-to-SQL en lenguaje natural con **Groq (`openai/gpt-oss-120b`)** + **Snowflake AISQL (`AI_AGG`)**, y frontend interactivo en **React + Tailwind CSS v4 + Plotly.js**.

> **Principio rector:** *SQL calcula; la IA explica.* Toda cifra financiera proviene de consultas reproducibles en Snowflake; los modelos de IA no recalculan ni inventan indicadores.

---

## Estructura del proyecto

- `scripts/`
  - [`cierre_mensual.py`](scripts/cierre_mensual.py): orquestador CLI del Cierre Financiero Mensual Automatizado y compilación del Executive Pack.
  - [`centinela_semanal.py`](scripts/centinela_semanal.py): monitor preventivo semanal de sobrecostos operativos y proyección de fin de mes.
  - [`cuadre_diario.py`](scripts/cuadre_diario.py): cuadre diario de recaudo al cierre de ruta y monitoreo de liquidez (Contado vs Crédito).
  - [`generar_dataset.py`](scripts/generar_dataset.py): generador sintético reproducible (24 meses + carga incremental diaria idempotente).
  - [`ejecutar_sql.py`](scripts/ejecutar_sql.py): ejecutor CLI de scripts DDL/DML y verificador de integridad en Snowflake.
  - [`evaluar_agente.py`](scripts/evaluar_agente.py): benchmark automático de 16 preguntas de negocio contra Snowflake + Groq.
- `snowflake/sql/`
  - [`schema.sql`](snowflake/sql/schema.sql): definición del esquema consolidado (`PUBLIC.TRANSACCIONES`, `KPI_MENSUAL`, `AUDITORIA_CIERRES`, `ALERTAS_CENTINELA`, `CUADRE_DIARIO_LIQUIDEZ`, vistas y tablas de soporte).
  - [`cierre_mensual.sql`](snowflake/sql/cierre_mensual.sql): recálculo integral de KPIs mensuales, ventanas, variaciones y detección de anomalías para cierre de periodo.
  - [`centinela_semanal.sql`](snowflake/sql/centinela_semanal.sql): cálculo de ritmo de gasto semanal (Run-Rate) y proyección analítica frente a promedios históricos.
  - [`cuadre_diario.sql`](snowflake/sql/cuadre_diario.sql): auditoría diaria de ventas, ratios de efectivo vs crédito y clasificación de liquidez.
  - [`anomalias.sql`](snowflake/sql/anomalias.sql): detección estadística de anomalías (Z-Score sobre meses completos).
  - [`reporte.sql`](snowflake/sql/reporte.sql): generación de narrativas ejecutivas con Snowflake `AI_AGG`.
- `backend/`
  - [`main.py`](backend/main.py): API REST (`/api/health`, `/api/kpis`, `/api/anomalias`, `/api/auditoria`, `/api/chat`, `/api/reportes*`, `/api/automation/*`).
  - [`monthly_closing.py`](backend/monthly_closing.py): motor orquestador del cierre financiero mensual con idempotencia, persistencia y almacenamiento local.
  - [`weekly_sentinel.py`](backend/weekly_sentinel.py): motor Centinela para alerta temprana de sobrecostos, aislamiento causal y diagnóstico preventivo con IA.
  - [`daily_reconciliation.py`](backend/daily_reconciliation.py): motor de cuadre diario de ventas, ratios de recaudo y dictamen ejecutivo de tesorería.
  - [`sql_guard.py`](backend/sql_guard.py): validador estricto de solo lectura (`SELECT`/`WITH`) restringido a `DATAFINANCE.PUBLIC.*`.
  - [`groq_analyst.py`](backend/groq_analyst.py): cliente Groq para Text-to-SQL validado y explicación financiera en español.
  - [`report_pdf.py`](backend/report_pdf.py): motor generador de informes ejecutivos en formato PDF profesional con ReportLab.
- `frontend/`: aplicación React 18 + Vite + Tailwind CSS v4 + Plotly.js con panel de Cuadre Diario, widget Centinela y módulo de Cierre Mensual con descarga de Executive Pack en PDF.
- `tests/`: 46 pruebas unitarias con `pytest` (`test_generator.py`, `test_data_quality.py`, `test_financial_rules.py`, `test_monthly_closing.py`, `test_weekly_sentinel.py`, `test_daily_reconciliation.py`).
- `docs/`: [`architecture.md`](docs/architecture.md) y [`data_dictionary.md`](docs/data_dictionary.md).

---

## Configuración inicial

1. Copia el archivo de ejemplo y completa tus credenciales reales en `.env` (nunca versiones `.env`):
   ```bash
   cp .env.example .env
   ```
2. Crea e instala dependencias Python en `.venv`:
   ```bash
   python3 -m venv .venv
   .venv/bin/pip install -r requirements.txt
   ```
3. Ejecutar transformaciones SQL en Snowflake si se requiere reprocesar:
   ```bash
   .venv/bin/python scripts/ejecutar_sql.py
   ```
4. Levanta el backend FastAPI (`http://127.0.0.1:8002`) y el frontend React (`http://127.0.0.1:5173`):
   ```bash
   .venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8002
   cd frontend && npm install && npm run dev
   ```

---

## Automatización: Cierre Financiero Mensual ("Executive Pack")

El pipeline de cierre mensual puede dispararse vía CLI, cron o a través de la interfaz web:

```bash
# 1. Cierre automático del último mes completo
.venv/bin/python scripts/cierre_mensual.py

# 2. Cierre de un mes específico con recálculo forzado
.venv/bin/python scripts/cierre_mensual.py --mes 2026-10 --forzar

# 3. Ver bitácora histórica de cierres auditados
.venv/bin/python scripts/cierre_mensual.py --historial
```

---

## Automatización: Centinela Semanal de Sobrecostos Operativos

El Centinela evalúa el ritmo de consumo semanal (Run-Rate) para emitir alertas preventivas:

```bash
# 1. Evaluación semanal del mes en curso
.venv/bin/python scripts/centinela_semanal.py

# 2. Evaluación de un periodo específico con desglose de causas
.venv/bin/python scripts/centinela_semanal.py --mes 2026-08

# 3. Consultar bitácora de alertas activas
.venv/bin/python scripts/centinela_semanal.py --historial --solo-activas
```

---

## Automatización: Cuadre Diario de Ventas y Monitoreo de Liquidez

Auditoría diaria al cierre de ruta para asegurar solvencia operativa (Venta Contado vs. Crédito):

```bash
# 1. Cuadre del último día con ventas registradas
.venv/bin/python scripts/cuadre_diario.py

# 2. Cuadre de una fecha específica (ej. demostración de riesgo crítico de liquidez)
.venv/bin/python scripts/cuadre_diario.py --fecha 2026-10-04

# 3. Bitácora histórica de cierres de caja auditados
.venv/bin/python scripts/cuadre_diario.py --historial
```

---

## Pruebas y evaluación

```bash
# Pruebas unitarias (generador, calidad Silver, seguridad SQL, reglas financieras)
.venv/bin/python -m pytest -v tests/

# Evaluación de 16 preguntas en lenguaje natural (requiere Snowflake + GROQ_API_KEY)
.venv/bin/python scripts/evaluar_agente.py

# Build de producción del frontend
cd frontend && npm run build
```
