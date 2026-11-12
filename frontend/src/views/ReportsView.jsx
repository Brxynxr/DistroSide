import { useState } from "react";
import {
  Building2,
  Check,
  Coins,
  Copy,
  CreditCard,
  DollarSign,
  FileText,
  Percent,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import MarkdownRenderer from "../components/MarkdownRenderer.jsx";
import SourceBadge from "../components/SourceBadge.jsx";
import AlertBanner from "../components/ui/AlertBanner.jsx";
import Button from "../components/ui/Button.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { formatMillones } from "../utils/formatters.js";

/**
 * Vista 4: Reportes Ejecutivos — Contexto numérico de referencia + narrativas IA formateadas.
 */
export default function ReportsView({
  kpis,
  reporteGroq,
  reportes,
  loadingReporte,
  msgReporte,
  onGenerarAirflow,
  onGenerarGroq,
}) {
  const [copiadoId, setCopiadoId] = useState(null);
  const isError = msgReporte.startsWith("Error:");
  const resumen = kpis?.resumen || {};

  const copiarTexto = async (id, texto) => {
    try {
      await navigator.clipboard.writeText(texto || "");
      setCopiadoId(id);
      setTimeout(() => setCopiadoId(null), 1800);
    } catch {
      // Sin permiso de portapapeles; no interrumpir UI
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Barra de generación + contexto financiero del filtro */}
      <section className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-3 border-b border-border/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-primary shrink-0">
              <FileText className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink">
                Generación y consulta de reportes ejecutivos
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Persistidos en Snowflake vía Airflow (<code className="font-mono text-ink">AI_AGG</code>) o análisis instantáneo en Groq sobre filtros activos.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="md"
              icon={RefreshCw}
              disabled={loadingReporte}
              onClick={onGenerarAirflow}
              className="shadow-xs"
            >
              Disparar DAG Airflow (AI_AGG)
            </Button>

            <Button
              variant="primary"
              size="md"
              icon={Sparkles}
              loading={loadingReporte}
              onClick={onGenerarGroq}
              className="shadow-xs"
            >
              {loadingReporte ? "Generando reporte..." : "Analizar periodo filtrado (Groq)"}
            </Button>
          </div>
        </div>

        {/* Cinta de indicadores base del periodo seleccionado */}
        {resumen.periodo_desde && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-xs tabular-nums">
            <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-100 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-medium text-emerald-800 block">Ingresos del filtro</span>
                <strong className="text-sm font-bold text-positive">
                  {formatMillones(resumen.ingresos_totales)}
                </strong>
              </div>
              <DollarSign className="w-4 h-4 text-emerald-600 shrink-0 opacity-70" />
            </div>

            <div className="p-3 rounded-lg bg-rose-50/60 border border-rose-100 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-medium text-rose-800 block">Gastos del filtro</span>
                <strong className="text-sm font-bold text-destructive">
                  {formatMillones(resumen.gastos_totales)}
                </strong>
              </div>
              <CreditCard className="w-4 h-4 text-rose-600 shrink-0 opacity-70" />
            </div>

            <div className="p-3 rounded-lg bg-blue-50/60 border border-blue-100 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-medium text-blue-800 block">Utilidad neta</span>
                <strong className="text-sm font-bold text-ink">
                  {formatMillones(resumen.utilidad_total)}
                </strong>
              </div>
              <Wallet className="w-4 h-4 text-blue-600 shrink-0 opacity-70" />
            </div>

            <div className="p-3 rounded-lg bg-slate-100/70 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-medium text-slate-700 block">Margen operativo</span>
                <strong className="text-sm font-bold text-ink">{resumen.margen_pct ?? 0}%</strong>
              </div>
              <Percent className="w-4 h-4 text-slate-600 shrink-0 opacity-70" />
            </div>
          </div>
        )}

        {msgReporte && (
          <AlertBanner type={isError ? "error" : "warning"}>{msgReporte}</AlertBanner>
        )}
      </section>

      {/* Reporte generado bajo demanda con Groq */}
      {reporteGroq && (
        <article className="bg-card border border-blue-200/90 rounded-xl p-5 sm:p-6 shadow-sm space-y-4 hover:border-blue-300 transition-colors">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border/80">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <Sparkles className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary block">
                  Informe Ejecutivo Bajo Demanda
                </span>
                <h3 className="text-[15px] font-bold text-ink mt-0.5 tabular-nums">
                  Periodo analizado: {reporteGroq.periodo_desde} → {reporteGroq.periodo_hasta}
                </h3>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <SourceBadge variant="ai" showIcon>
                {reporteGroq.modelo}
              </SourceBadge>
              <Button
                size="sm"
                variant="ghost"
                icon={copiadoId === "groq" ? Check : Copy}
                onClick={() => copiarTexto("groq", reporteGroq.reporte_texto)}
                className="h-8 text-xs"
              >
                {copiadoId === "groq" ? "Copiado" : "Copiar informe"}
              </Button>
            </div>
          </div>

          <div className="bg-slate-50/70 rounded-xl p-5 border border-slate-200/80 border-l-4 border-l-primary shadow-xs">
            <MarkdownRenderer content={reporteGroq.reporte_texto} />
          </div>
        </article>
      )}

      {/* Reportes oficiales guardados en Snowflake GOLD.REPORTES */}
      {reportes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No hay reportes persistidos en Snowflake"
          description="Ejecuta el DAG datafinance_reporte desde Airflow o solicita un análisis inmediato del periodo filtrado arriba."
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Historial de reportes oficiales (Snowflake GOLD)
            </span>
            <span className="text-xs font-medium text-slate-500 tabular-nums">
              {reportes.length} {reportes.length === 1 ? "reporte registrado" : "reportes registrados"}
            </span>
          </div>

          {reportes.map((rep) => (
            <article
              key={rep.ID_REPORTE}
              className="bg-card border border-border rounded-xl p-5 sm:p-6 shadow-xs space-y-4 hover:border-slate-300 transition-colors"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border/80">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                    <Building2 className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold text-ink tabular-nums">
                      Reporte Oficial #{rep.ID_REPORTE} · {rep.PERIODO_DESDE} → {rep.PERIODO_HASTA}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Persistido en Snowflake GOLD.REPORTES con reproducibilidad total
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <SourceBadge variant="ai" showIcon>
                    {rep.MODELO}
                  </SourceBadge>
                  <SourceBadge variant="sql">
                    {new Date(rep.GENERADO_EN).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}
                  </SourceBadge>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={copiadoId === rep.ID_REPORTE ? Check : Copy}
                    onClick={() => copiarTexto(rep.ID_REPORTE, rep.REPORTE_TEXTO)}
                    className="h-8 text-xs"
                  >
                    {copiadoId === rep.ID_REPORTE ? "Copiado" : "Copiar reporte"}
                  </Button>
                </div>
              </div>

              <div className="bg-slate-50/70 rounded-xl p-5 border border-slate-200/80 shadow-xs">
                <MarkdownRenderer content={rep.REPORTE_TEXTO} />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
