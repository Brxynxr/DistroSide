# DataFinance AI — Distribuidora del Caribe S.A.S.

Plataforma académica de análisis financiero sobre **Snowflake (Medallion Bronze/Silver/Gold)**, orquestada con **Apache Airflow en Docker**, backend en **FastAPI**, analista en lenguaje natural con **Groq (`openai/gpt-oss-120b`)** + **Snowflake AISQL (`AI_AGG`)**, y frontend en **React + Tailwind CSS v4 + Plotly.js**.

> **Principio rector:** *SQL calcula; la IA explica.* Toda cifra financiera proviene de consultas reproducibles en Snowflake; los modelos de IA no recalculan ni inventan indicadores.

---

## Estructura del proyecto

- `scripts/`
  - [`generar_dataset.py`](scripts/generar_dataset.py): generador sintético reproducible (24 meses + carga incremental diaria idempotente) y cargador hacia `BRONZE.TRANSACCIONES`.
  - [`ejecutar_sql.py`](scripts/ejecutar_sql.py): ejecutor CLI de archivos SQL sobre Snowflake.
  - [`evaluar_agente.py`](scripts/evaluar_agente.py): benchmark automático de 16 preguntas contra Snowflake + Groq.
- `airflow/`
  - [`dags/datafinance_etl.py`](airflow/dags/datafinance_etl.py): pipeline diario `Bronze → Silver → Validación → Gold → Anomalías`.
  - [`dags/datafinance_reporte.py`](airflow/dags/datafinance_reporte.py): DAG manual (`schedule=None`) de redacción ejecutiva con `AI_AGG`.
  - `dags/sql/`: transformaciones y validaciones SQL ejecutadas en Snowflake.
- `backend/`
  - [`main.py`](backend/main.py): API REST (`/api/health`, `/api/kpis`, `/api/anomalias`, `/api/auditoria`, `/api/chat`, `/api/reportes*`).
  - [`sql_guard.py`](backend/sql_guard.py): validador estricto de solo lectura (`SELECT`/`WITH`) restringido a `GOLD.*` y `SILVER.TRANSACCIONES`.
  - [`groq_analyst.py`](backend/groq_analyst.py): cliente Groq para Text-to-SQL validado y explicación en español.
- `frontend/`: aplicación React 18 + Vite + Tailwind CSS v4 + Plotly.js siguiendo [`MASTER.md`](design-system/datafinance-ai/MASTER.md).
- `tests/`: pruebas unitarias con `pytest` (`test_generator.py`, `test_data_quality.py`, `test_financial_rules.py`).
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
3. Levanta Airflow en Docker (`http://localhost:8082`):
   ```bash
   docker compose up -d
   ```
4. Levanta el backend FastAPI (`http://127.0.0.1:8002`) y el frontend React (`http://127.0.0.1:5173`):
   ```bash
   .venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8002
   cd frontend && npm install && npm run dev
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
