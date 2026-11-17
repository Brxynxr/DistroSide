"""Script CLI del Centinela Semanal de Sobrecostos Operativos (DataFinance AI).

Uso:
    python scripts/centinela_semanal.py
    python scripts/centinela_semanal.py --mes 2026-08
    python scripts/centinela_semanal.py --historial
    python scripts/centinela_semanal.py --no-persistir
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Agregar raíz del proyecto al sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.weekly_sentinel import (
    evaluar_centinela_semanal,
    listar_alertas_centinela,
)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Ejecuta la evaluación semanal del Centinela Operativo para detección temprana de sobrecostos."
    )
    parser.add_argument(
        "--mes",
        type=str,
        default=None,
        help="Periodo a evaluar en formato YYYY-MM (ej. 2026-08 o 2026-11). Por defecto: mes en curso.",
    )
    parser.add_argument(
        "--historial",
        action="store_true",
        help="Muestra la bitácora de alertas registradas en Snowflake y finaliza.",
    )
    parser.add_argument(
        "--solo-activas",
        action="store_true",
        help="Si se usa con --historial, lista únicamente las alertas en estado ACTIVA.",
    )
    parser.add_argument(
        "--no-persistir",
        action="store_true",
        help="Modo simulación (Dry Run): evalúa pero no inserta en DATAFINANCE.PUBLIC.ALERTAS_CENTINELA.",
    )

    args = parser.parse_args()

    if args.historial:
        alertas = listar_alertas_centinela(limite=15, solo_activas=args.solo_activas)
        print("\n================ BITÁCORA DE ALERTAS DEL CENTINELA ================")
        if not alertas:
            print("No hay alertas registradas en DATAFINANCE.PUBLIC.ALERTAS_CENTINELA.")
            return
        for a in alertas:
            print(
                f"ID #{a.get('ID_ALERTA'):<4} | Periodo: {a.get('PERIODO'):<7} | "
                f"Riesgo: [{a.get('NIVEL_RIESGO'):<8}] | Cat: {a.get('CATEGORIA'):<14} | "
                f"Consumido: {a.get('PORCENTAJE_CONSUMIDO', 0):>6.1f}% | "
                f"Proyección: ${a.get('PROYECCION_FIN_MES', 0) / 1e6:,.2f}M (+{a.get('DESVIO_PROYECTADO_PCT', 0):.1f}%) | "
                f"Estado: {a.get('ESTADO')}"
            )
        print("===================================================================\n")
        return

    print(f"\n🔍 Ejecutando Centinela Operativo Semanal (Periodo: {args.mes or 'ACTUAL'})...")
    print(f"   Modo persistencia: {'SIMULACIÓN (Dry Run)' if args.no_persistir else 'PERSISTIR EN SNOWFLAKE'}")

    try:
        resultado = evaluar_centinela_semanal(
            mes=args.mes,
            persistir=not args.no_persistir,
        )
    except Exception as exc:
        print(f"\n❌ Error durante la evaluación del Centinela: {exc}")
        sys.exit(1)

    total_alertas = resultado.get("total_alertas", 0)
    print("\n------------------ RESUMEN DE CONTROL OPERATIVO ------------------")
    print(f"Periodo evaluado           : {resultado.get('periodo')}")
    print(f"Categorías analizadas      : {resultado.get('total_categorias_evaluadas')}")
    print(f"Alertas tempranas emitidas : {total_alertas}")

    if total_alertas == 0:
        print("\n✅ Todas las categorías operan dentro de los ritmos de gasto presupuestados.")
        print("   No se proyectan sobrecostos críticos para el cierre de este periodo.")
    else:
        print("\n⚠️  DETALLE DE ALERTAS PREVENTIVAS DETECTADAS:")
        for idx, a in enumerate(resultado.get("alertas", []), start=1):
            riesgo = a.get("NIVEL_RIESGO")
            cat = a.get("CATEGORIA")
            area = a.get("AREA")
            gasto = a.get("GASTO_ACUMULADO", 0) / 1e6
            prom = (a.get("PROMEDIO_HISTORICO") or 0) / 1e6
            proy = (a.get("PROYECCION_FIN_MES") or 0) / 1e6
            desvio = a.get("DESVIO_PROYECTADO_PCT", 0)
            consumido = a.get("PORCENTAJE_CONSUMIDO", 0)
            dias = a.get("DIAS_TRANSCURRIDOS", 0)

            print(f"\n   [{idx}] [{riesgo}] {cat} — Área {area}")
            print(f"       Gasto acumulado al día {dias} : ${gasto:,.2f}M COP ({consumido:.1f}% del promedio mensual)")
            print(f"       Promedio histórico mensual    : ${prom:,.2f}M COP")
            print(f"       Proyección cierre de mes      : ${proy:,.2f}M COP (Desvío: +{desvio:.1f}%)")
            print("       Diagnóstico Preventivo IA:")
            diag = a.get("DIAGNOSTICO_IA", "")
            for linea in diag.split("\n"):
                print(f"         {linea}")

    print("\n------------------------------------------------------------------\n")


if __name__ == "__main__":
    main()
