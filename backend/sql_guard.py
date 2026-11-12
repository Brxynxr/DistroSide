"""Validador estricto de SQL de solo lectura para consultas generadas por LLM."""

from __future__ import annotations

import re

TABLAS_AUTORIZADAS = {
    "DATAFINANCE.GOLD.KPI_MENSUAL",
    "DATAFINANCE.GOLD.KPI_CATEGORIA_MENSUAL",
    "DATAFINANCE.GOLD.KPI_AREA_MENSUAL",
    "DATAFINANCE.GOLD.ANOMALIAS",
    "DATAFINANCE.GOLD.REPORTES",
    "DATAFINANCE.SILVER.TRANSACCIONES",
    "DATAFINANCE.SILVER.TRANSACCIONES_RECHAZADOS",
    "GOLD.KPI_MENSUAL",
    "GOLD.KPI_CATEGORIA_MENSUAL",
    "GOLD.KPI_AREA_MENSUAL",
    "GOLD.ANOMALIAS",
    "GOLD.REPORTES",
    "SILVER.TRANSACCIONES",
    "SILVER.TRANSACCIONES_RECHAZADOS",
}

PALABRAS_PROHIBIDAS = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|MERGE|TRUNCATE|"
    r"GRANT|REVOKE|CALL|COPY|PUT|GET|USE|SHOW|DESCRIBE|EXPLAIN|"
    r"EXECUTE|EXEC|REMOVE|UNDROP|COMMENT|COMMIT|ROLLBACK)\b",
    re.IGNORECASE,
)

REFERENCIA_TABLA_RE = re.compile(
    r"\b(?:FROM|JOIN)\s+([A-Za-z0-9_\.\"]+)",
    re.IGNORECASE,
)

COMENTARIOS_RE = re.compile(r"(--[^\n]*|/\*[\s\S]*?\*/)")


def _extraer_nombres_cte(sql_sin_comentarios: str) -> set[str]:
    """Identifica nombres de CTEs (WITH nombre AS (...)) para permitirlos en FROM/JOIN."""
    ctes = re.findall(
        r"(?:\bWITH|,)\s*([A-Za-z_][A-Za-z0-9_]*)\s+AS\s*\(",
        sql_sin_comentarios,
        re.IGNORECASE,
    )
    return {c.upper() for c in ctes}


def validar_sql_solo_lectura(sql_raw: str, max_limit: int = 200) -> str:
    """Valida que la consulta sea únicamente SELECT sobre objetos autorizados."""
    if not sql_raw or not sql_raw.strip():
        raise ValueError("La consulta SQL generada está vacía.")

    # Quitar cercos markdown si el LLM los incluyó
    sql = sql_raw.strip()
    sql = re.sub(r"^```(?:sql)?\s*", "", sql, flags=re.IGNORECASE)
    sql = re.sub(r"\s*```$", "", sql).strip()

    # Eliminar un único ';' al final; prohibir ';' internos (múltiples sentencias)
    if sql.endswith(";"):
        sql = sql[:-1].strip()
    if ";" in sql:
        raise ValueError("No se permiten múltiples sentencias SQL ni punto y coma interno.")

    sin_comentarios = COMENTARIOS_RE.sub(" ", sql).strip()
    if not re.match(r"^(SELECT|WITH)\b", sin_comentarios, re.IGNORECASE):
        raise ValueError("Solo se permiten consultas de lectura que inicien con SELECT o WITH.")

    if PALABRAS_PROHIBIDAS.search(sin_comentarios):
        raise ValueError("La consulta contiene comandos no permitidos en modo solo lectura.")

    if "SNOWFLAKE." in sin_comentarios.upper() or "INFORMATION_SCHEMA" in sin_comentarios.upper():
        raise ValueError("Acceso denegado a esquemas del sistema.")

    if "BRONZE" in sin_comentarios.upper():
        raise ValueError("Las consultas analíticas deben leer únicamente de SILVER o GOLD.")

    ctes = _extraer_nombres_cte(sin_comentarios)
    tablas = REFERENCIA_TABLA_RE.findall(sin_comentarios)
    if not tablas:
        raise ValueError("La consulta debe referenciar explícitamente una tabla o vista autorizada.")

    for tabla in tablas:
        limpia = tabla.replace('"', "").upper()
        if limpia in ctes:
            continue
        if limpia not in TABLAS_AUTORIZADAS:
            raise ValueError(
                f"Tabla no autorizada: '{limpia}'. Solo se permite consultar DATAFINANCE.GOLD.* o DATAFINANCE.SILVER.TRANSACCIONES."
            )

    if not re.search(r"\bLIMIT\s+\d+\b", sin_comentarios, re.IGNORECASE):
        sql = f"{sql}\nLIMIT {max_limit}"

    return sql
