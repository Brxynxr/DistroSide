import { HelpCircle, TrendingDown, TrendingUp } from "lucide-react";
import Tooltip from "./ui/Tooltip.jsx";

const TONE_TEXT = {
  positive: "text-positive",
  destructive: "text-destructive",
  primary: "text-primary",
  neutral: "text-ink",
};

const DELTA_PILL = {
  positive: "text-emerald-700 bg-emerald-50 border border-emerald-200/60",
  negative: "text-rose-700 bg-rose-50 border border-rose-200/60",
  neutral: "text-slate-600 bg-slate-100 border border-slate-200/60",
};

const ICON_ACCENTS = {
  positive: "bg-emerald-50 text-emerald-600 border-emerald-100",
  destructive: "bg-rose-50 text-rose-600 border-rose-100",
  primary: "bg-blue-50 text-blue-600 border-blue-100",
  neutral: "bg-slate-100 text-slate-600 border-slate-200",
};

/**
 * Tarjeta KPI protagonista estilo SaaS financiero (Stripe / Ramp / Mercury).
 * Muestra comparación real con el periodo anterior únicamente si existe dato válido.
 */
export default function KpiCard({
  label,
  value,
  subValue,
  icon: Icon,
  tone = "neutral",
  tooltip,
  deltaPct = null,
  deltaUnit = "%",
  deltaLabel = "",
  invertDeltaColor = false,
  loading = false,
}) {
  const valueClass = TONE_TEXT[tone] || TONE_TEXT.neutral;
  const iconAccent = ICON_ACCENTS[tone] || ICON_ACCENTS.neutral;

  const hasDelta =
    deltaPct !== null && deltaPct !== undefined && !Number.isNaN(Number(deltaPct));
  const numDelta = hasDelta ? Number(deltaPct) : 0;

  let deltaTone = "neutral";
  if (hasDelta && numDelta !== 0) {
    const isPositiveMove = numDelta > 0;
    deltaTone = invertDeltaColor
      ? isPositiveMove
        ? "negative"
        : "positive"
      : isPositiveMove
        ? "positive"
        : "negative";
  }

  return (
    <article className="relative bg-card border border-border rounded-xl p-5 flex flex-col justify-between gap-3 shadow-xs hover:shadow-card-hover hover:border-slate-300 transition-all duration-200 group overflow-hidden">
      {/* Top micro-highlight bar on hover */}
      <div className="absolute top-0 inset-x-0 h-[2px] bg-transparent group-hover:bg-primary/40 transition-colors" />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[13px] font-medium text-muted-foreground truncate">{label}</span>
          {tooltip && (
            <Tooltip text={tooltip}>
              <HelpCircle
                className="w-3.5 h-3.5 text-slate-400 hover:text-ink cursor-help transition-colors shrink-0"
                aria-hidden="true"
              />
            </Tooltip>
          )}
        </div>

        {Icon && (
          <div
            className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${iconAccent}`}
          >
            <Icon className="w-3.5 h-3.5" aria-hidden="true" />
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-2.5 py-0.5" aria-busy="true">
          <div className="h-7 w-2/3 rounded-md bg-muted animate-pulse motion-reduce:animate-none" />
          <div className="h-4 w-1/2 rounded-md bg-muted animate-pulse motion-reduce:animate-none" />
        </div>
      ) : (
        <div className="space-y-1.5">
          <div
            className={`text-[25px] leading-tight font-bold tracking-tight tabular-nums ${valueClass}`}
          >
            {value}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 min-h-[20px]">
            <span className="text-xs text-muted-foreground tabular-nums">{subValue}</span>

            {hasDelta && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${DELTA_PILL[deltaTone]}`}
                title={deltaLabel || "Variación respecto al mes anterior"}
              >
                {numDelta >= 0 ? (
                  <TrendingUp className="w-3 h-3 shrink-0" aria-hidden="true" />
                ) : (
                  <TrendingDown className="w-3 h-3 shrink-0" aria-hidden="true" />
                )}
                <span>
                  {numDelta > 0 ? "+" : ""}
                  {numDelta.toFixed(2)}
                  {deltaUnit}
                </span>
                {deltaLabel && <span className="text-slate-500 font-normal ml-0.5">{deltaLabel}</span>}
              </span>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
