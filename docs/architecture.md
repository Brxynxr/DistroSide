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
    ├── REPORTES: Historial de informes ejecutivos redactados
    ├── AUDITORIA_CIERRES: Bitácora de cierres mensuales y trazabilidad de Executive Packs
    ├── ALERTAS_CENTINELA: Registro de alertas tempranas de sobrecosto por Run-Rate
    └── CUADRE_DIARIO_LIQUIDEZ: Bitácora diaria de recaudo comercial (Contado vs Crédito)
    ▼
[FastAPI (:8002)]
    ├── Consultas analíticas seguras y directas a Snowflake
    ├── Validador SQL solo lectura (backend/sql_guard.py)
    ├── Analista Text-to-SQL con Groq (openai/gpt-oss-120b)
    ├── Generador de Reportes Ejecutivos PDF con ReportLab (backend/report_pdf.py)
    ├── Motor de Cierre Mensual Automatizado (backend/monthly_closing.py)
    ├── Motor Centinela de Sobrecostos Operativos (backend/weekly_sentinel.py)
    └── Motor de Cuadre Diario y Liquidez de Tesorería (backend/daily_reconciliation.py)
    ▼
[React + Vite + Tailwind CSS v4 + Plotly.js (:5173)]
    ├── Dashboard con Widget Centinela de Sobrecostos y Panel de Cuadre Diario
    ├── Chat Text-to-SQL con trazabilidad de consultas
    ├── Módulo de Anomalías clasificadas
    ├── Módulo de Cierre Mensual Automatizado y Bitácora
    └── Descarga instantánea de Reportes y Executive Packs en PDF
```

## 3. Decisiones técnicas sustentadas

1. **Consolidación en Esquema Limpio Único (`DATAFINANCE.PUBLIC`)**:
   - Una vez concluida la ingestión inicial y la validación de las reglas de depuración de calidad de datos, se consolidaron los datos en una única capa limpia (`DATAFINANCE.PUBLIC`), eliminando la sobrecarga de múltiples esquemas intermedios y contenedores pesados de Airflow/PostgreSQL.
   - El 100% de los datos consumidos por la API y los modelos de IA son limpios, consistentes y trazables.
2. **Generación de Reportes Ejecutivos en PDF (ReportLab)**:
   - Los informes redactados por IA ya no saturan la interfaz con texto crudo. Se entregan directamente en formato PDF corporativo con doble pasada (`Página X de Y`), scorecard de KPIs, desglose por categorías y tablas estilizadas.
3. **Analista Text-to-SQL con Groq (`openai/gpt-oss-120b`) + Guardián SQL**:
   - FastAPI actúa como orquestador seguro: Groq traduce preguntas de negocio a una única consulta `SELECT`/`WITH` sobre `DATAFINANCE.PUBLIC.*`. El guardián [sql_guard.py](file:///home/dmgx/Projects/DistroSide/backend/sql_guard.py) bloquea cualquier comando destructivo, inyecciones, o acceso a esquemas no autorizados.
4. **Mes parcial excluido por defecto de agregaciones globales y anomalías**:
   - Los meses con fecha máxima inferior al día 28 se marcan como mes parcial (`ES_COMPLETO = FALSE`) para evitar falsos positivos de caídas de ingresos o variaciones distorsionadas al inicio de un mes.
5. **Cierre Financiero Mensual Automatizado & Idempotente**:
   - Resuelve el proceso de fin de mes de la empresa: recalcula KPIs y ventanas en Snowflake (`cierre_mensual.sql`), detecta anomalías estadísticas Z-Score, genera narrativa ejecutiva con IA, almacena el Executive Pack en PDF y registra la auditoría en `PUBLIC.AUDITORIA_CIERRES`. Si un periodo ya fue cerrado, se previene duplicación involuntaria mediante validación de idempotencia (`forzar=False`).
6. **Centinela Semanal Preventivo de Sobrecostos Operativos (Run-Rate)**:
   - Actúa como alerta temprana a mitad de mes antes de que los sobrecostos erosionen la utilidad. Calcula el ritmo de gasto acumulado frente al histórico por categoría, proyecta el cierre mensual lineal y aísla las transacciones causantes con diagnóstico operativo redactado por IA.
7. **Cuadre Diario de Ventas y Monitoreo de Liquidez (Contado vs. Crédito)**:
   - Atiende el recaudo al cierre de ruta para distribuidores mayoristas de consumo masivo: calcula la relación diaria entre recaudo inmediato en efectivo/transferencias y crédito a tiendas. Alerta riesgos de iliquidez cuando el ratio de contado cae por debajo del 45% (o 35% en estado crítico) y genera dictamen ejecutivo diario para tesorería y cartera.

