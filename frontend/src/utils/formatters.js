/**
 * Formateadores financieros (COP) y paleta compartida para Plotly.js.
 */

export const PLOTLY_SERIES = {
  ingresos: "#059669",
  gastos: "#DC2626",
  utilidad: "#1E40AF",
  secundario: "#3B82F6",
  alerta: "#D97706",
};

export const PLOTLY_CATEGORICAL = [
  "#1E40AF",
  "#059669",
  "#D97706",
  "#3B82F6",
  "#64748B",
  "#DC2626",
  "#0D9488",
];

export function formatCOP(valor) {
  if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return "—";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(valor));
}

export function formatMillones(valor) {
  if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return "—";
  return `${(Number(valor) / 1e6).toFixed(2)} M COP`;
}

export function formatPct(valor) {
  if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return "—";
  const num = Number(valor);
  const sign = num > 0 ? "+" : "";
  return `${sign}${num.toFixed(2)}%`;
}
