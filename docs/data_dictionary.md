# Diccionario de Datos — DataFinance AI (`DATAFINANCE.PUBLIC`)

Moneda de todas las métricas monetarias: **Pesos Colombianos (`COP`)**.

Los datos han sido depurados, tipados y consolidados en el esquema único **`DATAFINANCE.PUBLIC`**, garantizando que el 100% de las tablas y vistas consumidas por la API FastAPI, el analista Groq y los reportes ejecutivos contengan información limpia y verificada.

---

## 1. Tabla de Hechos: `DATAFINANCE.PUBLIC.TRANSACCIONES`

Contiene el historial completo de 37,391 transacciones de *Distribuidora del Caribe S.A.S.* entre noviembre de 2024 y noviembre de 2026.

| Columna | Tipo | Restricción / Formato | Descripción |
|---|---|---|---|
| `ID_TRANSACCION` | `VARCHAR(64)` | `PRIMARY KEY`, único | Identificador alfanumérico limpio de la transacción (`T-<YYYYMMDD>-XXXX`) |
| `FECHA` | `DATE` | No nulo (`YYYY-MM-DD`) | Fecha efectiva de la operación comercial u operativa |
| `ANIO` | `NUMBER(4,0)` | Calculado | Año calendario del movimiento |
| `MES` | `DATE` | Calculado | Primer día del mes (`DATE_TRUNC('MONTH', FECHA)`) |
| `ANIO_MES` | `VARCHAR(7)` | `YYYY-MM` | Clave mensual estandarizada para filtros y agrupaciones |
| `TIPO` | `VARCHAR(16)` | `INGRESO` o `GASTO` | Clasificación general del flujo monetario |
| `CATEGORIA` | `VARCHAR(64)` | Mayúsculas, sin espacios | Categoría (Ventas contado/crédito, Proveedores, Nómina, etc.) |
| `AREA` | `VARCHAR(32)` | `VENTAS`, `OPERACIONES`, `ADMINISTRACIÓN` | Área organizativa responsable del ingreso o gasto |
| `MONTO` | `NUMBER(14,2)` | `> 0` | Monto en pesos colombianos (COP), sin valores nulos ni negativos |
| `DESCRIPCION` | `VARCHAR(256)` | Texto informativo | Detalle operativo de la transacción (tratado como no ejecutable) |

---

## 2. Indicadores Mensuales: `DATAFINANCE.PUBLIC.KPI_MENSUAL`

Tabla precalculada de KPIs a nivel mensual (25 meses históricos).

| Columna | Tipo | Descripción |
|---|---|---|
| `MES` | `DATE` | Primer día del mes |
| `ANIO_MES` | `VARCHAR(7)` | Periodo en formato `YYYY-MM` |
| `ANIO` | `NUMBER(4,0)` | Año calendario |
| `TOTAL_TRANSACCIONES` | `NUMBER(38,0)` | Número de transacciones registradas en el mes |
| `INGRESOS` | `NUMBER(14,2)` | Suma de movimientos donde `TIPO = 'INGRESO'` |
| `GASTOS` | `NUMBER(14,2)` | Suma de movimientos donde `TIPO = 'GASTO'` |
| `UTILIDAD` | `NUMBER(14,2)` | `INGRESOS - GASTOS` |
| `MARGEN_PCT` | `NUMBER(8,2)` | `(UTILIDAD / INGRESOS) * 100`, con control de división por cero |
| `INGRESOS_MES_ANTERIOR` | `NUMBER(14,2)` | Ingresos del mes previo (`LAG()`) |
| `GASTOS_MES_ANTERIOR` | `NUMBER(14,2)` | Gastos del mes previo (`LAG()`) |
| `UTILIDAD_MES_ANTERIOR` | `NUMBER(14,2)` | Utilidad del mes previo (`LAG()`) |
| `VAR_INGRESOS_ABS` | `NUMBER(14,2)` | Variación absoluta de ingresos vs mes anterior |
| `VAR_INGRESOS_PCT` | `NUMBER(8,2)` | Variación porcentual de ingresos vs mes anterior |
| `VAR_GASTOS_ABS` | `NUMBER(14,2)` | Variación absoluta de gastos vs mes anterior |
| `VAR_GASTOS_PCT` | `NUMBER(8,2)` | Variación porcentual de gastos vs mes anterior |
| `VAR_UTILIDAD_ABS` | `NUMBER(14,2)` | Variación absoluta de utilidad vs mes anterior |
| `VAR_UTILIDAD_PCT` | `NUMBER(8,2)` | Variación porcentual de utilidad vs mes anterior |
| `ES_COMPLETO` | `BOOLEAN` | `TRUE` si `DAY(MAX(FECHA)) >= 28`; `FALSE` si es mes en curso |

---

## 3. Vistas Analíticas

- **`DATAFINANCE.PUBLIC.KPI_CATEGORIA_MENSUAL`**: Desglosa ingresos y gastos por categoría mes a mes, calculando monto total, conteo de transacciones y variaciones mensuales.
- **`DATAFINANCE.PUBLIC.KPI_AREA_MENSUAL`**: Agrupa los flujos financieros por área funcional (`VENTAS`, `OPERACIONES`, `ADMINISTRACIÓN`).

---

## 4. Detección de Anomalías: `DATAFINANCE.PUBLIC.ANOMALIAS`

Identifica variaciones y picos/caídas atípicas mediante análisis estadístico ($|Z\text{-score}| \ge 2.5$) sobre meses completos:

- **2026-03 (`MARKETING`)**: Incremento ~5x por campaña agresiva no presupuestada (`PICO_ATIPICO`).
- **2026-06 (`INGRESOS`)**: Caída al ~62% del volumen habitual por contingencia vial (`CAIDA_ATIPICA`).
- **2026-08 (`LOGISTICA`)**: Incremento ~3.5x por mantenimiento mayor de flota (`PICO_ATIPICO`).

---

## 5. Reportes Ejecutivos: `DATAFINANCE.PUBLIC.REPORTES`

Historial de reportes ejecutivos redactados por IA (`AI_AGG` o Groq):
- `ID_REPORTE`: Identificador único UUID / prefijo.
- `GENERADO_EN`: Marca temporal de generación.
- `MODELO`: Modelo generativo utilizado.
- `PERIODO_DESDE` / `PERIODO_HASTA`: Rango analizado.
- `RESUMEN_DATOS`: Payload JSON con KPIs agregados.
- `REPORTE_TEXTO`: Contenido redactado del informe ejecutivo disponible para exportación PDF en ReportLab.

---

## 6. Auditoría de Cierres Mensuales: `DATAFINANCE.PUBLIC.AUDITORIA_CIERRES`

Bitácora y trazabilidad de los cierres mensuales automatizados:
- `ID_CIERRE`: Identificador numérico autoincremental del cierre.
- `MES_CERRADO`: Periodo cerrado en formato `YYYY-MM`.
- `FECHA_EJECUCION`: Marca temporal exacta de la ejecución.
- `ESTADO`: Estado del cierre (`EXITOSO`, `CON_ANOMALIAS`, `FALLIDO`).
- `TOTAL_TRANSACCIONES`: Conteo de transacciones cerradas.
- `INGRESOS` / `GASTOS` / `UTILIDAD`: Métricas financieras calculadas en COP.
- `MARGEN_PCT`: Margen porcentual consolidado.
- `TOTAL_ANOMALIAS`: Número de anomalías estadísticas detectadas en el periodo.
- `ID_REPORTE`: Llave foránea hacia `PUBLIC.REPORTES`.
- `NOMBRE_ARCHIVO_PDF`: Nombre del documento corporativo compilado (ej. `Executive_Pack_2026-10.pdf`).
- `EJECUTADO_POR`: Origen del trigger (`AUTOMATION_SCHEDULER`, `MANUAL_CLI`, `UI_DASHBOARD`).
- `MENSAJE`: Resumen de estado y observaciones de auditoría.

---

## 7. Alertas Preventivas del Centinela: `DATAFINANCE.PUBLIC.ALERTAS_CENTINELA`

Registro de alertas tempranas de sobrecostos por ritmo de consumo acelerado (Run-rate):
- `ID_ALERTA`: Identificador numérico de la alerta.
- `FECHA_EVALUACION`: Marca temporal del análisis.
- `PERIODO`: Periodo evaluado (`YYYY-MM`).
- `FECHA_CORTE`: Día máximo de transacción analizado en el mes.
- `DIAS_TRANSCURRIDOS` / `DIAS_TOTALES_MES`: Proporción temporal transcurrida.
- `CATEGORIA` / `AREA`: Rubro y área operacional afectada.
- `GASTO_ACUMULADO`: Monto gastado al corte (COP).
- `PROMEDIO_HISTORICO_MENSUAL`: Presupuesto mensual de referencia histórica.
- `PORCENTAJE_CONSUMIDO`: Porcentaje del presupuesto consumido a la fecha.
- `PROYECCION_FIN_MES`: Proyección matemática lineal al cierre del mes.
- `DESVIO_PROYECTADO_PCT`: Porcentaje de sobrecosto proyectado frente al presupuesto.
- `NIVEL_RIESGO`: Nivel de severidad (`CRITICO`, `ALTO`, `MODERADO`).
- `DIAGNOSTICO_IA`: Síntesis explicativa del desvío y medidas preventivas.
- `TRANSACCIONES_CRITICAS`: Payload JSON con las transacciones más costosas causantes.
- `ESTADO`: Estado de gestión de la alerta (`ACTIVA`, `MITIGADA`, `ARCHIVADA`).

---

## 8. Cuadre Diario de Ventas y Liquidez: `DATAFINANCE.PUBLIC.CUADRE_DIARIO_LIQUIDEZ`

Bitácora diaria de recaudo comercial al cierre de ruta para monitorear liquidez inmediata (Contado vs. Crédito):
- `ID_CUADRE`: Identificador autoincremental del cuadre diario.
- `FECHA`: Fecha evaluada (`YYYY-MM-DD`).
- `TOTAL_VENTAS`: Facturación total del día en COP.
- `VENTAS_CONTADO`: Monto recaudado en efectivo y transferencias inmediatas (COP).
- `VENTAS_CREDITO`: Facturación colocada a plazos a supermercados y tiendas aliadas (COP).
- `SERVICIOS`: Ingresos complementarios de transporte o logística comercial (COP).
- `RATIO_CONTADO_PCT`: Porcentaje de recaudo de contado sobre la venta total (`(VENTAS_CONTADO / TOTAL_VENTAS) * 100`).
- `RATIO_CREDITO_PCT`: Porcentaje de colocación a crédito sobre la venta total (`(VENTAS_CREDITO / TOTAL_VENTAS) * 100`).
- `ESTADO_LIQUIDEZ`: Clasificación prudencial de tesorería:
  - `OPTIMA`: `RATIO_CONTADO_PCT >= 45.0%` (flujo suficiente para obligaciones operativas inmediatas).
  - `ADVERTENCIA`: `35.0% <= RATIO_CONTADO_PCT < 45.0%` (menor velocidad de caja).
  - `CRITICA`: `RATIO_CONTADO_PCT < 35.0%` (acumulación riesgosa de cartera por cobrar).
- `TOTAL_TRANSACCIONES`: Número de ventas procesadas en el día.
- `SINTESIS_TESORERIA`: Dictamen ejecutivo redactado por IA (Groq `openai/gpt-oss-120b` o fallback) para el comité de caja y cartera.
- `REGISTRADO_EN`: Marca temporal de inserción.
- `EJECUTADO_POR`: Identificador del disparador (`AUTOMATION_DAILY`, `MANUAL_CLI`, `UI_DASHBOARD`).

### Vista Analítica: `DATAFINANCE.PUBLIC.V_CUADRE_DIARIO_CONSOLIDADO`
Calcula dinámicamente sobre `DATAFINANCE.PUBLIC.TRANSACCIONES` la serie diaria de ventas, ratios y estados de liquidez para los 731 días históricos, sustentando las gráficas y comparativas de tesorería sin recalcular en la capa de presentación.


