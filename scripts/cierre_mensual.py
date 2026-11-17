"""Script CLI de automatización del Cierre Financiero Mensual y compilación del Executive Pack.

Uso:
    python scripts/cierre_mensual.py
    python scripts/cierre_mensual.py --mes 2026-10
    python scripts/cierre_mensual.py --mes 2026-10 --forzar
    python scripts/cierre_mensual.py --disparador CRON_JOB
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Agregar raíz del proyecto al sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.monthly_closing import (
    ejecutar_cierre_mensual,
    listar_historial_cierres,
    obtener_ultimo_mes_completo,
)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Ejecuta el Cierre Financiero Mensual Automatizado de DataFinance AI."
    )
    parser.add_argument(
        "--mes",
        type=str,
        default=None,
        help="Periodo a cerrar en formato YYYY-MM (ej. 2026-10). Si no se indica, toma el último mes completo.",
    )
    parser.add_argument(
        "--forzar",
        action="store_true",
        help="Fuerza el reprocesamiento y recálculo aunque el mes ya haya sido cerrado previamente.",
    )
    parser.add_argument(
        "--disparador",
        type=str,
        default="MANUAL_CLI",
        help="Identificador del origen de ejecución (ej. MANUAL_CLI, CRON_JOB, AIRFLOW_WORKER).",
    )
    parser.add_argument(
        "--historial",
        action="store_true",
        help="Muestra el historial de los últimos cierres registrados en Snowflake y termina.",
    )

    args = parser.parse_args()

    if args.historial:
        cierres = listar_historial_cierres(10)
        print("\n================ BITÁCORA DE CIERRES MENSUALES ================")
        if not cierres:
            print("No hay cierres registrados en DATAFINANCE.PUBLIC.AUDITORIA_CIERRES.")
            return
        for c in cierres:
            print(
                f"ID: {c.get('ID_CIERRE'):<4} | Periodo: {c.get('MES_CERRADO'):<7} | "
                f"Estado: {c.get('ESTADO'):<14} | Ingresos: ${c.get('INGRESOS', 0) / 1e6:,.2f}M | "
                f"PDF: {c.get('NOMBRE_ARCHIVO_PDF') or 'N/A'}"
            )
        print("===============================================================\n")
        return

    mes_objetivo = args.mes
    if not mes_objetivo:
        try:
            mes_objetivo = obtener_ultimo_mes_completo()
        except Exception as exc:
            print(f"❌ Error al consultar último mes completo en Snowflake: {exc}")
            sys.exit(1)

    print(f"\n🚀 Iniciando Cierre Financiero para el periodo: {mes_objetivo or 'AUTO'}...")
    print(f"   Disparador: {args.disparador} | Forzar: {args.forzar}")

    try:
        resultado = ejecutar_cierre_mensual(
            mes=args.mes,
            forzar=args.forzar,
            disparador=args.disparador,
        )
    except Exception as exc:
        print(f"\n❌ Error durante el cierre mensual: {exc}")
        sys.exit(1)

    estado = resultado.get("estado")
    if estado == "ALREADY_CLOSED":
        print(f"\nℹ️  {resultado.get('mensaje')}")
        print(f"   ID Cierre previo: {resultado.get('id_cierre')}")
        print(f"   Archivo PDF: {resultado.get('nombre_archivo_pdf')}")
        print("   (Para forzar una re-ejecución, añade la bandera --forzar)")
        return

    print("\n✅ ¡CIERRE FINANCIERO COMPLETADO CON ÉXITO!")
    print("---------------------------------------------------------------")
    print(f"Periodo cerrado        : {resultado.get('mes_cerrado')}")
    print(f"ID Cierre (Auditoría)  : {resultado.get('id_cierre')}")
    print(f"ID Reporte Persistido  : {resultado.get('id_reporte')}")
    print(f"Estado de Auditoría    : {resultado.get('estado')}")
    print(f"Anomalías Detectadas   : {resultado.get('total_anomalias')}")

    kpis = resultado.get("kpis") or {}
    print("\n📊 Scorecard Financiero:")
    ingresos = kpis.get("INGRESOS")
    gastos = kpis.get("GASTOS")
    utilidad = kpis.get("UTILIDAD")
    margen = kpis.get("MARGEN_PCT")
    print(f"   Ingresos Totales    : ${ingresos / 1e6:,.2f} M COP" if ingresos else "   Ingresos: N/A")
    print(f"   Gastos Totales      : ${gastos / 1e6:,.2f} M COP" if gastos else "   Gastos: N/A")
    print(f"   Utilidad Neta       : ${utilidad / 1e6:,.2f} M COP" if utilidad else "   Utilidad: N/A")
    print(f"   Margen Operativo    : {margen:.2f}%" if margen is not None else "   Margen: N/A")

    if resultado.get("anomalias"):
        print("\n⚠️  Detalle de Anomalías Detectadas:")
        for a in resultado["anomalias"]:
            print(f"   - [{a.get('TIPO_ANOMALIA')}] {a.get('CATEGORIA')}: {a.get('MOTIVO')}")

    print(f"\n📄 Executive Pack PDF  : storage/reports/{resultado.get('nombre_archivo_pdf')}")
    print("---------------------------------------------------------------\n")


if __name__ == "__main__":
    main()
