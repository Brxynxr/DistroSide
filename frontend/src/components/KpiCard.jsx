import SourceBadge from "./SourceBadge.jsx";

const TONE_TEXT = {
  positive: "text-positive",
  destructive: "text-destructive",
  primary: "text-primary",
  neutral: "text-ink",
};

/**
 * Tarjeta KPI densa con tipografía monoespaciada tabular-nums y origen SQL explícito.
 */
export default function KpiCard({
  label,
  value,
  subValue,
  tone = "neutral",
  badgeText = "Dato SQL",
  loading = false,
}) {
  const valueClass = TONE_TEXT[tone] || TONE_TEXT.neutral;

  return (
    <article className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <SourceBadge variant="sql">{badgeText}</SourceBadge>
      </div>

      {loading ? (
        <div className="space-y-2 py-1" aria-busy="true">
          <div className="h-7 w-3/4 rounded bg-muted animate-pulse motion-reduce:animate-none" />
          <div className="h-4 w-1/2 rounded bg-muted animate-pulse motion-reduce:animate-none" />
        </div>
      ) : (
        <div>
          <div className={`font-mono text-2xl font-bold tracking-tight tabular-nums ${valueClass}`}>
            {value}
          </div>
          <div className="font-mono text-xs tabular-nums text-muted-foreground mt-0.5">
            {subValue}
          </div>
        </div>
      )}
    </article>
  );
}
