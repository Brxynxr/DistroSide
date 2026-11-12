import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";

const ALERT_STYLES = {
  error: "bg-red-50 text-red-900 border-red-200",
  warning: "bg-amber-50 text-amber-900 border-amber-200",
  success: "bg-emerald-50 text-emerald-900 border-emerald-200",
  info: "bg-blue-50 text-blue-900 border-blue-200",
};

const ALERT_ICONS = {
  error: AlertCircle,
  warning: AlertTriangle,
  success: CheckCircle2,
  info: Info,
};

/**
 * Banner de alerta accesible con role="alert" y diseño limpio.
 */
export default function AlertBanner({ type = "warning", title, children, className = "" }) {
  const styles = ALERT_STYLES[type] || ALERT_STYLES.warning;
  const Icon = ALERT_ICONS[type] || Info;

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-lg border p-3 text-xs leading-relaxed ${styles} ${className}`}
    >
      <Icon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1">
        {title && <strong className="font-semibold block mb-0.5">{title}</strong>}
        <div>{children}</div>
      </div>
    </div>
  );
}
