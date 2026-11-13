-- Detección estadística de anomalías (Z-score) sobre meses completos en Gold.
-- Se ejecuta al final de datafinance_etl sin costo de tokens Cortex.
-- En el Paso 6 se complementará/validará con Cortex ML (ANOMALY_DETECTION).

CREATE OR REPLACE TABLE DATAFINANCE.PUBLIC.ANOMALIAS AS
WITH meses_completos AS (
    SELECT
        MES,
        MAX(FECHA) AS ULTIMA_FECHA_MES
    FROM DATAFINANCE.PUBLIC.TRANSACCIONES
    GROUP BY MES
    HAVING DAY(MAX(FECHA)) >= 28
),
stats_categoria AS (
    SELECT
        k.MES,
        k.ANIO_MES,
        k.TIPO,
        k.CATEGORIA,
        k.MONTO_TOTAL,
        AVG(k.MONTO_TOTAL) OVER (PARTITION BY k.TIPO, k.CATEGORIA) AS PROMEDIO_HISTORICO,
        STDDEV_SAMP(k.MONTO_TOTAL) OVER (PARTITION BY k.TIPO, k.CATEGORIA) AS DESV_ESTANDAR
    FROM DATAFINANCE.PUBLIC.KPI_CATEGORIA_MENSUAL k
    INNER JOIN meses_completos mc ON k.MES = mc.MES
),
anomalias_categoria AS (
    SELECT
        MES,
        ANIO_MES,
        'CATEGORIA' AS NIVEL,
        TIPO,
        CATEGORIA,
        MONTO_TOTAL AS VALOR_OBSERVADO,
        ROUND(PROMEDIO_HISTORICO, 2) AS VALOR_ESPERADO,
        ROUND((MONTO_TOTAL - PROMEDIO_HISTORICO) / NULLIF(DESV_ESTANDAR, 0), 2) AS Z_SCORE,
        IFF(MONTO_TOTAL > PROMEDIO_HISTORICO, 'PICO_ATIPICO', 'CAIDA_ATIPICA') AS TIPO_ANOMALIA,
        CONCAT(
            TIPO, ' en ', CATEGORIA, ' fue ',
            ROUND(MONTO_TOTAL / NULLIF(PROMEDIO_HISTORICO, 0), 2),
            'x respecto al promedio histórico mensual'
        ) AS MOTIVO
    FROM stats_categoria
    WHERE ABS((MONTO_TOTAL - PROMEDIO_HISTORICO) / NULLIF(DESV_ESTANDAR, 0)) >= 2.5
),
stats_mensual AS (
    SELECT
        k.MES,
        k.ANIO_MES,
        k.INGRESOS,
        AVG(k.INGRESOS) OVER () AS PROM_INGRESOS,
        STDDEV_SAMP(k.INGRESOS) OVER () AS STD_INGRESOS,
        k.UTILIDAD,
        AVG(k.UTILIDAD) OVER () AS PROM_UTILIDAD,
        STDDEV_SAMP(k.UTILIDAD) OVER () AS STD_UTILIDAD
    FROM DATAFINANCE.PUBLIC.KPI_MENSUAL k
    INNER JOIN meses_completos mc ON k.MES = mc.MES
),
anomalias_globales AS (
    SELECT
        MES,
        ANIO_MES,
        'MENSUAL' AS NIVEL,
        'INGRESO' AS TIPO,
        'TOTAL_INGRESOS' AS CATEGORIA,
        INGRESOS AS VALOR_OBSERVADO,
        ROUND(PROM_INGRESOS, 2) AS VALOR_ESPERADO,
        ROUND((INGRESOS - PROM_INGRESOS) / NULLIF(STD_INGRESOS, 0), 2) AS Z_SCORE,
        IFF(INGRESOS > PROM_INGRESOS, 'PICO_ATIPICO', 'CAIDA_ATIPICA') AS TIPO_ANOMALIA,
        CONCAT(
            'Ingresos totales del mes (', ROUND(INGRESOS / 1e6, 2),
            ' M COP) frente a promedio histórico (', ROUND(PROM_INGRESOS / 1e6, 2), ' M COP)'
        ) AS MOTIVO
    FROM stats_mensual
    WHERE ABS((INGRESOS - PROM_INGRESOS) / NULLIF(STD_INGRESOS, 0)) >= 2.5
)
SELECT
    MES,
    ANIO_MES,
    NIVEL,
    TIPO,
    CATEGORIA,
    VALOR_OBSERVADO,
    VALOR_ESPERADO,
    Z_SCORE,
    TIPO_ANOMALIA,
    MOTIVO,
    CURRENT_TIMESTAMP()::TIMESTAMP_NTZ AS DETECTADO_EN
FROM (
    SELECT * FROM anomalias_categoria
    UNION ALL
    SELECT * FROM anomalias_globales
)
ORDER BY MES, ABS(Z_SCORE) DESC;
