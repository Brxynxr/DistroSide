import { AlertTriangle, CheckCircle2, Database, Sparkles } from "lucide-react";

const BADGE_STYLES = {
  sql: "bg-blue-50 text-blue-800 border-blue-200",
  alert: "bg-amber-50 text-amber-800 border-amber-300",
  danger: "bg-red-50 text-red-700 border-red-200",
  positive: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ai: "bg-slate-100 text-slate-700 border-slate-300",
};

const ICON_MAP = {
  sql: Database,
  alert: AlertTriangle,
  danger: AlertTriangle,
  positive: CheckCircle2,
  ai: Sparkles,
};

/**
 * Badge semántico para distinguir origen SQL, Alertas Estadísticas y Explicaciones IA.
 */
export default function SourceBadge({ variant = "sql", showIcon = false, children, className = "" }) {
  const styles = BADGE_STYLES[variant] || BADGE_STYLES.sql;
  const Icon = showIcon ? ICON_MAP[variant] : null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${styles} ${className}`}
    >
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
      {children}
    </span>
  );
}
