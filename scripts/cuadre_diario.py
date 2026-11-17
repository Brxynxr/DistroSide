#!/usr/bin/env python3
"""CLI para ejecutar o consultar el Cuadre Diario de Ventas y Liquidez (DataFinance AI).

Uso:
    python scripts/cuadre_diario.py                     # Cuadre de la última fecha registrada
    python scripts/cuadre_diario.py --fecha 2026-10-31  # Cuadre para una fecha específica
    python scripts/cuadre_diario.py --fecha 2026-10-04  # Fecha con alerta crítica de iliquidez
    python scripts/cuadre_diario.py --historial         # Listar bitácora de cuadres previos
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Asegurar path del proyecto
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.daily_reconciliation import (
    ejecutar_cuadre_diario,
    listar_historial_cuadres,
)


def _formatear_pesos(monto: float | None) -> str:
    if monto is None:
        return "$0 COP"
    return f"${monto:,.0f} COP"


def _formatear_millones(monto: float | None) -> str:
    if monto is None:
        return "$0.00 M COP"
    return f"${monto / 1_000_000:,.2f} M COP"


def imprimir_tarjeta_cuadre(res: dict) -> None:
    estado = res.get("estado_liquidez", "OPTIMA")
    badge = {
        "OPTIMA": "\033[92m[ÓPTIMA]\033[0m",
        "ADVERTENCIA": "\033[93m[ADVERTENCIA]\033[0m",
        "CRITICA": "\033[91m[CRÍTICA]\033[0m",
    }.get(estado, f"[{estado}]")

    print("\n" + "=" * 76)
    print(f"💰 CUADRE DIARIO DE VENTAS Y TESORERÍA — DISTRIBUIDORA DEL CARIBE S.A.S.")
    print("=" * 76)
    print(f"Fecha analizada       : {res.get('fecha')}   Estado de Liquidez: {badge}")
    print(f"Transacciones ventas  : {res.get('total_transacciones')}")
    print(f"Venta total del día   : {_formatear_pesos(res.get('total_ventas'))} ({_formatear_millones(res.get('total_ventas'))})")
    print("-" * 76)
    print("COMPOSICIÓN DE RECAUDO:")
    print(f"  • Contado (Efectivo/Transf.) : {_formatear_pesos(res.get('ventas_contado')):>16} | {res.get('ratio_contado_pct', 0.0):>6.2f}% (Meta >= 45%)")
    print(f"  • Ventas a Crédito           : {_formatear_pesos(res.get('ventas_credito')):>16} | {res.get('ratio_credito_pct', 0.0):>6.2f}%")
    print(f"  • Servicios y Otros          : {_formatear_pesos(res.get('servicios')):>16} | {res.get('servicios', 0.0) / (res.get('total_ventas') or 1) * 100:>6.2f}%")
    print("-" * 76)

    top_tx = res.get("top_ventas", [])
    if top_tx:
        print("PRINCIPALES OPERACIONES COMERCIALES DEL DÍA:")
        for i, tx in enumerate(top_tx, 1):
            desc = tx.get("DESCRIPCION", "")
            monto = _formatear_pesos(tx.get("MONTO"))
            cat = tx.get("CATEGORIA", "")
            print(f"  {i}. {desc:<45} | {monto:>15} ({cat})")
        print("-" * 76)

    print("DICTAMEN EJECUTIVO DE TESORERÍA (IA / Snowflake):")
    print(res.get("sintesis_tesoreria", "Sin síntesis"))
    print("-" * 76)
    print(f"Auditoría Snowflake   : ID_CUADRE #{res.get('id_cuadre')} | Registrado: {res.get('registrado_en')}")
    print("=" * 76 + "\n")


def imprimir_historial(limite: int) -> None:
    filas = listar_historial_cuadres(limite)
    if not filas:
        print("\nNo hay cuadres diarios registrados aún en Snowflake.")
        return

    print("\n" + "=" * 92)
    print(f"📋 HISTORIAL DE CUADRES DIARIOS DE LIQUIDEZ (Últimos {len(filas)})")
    print("=" * 92)
    print(f"{'ID':<6} {'FECHA':<12} {'VENTA TOTAL':<16} {'CONTADO':<14} {'CRÉDITO':<14} {'RATIO C%':<10} {'ESTADO':<12}")
    print("-" * 92)
    for f in filas:
        id_c = str(f.get("ID_CUADRE", ""))
        fecha = str(f.get("FECHA", ""))
        total = _formatear_millones(f.get("TOTAL_VENTAS"))
        cont = _formatear_millones(f.get("VENTAS_CONTADO"))
        cred = _formatear_millones(f.get("VENTAS_CREDITO"))
        ratio = f"{f.get('RATIO_CONTADO_PCT', 0.0):.1f}%"
        estado = str(f.get("ESTADO_LIQUIDEZ", ""))
        print(f"{id_c:<6} {fecha:<12} {total:<16} {cont:<14} {cred:<14} {ratio:<10} {estado:<12}")
    print("=" * 92 + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Cuadre Diario de Ventas y Monitoreo de Liquidez (DataFinance AI)"
    )
    parser.add_argument("--fecha", type=str, help="Fecha específica a evaluar (YYYY-MM-DD)")
    parser.add_argument(
        "--historial",
        action="store_true",
        help="Mostrar bitácora de cuadres previamente registrados",
    )
    parser.add_argument(
        "--limite",
        type=int,
        default=10,
        help="Límite de registros para la bitácora (default: 10)",
    )
    parser.add_argument(
        "--disparador",
        type=str,
        default="MANUAL_CLI",
        help="Identificador del originador de la ejecución",
    )

    args = parser.parse_args()

    if args.historial:
        imprimir_historial(args.limite)
        return

    try:
        resultado = ejecutar_cuadre_diario(fecha=args.fecha, disparador=args.disparador)
        imprimir_tarjeta_cuadre(resultado)
    except Exception as exc:
        print(f"\n❌ Error al ejecutar el cuadre diario: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
