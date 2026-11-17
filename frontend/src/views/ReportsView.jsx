import { useState } from "react";
import {
  AlertCircle,
  Building2,
  Calendar,
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
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import MarkdownRenderer from "../components/MarkdownRenderer.jsx";
import SourceBadge from "../components/SourceBadge.jsx";
import AlertBanner from "../components/ui/AlertBanner.jsx";
import Button from "../components/ui/Button.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { formatMillones } from "../utils/formatters.js";

/**
 * Vista: Reportes Ejecutivos & Cierre Mensual Automatizado (Executive Pack).
 */
export default function ReportsView({
  kpis,
  reporteGroq,
  reportes,
  cierres = [],
  loadingReporte,
  loadingCierre = false,
  msgReporte,
  msgCierre,
  onGenerarSnowflake,
  onGenerarGroq,
  onDescargarPdfBajoDemanda,
  onDescargarPdfOficial,
  onEjecutarCierre,
  onDescargarPdfCierre,
}) {
  const [copiadoId, setCopiadoId] = useState(null);
  const [verPreviewGroq, setVerPreviewGroq] = useState(false);
  const [previewAbiertoId, setPreviewAbiertoId] = useState(null);
  const [descargandoId, setDescargandoId] = useState(null);

  // Estado del Cierre Mensual
  const [mesCierreSeleccionado, setMesCierreSeleccionado] = useState("");
  const [forzarCierre, setForzarCierre] = useState(false);
  const [verHistorialCierres, setVerHistorialCierres] = useState(true);

  const isErrorReporte = msgReporte?.startsWith("Error:");
  const isErrorCierre = msgCierre?.startsWith("Error:");
  const resumen = kpis?.resumen || {};
  const mesesDisponibles = kpis?.filtros_disponibles?.meses || [];
  const ultimoCierre = cierres && cierres.length > 0 ? cierres[0] : null;

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

  const handleDescargarCierre = async (idCierre, nombrePdf) => {
    setDescargandoId(`cierre-${idCierre}`);
    try {
      if (onDescargarPdfCierre) {
        await onDescargarPdfCierre(idCierre, nombrePdf);
      }
    } finally {
      setDescargandoId(null);
    }
  };

  const handleEjecutarCierre = async () => {
    if (onEjecutarCierre) {
      await onEjecutarCierre(mesCierreSeleccionado || null, forzarCierre);
    }
  };

  const togglePreviewOficial = (id) => {
    setPreviewAbiertoId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-5">
      {/* 1. SECCIÓN DESTACADA: CIERRE FINANCIERO MENSUAL AUTOMATIZADO (EXECUTIVE PACK) */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white border border-slate-700/80 rounded-2xl p-5 sm:p-6 shadow-md space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-700/60">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-300 flex items-center justify-center shrink-0 shadow-inner">
              <Sparkles className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-200 border border-blue-400/30">
                  Automatización Enterprise
                </span>
                <span className="text-xs text-slate-300">Opción 1 · Pipeline Desatendido</span>
              </div>
              <h2 className="text-lg font-bold text-white mt-1">
                Cierre Financiero Mensual & "Executive Pack"
              </h2>
              <p className="text-xs text-slate-300 mt-0.5 max-w-2xl leading-relaxed">
                Ejecuta el recálculo analítico en Snowflake, detecta anomalías estadísticas (Z-Score), redacta
                el análisis cualitativo con IA y compila el informe corporativo oficial en formato PDF para la junta directiva.
              </p>
            </div>
          </div>

          {/* Estado del último cierre */}
          {ultimoCierre && (
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3 sm:px-4 text-xs shrink-0 flex items-center justify-between sm:justify-start gap-4">
              <div>
                <span className="text-[11px] text-slate-400 block font-medium">Último periodo cerrado</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-bold text-sm text-white">{ultimoCierre.MES_CERRADO}</span>
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      ultimoCierre.ESTADO === "EXITOSO"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    }`}
                  >
                    {ultimoCierre.ESTADO === "EXITOSO" ? "100% Normal" : `${ultimoCierre.TOTAL_ANOMALIAS} Anomalías`}
                  </span>
                </div>
              </div>

              <Button
                size="sm"
                variant="primary"
                icon={FileDown}
                loading={descargandoId === `cierre-${ultimoCierre.ID_CIERRE}`}
                onClick={() => handleDescargarCierre(ultimoCierre.ID_CIERRE, ultimoCierre.NOMBRE_ARCHIVO_PDF)}
                className="bg-blue-600 hover:bg-blue-500 text-white font-medium h-9 text-xs"
              >
                Descargar PDF
              </Button>
            </div>
          )}
        </div>

        {/* Panel de Disparo / Configuración de Cierre */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <label htmlFor="select-mes-cierre" className="text-xs text-slate-300 font-medium">
                Periodo:
              </label>
              <select
                id="select-mes-cierre"
                value={mesCierreSeleccionado}
                onChange={(e) => setMesCierreSeleccionado(e.target.value)}
                className="bg-slate-800 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-hidden focus:ring-1 focus:ring-blue-400"
              >
                <option value="">(Auto: Último mes completo)</option>
                {mesesDisponibles.map((m) => (
                  <option key={m.ANIO_MES} value={m.ANIO_MES}>
                    {m.ANIO_MES} {m.ES_COMPLETO ? "" : "(Mes parcial)"}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={forzarCierre}
                onChange={(e) => setForzarCierre(e.target.checked)}
                className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-0"
              />
              <span>Forzar recálculo si ya existe</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="md"
              icon={Play}
              loading={loadingCierre}
              disabled={loadingCierre}
              onClick={handleEjecutarCierre}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm"
            >
              {loadingCierre ? "Orquestando Cierre..." : "Ejecutar Cierre Automatizado"}
            </Button>
          </div>
        </div>

        {msgCierre && (
          <div className="pt-2">
            <AlertBanner type={isErrorCierre ? "error" : "success"}>{msgCierre}</AlertBanner>
          </div>
        )}

        {/* Bitácora de cierres realizados */}
        {cierres.length > 0 && (
          <div className="pt-3 border-t border-slate-700/60">
            <div className="flex items-center justify-between pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Bitácora de Cierres Registrados ({cierres.length})
              </span>
              <button
                type="button"
                onClick={() => setVerHistorialCierres(!verHistorialCierres)}
                className="text-xs text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                {verHistorialCierres ? "Ocultar historial" : "Mostrar historial"}
                {verHistorialCierres ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {verHistorialCierres && (
              <div className="overflow-x-auto rounded-lg border border-slate-700/80 bg-slate-900/60">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700">
                    <tr>
                      <th className="py-2 px-3">Periodo</th>
                      <th className="py-2 px-3">Estado</th>
                      <th className="py-2 px-3">Ingresos</th>
                      <th className="py-2 px-3">Gastos</th>
                      <th className="py-2 px-3">Utilidad</th>
                      <th className="py-2 px-3">Margen</th>
                      <th className="py-2 px-3">Anomalías</th>
                      <th className="py-2 px-3">Fecha Cierre</th>
                      <th className="py-2 px-3 text-right">Executive Pack</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300 tabular-nums">
                    {cierres.map((c) => (
                      <tr key={c.ID_CIERRE} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-white">{c.MES_CERRADO}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              c.ESTADO === "EXITOSO"
                                ? "bg-emerald-500/20 text-emerald-300"
                                : "bg-amber-500/20 text-amber-300"
                            }`}
                          >
                            {c.ESTADO === "EXITOSO" ? (
                              <ShieldCheck className="w-3 h-3" />
                            ) : (
                              <AlertCircle className="w-3 h-3" />
                            )}
                            {c.ESTADO}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-emerald-400">{formatMillones(c.INGRESOS)}</td>
                        <td className="py-2.5 px-3 text-rose-400">{formatMillones(c.GASTOS)}</td>
                        <td className="py-2.5 px-3 font-semibold text-white">{formatMillones(c.UTILIDAD)}</td>
                        <td className="py-2.5 px-3">{c.MARGEN_PCT ?? 0}%</td>
                        <td className="py-2.5 px-3">
                          {c.TOTAL_ANOMALIAS > 0 ? (
                            <span className="text-amber-400 font-medium">{c.TOTAL_ANOMALIAS} atípica(s)</span>
                          ) : (
                            <span className="text-slate-500">0</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                          {c.FECHA_EJECUCION
                            ? new Date(c.FECHA_EJECUCION).toLocaleString("es-CO", {
                                dateStyle: "short",
                                timeStyle: "short",
                              })
                            : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={FileDown}
                            loading={descargandoId === `cierre-${c.ID_CIERRE}`}
                            onClick={() => handleDescargarCierre(c.ID_CIERRE, c.NOMBRE_ARCHIVO_PDF)}
                            className="h-7 text-xs text-blue-300 hover:text-white hover:bg-blue-600/30"
                            title="Descargar Executive Pack en PDF"
                          >
                            PDF
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 2. GENERACIÓN MANUAL BAJO DEMANDA SEGÚN FILTROS ACTIVOS */}
      <section className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-3 border-b border-border/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-primary shrink-0">
              <FileText className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink">
                Informes Filtrados Bajo Demanda
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Genera un informe ejecutivo a medida para el rango de fechas, categoría o área filtrada en el dashboard.
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
              title="Ejecuta y persiste el reporte en la capa PUBLIC de Snowflake (AI_AGG)"
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
          <AlertBanner type={isErrorReporte ? "error" : "success"}>{msgReporte}</AlertBanner>
        )}
      </section>

      {/* 3. VISTA PREVIA Y DESCARGA DEL REPORTE GENERADO BAJO DEMANDA */}
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

      {/* 4. HISTORIAL DE REPORTES OFICIALES GUARDADOS EN SNOWFLAKE */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Historial de Reportes Oficiales en Snowflake (DATAFINANCE.PUBLIC.REPORTES)
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
            description="Haz clic en 'Persistir en Snowflake' o ejecuta un Cierre Automatizado para compilar un reporte oficial."
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
                            Reporte #{rep.ID_REPORTE} · {rep.PERIODO_DESDE} → {rep.PERIODO_HASTA}
                          </h4>
                          <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            Oficial
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Registrado en Snowflake · {new Date(rep.GENERADO_EN).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}
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
