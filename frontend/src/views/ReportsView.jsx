import { useState } from "react";
import {
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  CreditCard,
  DollarSign,
  Eye,
  EyeOff,
  FileDown,
  FileText,
  Percent,
  RefreshCw,
  Wallet,
} from "lucide-react";
import MarkdownRenderer from "../components/MarkdownRenderer.jsx";
import SourceBadge from "../components/SourceBadge.jsx";
import AlertBanner from "../components/ui/AlertBanner.jsx";
import Button from "../components/ui/Button.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { formatMillones } from "../utils/formatters.js";

/**
 * Vista: Reportes Ejecutivos — Generación y descarga directa en formato PDF ejecutivo.
 */
export default function ReportsView({
  kpis,
  reporteGroq,
  reportes,
  loadingReporte,
  msgReporte,
  onGenerarSnowflake,
  onGenerarGroq,
  onDescargarPdfBajoDemanda,
  onDescargarPdfOficial,
}) {
  const [copiadoId, setCopiadoId] = useState(null);
  const [verPreviewGroq, setVerPreviewGroq] = useState(false);
  const [previewAbiertoId, setPreviewAbiertoId] = useState(null);
  const [descargandoId, setDescargandoId] = useState(null);

  const isError = msgReporte?.startsWith("Error:");
  const resumen = kpis?.resumen || {};

  const copiarTexto = async (id, texto) => {
    try {
      await navigator.clipboard.writeText(texto || "");
      setCopiadoId(id);
      setTimeout(() => setCopiadoId(null), 1800);
    } catch {
      // Sin permiso de portapapeles
    }
  };

  const handleDescargarBajoDemanda = async () => {
    if (!reporteGroq) return;
    setDescargandoId("groq");
    try {
      if (onDescargarPdfBajoDemanda) {
        await onDescargarPdfBajoDemanda(reporteGroq);
      }
    } finally {
      setDescargandoId(null);
    }
  };

  const handleDescargarOficial = async (idReporte) => {
    setDescargandoId(idReporte);
    try {
      if (onDescargarPdfOficial) {
        await onDescargarPdfOficial(idReporte);
      }
    } finally {
      setDescargandoId(null);
    }
  };

  const togglePreviewOficial = (id) => {
    setPreviewAbiertoId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Barra de generación y controles principales */}
      <section className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-3 border-b border-border/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-primary shrink-0">
              <FileText className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink">
                Generación y Descarga de Informes Financieros en PDF
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Genera informes ejecutivos con diseño corporativo oficial y descárgalos directamente en formato PDF.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="md"
              icon={RefreshCw}
              disabled={loadingReporte}
              onClick={onGenerarSnowflake}
              className="shadow-xs"
              title="Ejecuta y persiste el reporte en la capa GOLD de Snowflake"
            >
              Persistir en Snowflake (AI_AGG)
            </Button>

            <Button
              variant="primary"
              size="md"
              icon={FileDown}
              loading={loadingReporte}
              onClick={onGenerarGroq}
              className="shadow-xs"
            >
              {loadingReporte ? "Generando informe..." : "Generar y Descargar Informe PDF"}
            </Button>
          </div>
        </div>

        {/* Cinta de contexto cuantitativo del filtro */}
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
          <AlertBanner type={isError ? "error" : "success"}>{msgReporte}</AlertBanner>
        )}
      </section>

      {/* Tarjeta de descarga del reporte recién generado */}
      {reporteGroq && (
        <section className="bg-gradient-to-r from-blue-50/80 via-white to-slate-50 border border-blue-200 rounded-xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-blue-100">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 shadow-xs">
                <FileDown className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Listo para descargar
                  </span>
                  <SourceBadge variant="ai">{reporteGroq.modelo}</SourceBadge>
                </div>
                <h3 className="text-base font-bold text-ink mt-1">
                  Informe Financiero Ejecutivo: {reporteGroq.periodo_desde} → {reporteGroq.periodo_hasta}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  El informe contiene la portada corporativa, tarjetas de métricas, distribución operativa y redacción analítica estructurada.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                variant="primary"
                size="md"
                icon={FileDown}
                loading={descargandoId === "groq"}
                onClick={handleDescargarBajoDemanda}
                className="shadow-sm font-semibold"
              >
                Descargar PDF
              </Button>

              <Button
                size="md"
                variant="secondary"
                icon={verPreviewGroq ? EyeOff : Eye}
                onClick={() => setVerPreviewGroq(!verPreviewGroq)}
                className="text-xs"
              >
                {verPreviewGroq ? "Ocultar texto" : "Vista previa en texto"}
              </Button>

              <Button
                size="md"
                variant="ghost"
                icon={copiadoId === "groq" ? Check : Copy}
                onClick={() => copiarTexto("groq", reporteGroq.reporte_texto)}
                className="text-xs"
                title="Copiar texto del reporte"
              >
                {copiadoId === "groq" ? "Copiado" : "Copiar"}
              </Button>
            </div>
          </div>

          {/* Vista previa colapsable para no invadir la pantalla */}
          {verPreviewGroq && (
            <div className="mt-3 bg-white rounded-xl p-5 border border-slate-200 shadow-inner space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs text-muted-foreground">
                <span className="font-medium text-slate-700">Contenido textual del informe</span>
                <span>Distribuidora del Caribe S.A.S.</span>
              </div>
              <MarkdownRenderer content={reporteGroq.reporte_texto} />
            </div>
          )}
        </section>
      )}

      {/* Historial de reportes oficiales guardados en Snowflake GOLD.REPORTES */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Historial de reportes oficiales (Snowflake GOLD)
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Informes persistidos auditables disponibles para consulta y descarga en PDF en cualquier momento.
            </p>
          </div>
          <span className="text-xs font-medium text-slate-500 tabular-nums">
            {reportes.length} {reportes.length === 1 ? "reporte registrado" : "reportes registrados"}
          </span>
        </div>

        {reportes.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No hay reportes persistidos en Snowflake"
            description="Haz clic en 'Persistir en Snowflake' para compilar un reporte oficial o genera uno bajo demanda con el botón de arriba."
          />
        ) : (
          <div className="space-y-3">
            {reportes.map((rep) => {
              const estaAbierto = previewAbiertoId === rep.ID_REPORTE;
              return (
                <article
                  key={rep.ID_REPORTE}
                  className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs hover:border-slate-300 transition-colors space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                        <Building2 className="w-4 h-4" aria-hidden="true" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-ink tabular-nums">
                            Reporte Oficial #{rep.ID_REPORTE} · {rep.PERIODO_DESDE} → {rep.PERIODO_HASTA}
                          </h4>
                          <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            Oficial
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Registrado en Snowflake GOLD · {new Date(rep.GENERADO_EN).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <SourceBadge variant="ai" showIcon>
                        {rep.MODELO}
                      </SourceBadge>

                      <Button
                        size="sm"
                        variant="primary"
                        icon={FileDown}
                        loading={descargandoId === rep.ID_REPORTE}
                        onClick={() => handleDescargarOficial(rep.ID_REPORTE)}
                        className="h-8 text-xs font-medium"
                      >
                        Descargar PDF
                      </Button>

                      <Button
                        size="sm"
                        variant="secondary"
                        icon={estaAbierto ? ChevronUp : ChevronDown}
                        onClick={() => togglePreviewOficial(rep.ID_REPORTE)}
                        className="h-8 text-xs"
                      >
                        {estaAbierto ? "Ocultar" : "Vista previa"}
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        icon={copiadoId === rep.ID_REPORTE ? Check : Copy}
                        onClick={() => copiarTexto(rep.ID_REPORTE, rep.REPORTE_TEXTO)}
                        className="h-8 text-xs"
                        title="Copiar texto"
                      >
                        {copiadoId === rep.ID_REPORTE ? "Copiado" : "Copiar"}
                      </Button>
                    </div>
                  </div>

                  {/* Vista previa expandible por reporte */}
                  {estaAbierto && (
                    <div className="pt-3 border-t border-border/80">
                      <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 text-xs">
                        <MarkdownRenderer content={rep.REPORTE_TEXTO} />
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
