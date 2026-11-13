/**
 * Formateadores financieros (COP) y sistema de tokens visuales para gráficas Plotly.js
 * Basado en las directrices de diseño UI/UX Pro Max (SaaS Fintech / Swiss Minimalism).
 */

export const PLOTLY_SERIES = {
  ingresos: "#059669",     // Emerald 600 (ingresos / positivo)
  ingresosBorder: "#047857",
  gastos: "#DC2626",       // Red 600 (gastos / salidas)
  gastosBorder: "#B91C1C",
  utilidad: "#2563EB",     // Blue 600 (utilidad / rendimiento)
  utilidadBorder: "#1D4ED8",
  secundario: "#0F172A",   // Navy / Ink profundo
  alerta: "#D97706",       // Amber 600 (advertencias estadísticas)
  alertaBorder: "#B45309",
  critica: "#DC2626",      // Red 600 (anomalías severas >= 3.5σ)
  criticaBorder: "#991B1B",
  neutral: "#64748B",      // Slate 500 (metadatos / baseline)
  grid: "#F1F5F9",         // Slate 100 (líneas guía sutiles)
  border: "#E2E8F0",       // Slate 200 (líneas base y ejes)
};

export const PLOTLY_CATEGORICAL = [
  "#2563EB", // Primary Blue
  "#059669", // Emerald
  "#D97706", // Amber
  "#7C3AED", // Violet
  "#0284C7", // Sky Blue
  "#DC2626", // Red / Coral
  "#475569", // Slate
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
