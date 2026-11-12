import { RefreshCw, Sparkles } from "lucide-react";
import SourceBadge from "../components/SourceBadge.jsx";

/**
 * Vista 4: Reportes Ejecutivos (DAG manual Airflow AI_AGG + análisis bajo demanda Groq).
 */
export default function ReportsView({
  reporteGroq,
  reportes,
  loadingReporte,
  msgReporte,
  onGenerarAirflow,
  onGenerarGroq,
}) {
  const isError = msgReporte.startsWith("Error:");

  return (
    <div className="space-y-4">
      <section className="bg-card border border-border rounded-xl p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h3 className="font-sans text-base font-semibold text-foreground">
              Generación de Reportes Ejecutivos
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              El reporte oficial en Snowflake corre bajo demanda vía Airflow (<code className="font-mono">datafinance_reporte</code>{" "}
              + <code className="font-mono">AI_AGG</code>); también puedes redactar un resumen sobre los filtros activos con Groq.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loadingReporte}
              onClick={onGenerarAirflow}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground cursor-pointer transition-colors duration-150 motion-reduce:transition-none hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              <span>Disparar DAG Airflow (AI_AGG)</span>
            </button>

            <button
              type="button"
              disabled={loadingReporte}
              onClick={onGenerarGroq}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary cursor-pointer transition-colors duration-150 motion-reduce:transition-none hover:bg-blue-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              <span>{loadingReporte ? "Generando..." : "Analizar periodo filtrado (Groq)"}</span>
            </button>
          </div>
        </div>

        {msgReporte && (
          <div
            role={isError ? "alert" : "status"}
            className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
              isError
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-amber-300 bg-amber-50 text-amber-900"
            }`}
          >
            {msgReporte}
          </div>
        )}
      </section>

      {reporteGroq && (
        <article className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-sans text-base font-semibold text-foreground">
              Análisis del periodo{" "}
              <span className="font-mono">
                {reporteGroq.periodo_desde} → {reporteGroq.periodo_hasta}
              </span>
            </h4>
            <SourceBadge variant="ai" showIcon>
              Explicación IA · {reporteGroq.modelo}
            </SourceBadge>
          </div>
          <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm leading-relaxed text-ink whitespace-pre-line">
            {reporteGroq.reporte_texto}
          </div>
        </article>
      )}

      {reportes.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
          Aún no hay reportes guardados en <code className="font-mono">GOLD.REPORTES</code>.
        </div>
      ) : (
        reportes.map((rep) => (
          <article
            key={rep.ID_REPORTE}
            className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-sans text-base font-semibold text-foreground">
                Reporte <span className="font-mono">#{rep.ID_REPORTE}</span> (
                <span className="font-mono">
                  {rep.PERIODO_DESDE} → {rep.PERIODO_HASTA}
                </span>
                )
              </h4>
              <div className="flex flex-wrap gap-1.5">
                <SourceBadge variant="ai" showIcon>
                  Explicación IA · {rep.MODELO}
                </SourceBadge>
                <SourceBadge variant="sql" showIcon>
                  {new Date(rep.GENERADO_EN).toLocaleString("es-CO")}
                </SourceBadge>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm leading-relaxed text-ink whitespace-pre-line">
              {rep.REPORTE_TEXTO}
            </div>
          </article>
        ))
      )}
    </div>
  );
}
