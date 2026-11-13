-- Generación de reporte financiero en lenguaje natural mediante Snowflake AISQL (AI_AGG).
-- Principio rector: SQL calcula (KPI_MENSUAL y ANOMALIAS), la IA únicamente explica.
-- Nota técnica: en cuentas nuevas/trial donde SNOWFLAKE.CORTEX.COMPLETE (legacy) y
-- AI_COMPLETE están restringidos, AI_AGG permite redactar el reporte directamente en Snowflake.

CREATE TABLE IF NOT EXISTS DATAFINANCE.PUBLIC.REPORTES (
    ID_REPORTE NUMBER AUTOINCREMENT,
    GENERADO_EN TIMESTAMP_NTZ,
    MODELO VARCHAR,
    PERIODO_DESDE VARCHAR,
    PERIODO_HASTA VARCHAR,
    RESUMEN_DATOS VARIANT,
    REPORTE_TEXTO VARCHAR
);

INSERT INTO DATAFINANCE.PUBLIC.REPORTES (
    GENERADO_EN,
    MODELO,
    PERIODO_DESDE,
    PERIODO_HASTA,
    RESUMEN_DATOS,
    REPORTE_TEXTO
)
WITH meses_completos AS (
    SELECT MES
    FROM DATAFINANCE.PUBLIC.TRANSACCIONES
    GROUP BY MES
    HAVING DAY(MAX(FECHA)) >= 28
),
ultimos_meses AS (
    SELECT
        k.ANIO_MES,
        k.TOTAL_TRANSACCIONES,
        k.INGRESOS,
        k.GASTOS,
        k.UTILIDAD,
        k.MARGEN_PCT,
        k.VAR_INGRESOS_PCT,
        k.VAR_GASTOS_PCT
    FROM DATAFINANCE.PUBLIC.KPI_MENSUAL k
    INNER JOIN meses_completos mc ON k.MES = mc.MES
    ORDER BY k.MES DESC
    LIMIT 6
),
totales_periodo AS (
    SELECT
        MIN(ANIO_MES) AS PERIODO_DESDE,
        MAX(ANIO_MES) AS PERIODO_HASTA,
        ROUND(SUM(INGRESOS) / 1e6, 2) AS INGRESOS_TOTALES_M,
        ROUND(SUM(GASTOS) / 1e6, 2) AS GASTOS_TOTALES_M,
        ROUND(SUM(UTILIDAD) / 1e6, 2) AS UTILIDAD_TOTAL_M,
        ROUND(SUM(UTILIDAD) / NULLIF(SUM(INGRESOS), 0) * 100, 2) AS MARGEN_TOTAL_PCT
    FROM ultimos_meses
),
anomalias_recientes AS (
    SELECT
        ANIO_MES,
        CATEGORIA,
        TIPO_ANOMALIA,
        VALOR_OBSERVADO,
        VALOR_ESPERADO,
        MOTIVO
    FROM DATAFINANCE.PUBLIC.ANOMALIAS
    ORDER BY MES DESC
    LIMIT 10
),
lineas_hechos AS (
    SELECT
        CONCAT(
            'TOTAL PERIODO ', PERIODO_DESDE, ' a ', PERIODO_HASTA,
            ': IngresosTotales=', INGRESOS_TOTALES_M, 'M COP',
            ', GastosTotales=', GASTOS_TOTALES_M, 'M COP',
            ', UtilidadTotal=', UTILIDAD_TOTAL_M, 'M COP',
            ', MargenTotal=', MARGEN_TOTAL_PCT, '%'
        ) AS LINEA
    FROM totales_periodo
    UNION ALL
    SELECT
        CONCAT(
            'MES ', ANIO_MES,
            ' (', TOTAL_TRANSACCIONES, ' transacciones)',
            ': Ingresos=', ROUND(INGRESOS / 1e6, 2), 'M COP',
            ', Gastos=', ROUND(GASTOS / 1e6, 2), 'M COP',
            ', Utilidad=', ROUND(UTILIDAD / 1e6, 2), 'M COP',
            ', Margen=', MARGEN_PCT, '%',
            ', VariacionIngresosVsMesAnterior=',
                IFF(VAR_INGRESOS_PCT IS NULL, 'N/A',
                    IFF(VAR_INGRESOS_PCT >= 0, CONCAT('subida +', VAR_INGRESOS_PCT, '%'), CONCAT('caida ', VAR_INGRESOS_PCT, '%'))),
            ', VariacionGastosVsMesAnterior=',
                IFF(VAR_GASTOS_PCT IS NULL, 'N/A',
                    IFF(VAR_GASTOS_PCT >= 0, CONCAT('subida +', VAR_GASTOS_PCT, '%'), CONCAT('baja ', VAR_GASTOS_PCT, '%')))
        ) AS LINEA
    FROM ultimos_meses
    UNION ALL
    SELECT
        CONCAT(
            'ANOMALIA ', ANIO_MES,
            ' [', CATEGORIA, ' / ', TIPO_ANOMALIA, ']: ',
            MOTIVO,
            ' (Observado=', ROUND(VALOR_OBSERVADO / 1e6, 2), 'M COP',
            ', Esperado=', ROUND(VALOR_ESPERADO / 1e6, 2), 'M COP)'
        ) AS LINEA
    FROM anomalias_recientes
),
redaccion AS (
    SELECT
        AI_AGG(
            LINEA,
            'Eres un analista financiero senior de Distribuidora del Caribe S.A.S. (moneda: COP). ' ||
            'Redacta un reporte ejecutivo claro y preciso en español usando EXCLUSIVAMENTE los datos proporcionados. ' ||
            'Respeta el signo de cada variación (si dice caida o baja, es disminución; si dice subida, es aumento). ' ||
            'No inventes cifras, causas externas ni porcentajes que no aparezcan en los registros. ' ||
            'Organízalo en: 1) Resumen del periodo (usando el registro TOTAL PERIODO); ' ||
            '2) Variaciones relevantes mes a mes; 3) Anomalías detectadas.'
        ) AS REPORTE_TEXTO
    FROM lineas_hechos
),
metadatos AS (
    SELECT
        PERIODO_DESDE,
        PERIODO_HASTA,
        OBJECT_CONSTRUCT(
            'resumen_periodo', (SELECT OBJECT_CONSTRUCT(*) FROM totales_periodo),
            'kpis_ultimos_6_meses', (SELECT ARRAY_AGG(OBJECT_CONSTRUCT(*)) FROM ultimos_meses),
            'anomalias_detectadas', (SELECT COALESCE(ARRAY_AGG(OBJECT_CONSTRUCT(*)), ARRAY_CONSTRUCT()) FROM anomalias_recientes)
        ) AS DATOS_JSON
    FROM totales_periodo
)
SELECT
    CURRENT_TIMESTAMP()::TIMESTAMP_NTZ AS GENERADO_EN,
    'snowflake-aisql-ai_agg' AS MODELO,
    m.PERIODO_DESDE,
    m.PERIODO_HASTA,
    m.DATOS_JSON AS RESUMEN_DATOS,
    r.REPORTE_TEXTO
FROM metadatos m
CROSS JOIN redaccion r;
