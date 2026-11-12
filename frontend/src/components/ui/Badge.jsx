import { memo } from "react";

const VARIANT_MAP = {
  neutral: "bg-slate-100/80 text-slate-700 border-slate-200/80",
  primary: "bg-blue-50 text-blue-700 border-blue-200/80",
  positive: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
  negative: "bg-rose-50 text-rose-700 border-rose-200/80",
  warning: "bg-amber-50 text-amber-800 border-amber-200/80",
  ai: "bg-indigo-50 text-indigo-700 border-indigo-200/80",
};

/**
 * Badge discreto y minimalista para metadatos, estado de origen y severidad.
 */
function Badge({ variant = "neutral", icon: Icon, dot = false, children, className = "" }) {
  const styles = VARIANT_MAP[variant] || VARIANT_MAP.neutral;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-colors duration-150 motion-reduce:transition-none ${styles} ${className}`}
    >
      {dot && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            variant === "positive"
              ? "bg-emerald-500"
              : variant === "negative"
                ? "bg-rose-500"
                : variant === "warning"
                  ? "bg-amber-500"
                  : variant === "ai"
                    ? "bg-indigo-500"
                    : "bg-blue-500"
          }`}
        />
      )}
      {Icon && <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />}
      <span>{children}</span>
    </span>
  );
}

export default memo(Badge);
