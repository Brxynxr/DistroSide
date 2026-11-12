# Diccionario de Datos — DataFinance AI (`DATAFINANCE`)

Moneda de todas las métricas monetarias: **Pesos Colombianos (`COP`)**.

---

## 1. Capa Bronze (`DATAFINANCE.BRONZE`)

### `TRANSACCIONES`
Datos sintéticos crudos generados por [generar_dataset.py](file:///home/cohorte5/Escritorio/proyecto%20/scripts/generar_dataset.py).

| Columna | Tipo | Descripción | Inconsistencias controladas |
|---|---|---|---|
| `ID_TRANSACCION` | `VARCHAR` | Identificador único o `T-<YYYYMMDD>-XXXX` | ~1% duplicados exactos |
| `FECHA` | `VARCHAR` | Fecha original del movimiento | Mezcla `YYYY-MM-DD` (~75%) y `DD/MM/YYYY` (~25%) |
| `TIPO` | `VARCHAR` | `INGRESO` o `GASTO` | Variaciones de mayúsculas, minúsculas y espacios |
| `CATEGORIA` | `VARCHAR` | Categoría comercial u operativa | Espacios extremos y capitalización irregular |
| `MONTO` | `FLOAT` | Valor monetario en COP | ~2% valores nulos (`NaN`) |
| `AREA` | `VARCHAR` | `Ventas`, `Operaciones`, `Administración` | Capitalización mixta antes de Silver |
| `DESCRIPCION` | `VARCHAR` | Descripción breve de la operación | Dato textual no confiable para prompts LLM |

---

## 2. Capa Silver (`DATAFINANCE.SILVER`)

Transformación definida en [silver_transacciones.sql](file:///home/cohorte5/Escritorio/proyecto%20/airflow/dags/sql/silver_transacciones.sql) y validada por [validar_silver.sql](file:///home/cohorte5/Escritorio/proyecto%20/airflow/dags/sql/validar_silver.sql).

### Reglas de calidad aplicadas
- **Fechas**: `REGEXP_LIKE` explícito para `YYYY-MM-DD` y `DD/MM/YYYY` convertido con `TRY_TO_DATE`. Cualquier otro formato resulta `NULL` y se rechaza.
- **Textos**: `UPPER(TRIM(...))` sobre `TIPO`, `CATEGORIA` y `AREA`.
- **Nulos y no positivos**: los montos `NULL` o `<= 0` **no se reemplazan por `0`** porque distorsionarían promedios y recuentos; se envían a `TRANSACCIONES_RECHAZADOS`.
- **Duplicados**: `ROW_NUMBER() OVER (PARTITION BY TRIM(ID_TRANSACCION) ORDER BY IFF(MONTO IS NULL, 1, 0), FECHA)` conserva la copia válida (`RN = 1`) y audita las restantes (`RN > 1`).

### `TRANSACCIONES`
| Columna | Tipo | Descripción |
|---|---|---|
| `ID_TRANSACCION` | `VARCHAR` | Identificador limpio (`TRIM`), único |
| `FECHA` | `DATE` | Fecha validada |
| `ANIO` | `NUMBER` | Año calendario |
| `MES` | `DATE` | Primer día del mes (`DATE_TRUNC('MONTH', FECHA)`) |
| `ANIO_MES` | `VARCHAR` | Periodo `YYYY-MM` |
| `TIPO` | `VARCHAR` | `INGRESO` o `GASTO` |
| `CATEGORIA` | `VARCHAR` | Categoría estandarizada en mayúsculas |
| `AREA` | `VARCHAR` | `VENTAS`, `OPERACIONES` o `ADMINISTRACIÓN` |
| `MONTO` | `NUMBER(14,2)` | Valor positivo en COP |
| `DESCRIPCION` | `VARCHAR` | Descripción limpia |
| `FECHA_ORIGINAL` | `VARCHAR` | Trazabilidad del texto recibido en Bronze |
| `CARGADO_SILVER_EN` | `TIMESTAMP_NTZ` | Marca temporal de carga en Silver |

### `TRANSACCIONES_RECHAZADOS`
Audita los registros no promovidos a Silver con `MOTIVO_RECHAZO` explícito: `ID_NULO`, `DUPLICADO`, `FECHA_INVALIDA`, `MONTO_NULO_O_NO_POSITIVO`, `TIPO_INVALIDO`.

---

## 3. Capa Gold (`DATAFINANCE.GOLD`)

Construida en [gold_kpi_mensual.sql](file:///home/cohorte5/Escritorio/proyecto%20/airflow/dags/sql/gold_kpi_mensual.sql), [anomalias.sql](file:///home/cohorte5/Escritorio/proyecto%20/airflow/dags/sql/anomalias.sql) y [reporte.sql](file:///home/cohorte5/Escritorio/proyecto%20/airflow/dags/sql/reporte.sql).

### `KPI_MENSUAL` (Tabla — 1 fila por mes)
Incluye `INGRESOS`, `GASTOS`, `UTILIDAD` (`INGRESOS - GASTOS`), `MARGEN_PCT` (protegido contra división por cero), valores del mes anterior (`LAG`) y variaciones absolutas/porcentuales (`VAR_*_ABS`, `VAR_*_PCT`).

### `KPI_CATEGORIA_MENSUAL` (Vista — grano `MES × TIPO × CATEGORIA`)
Expone `MONTO_TOTAL`, `TOTAL_TRANSACCIONES`, `MONTO_MES_ANTERIOR`, `VAR_ABS` y `VAR_PCT`.

### `KPI_AREA_MENSUAL` (Vista — grano `MES × AREA × TIPO`)
Expone agregaciones por `VENTAS`, `OPERACIONES` y `ADMINISTRACIÓN` con variación mensual.

### `ANOMALIAS` (Tabla)
Detecta desviaciones con `|Z_SCORE| >= 2.5` sobre **meses completos** (`DAY(MAX(FECHA)) >= 28`), tanto por categoría como en ingresos totales. Anomalías sembradas en el dataset sintético base (`seed=42`):
- **2026-03 (`MARKETING`)**: incremento ~5x por campaña agresiva no presupuestada (`PICO_ATIPICO`).
- **2026-06 (`INGRESOS`)**: caída al ~62% del volumen habitual por cierre vial y desabastecimiento (`CAIDA_ATIPICA`).
- **2026-08 (`LOGISTICA`)**: incremento ~3.5x por reparación mayor de flota y fletes de emergencia (`PICO_ATIPICO`).

### `REPORTES` (Tabla)
Almacena `ID_REPORTE`, `GENERADO_EN`, `MODELO` (`snowflake-aisql-ai_agg`), `PERIODO_DESDE`, `PERIODO_HASTA`, `RESUMEN_DATOS` (`VARIANT`) y `REPORTE_TEXTO`.
