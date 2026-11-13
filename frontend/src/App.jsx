import { useCallback, useEffect, useState } from "react";
import { Calendar, Coins, Clock, Database, Menu, RefreshCw } from "lucide-react";
import GlobalFilters from "./components/GlobalFilters.jsx";
import Sidebar from "./components/Sidebar.jsx";
import AlertBanner from "./components/ui/AlertBanner.jsx";
import Badge from "./components/ui/Badge.jsx";
import Button from "./components/ui/Button.jsx";
import Tooltip from "./components/ui/Tooltip.jsx";
import AnalystView from "./views/AnalystView.jsx";
import AnomaliesView from "./views/AnomaliesView.jsx";
import DashboardView from "./views/DashboardView.jsx";
import ReportsView from "./views/ReportsView.jsx";

const TAB_TITLES = {
  dashboard: "Resumen Financiero",
  chat: "Agente Analista",
  anomalias: "Monitor de Anomalías",
  reportes: "Reportes Ejecutivos",
};

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [health, setHealth] = useState(null);

  // Filtros globales
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [categoria, setCategoria] = useState("TODAS");
  const [area, setArea] = useState("TODAS");
  const [incluirParcial, setIncluirParcial] = useState(false);

  // Datos Snowflake
  const [kpis, setKpis] = useState(null);
  const [anomalias, setAnomalias] = useState([]);
  const [auditoria, setAuditoria] = useState(null);
  const [reportes, setReportes] = useState([]);
  const [loadingKpis, setLoadingKpis] = useState(false);
  const [errorGlobal, setErrorGlobal] = useState("");

  // Chat Groq
  const [pregunta, setPregunta] = useState("");
  const [mensajes, setMensajes] = useState([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [errorChat, setErrorChat] = useState("");

  // Reportes
  const [reporteGroq, setReporteGroq] = useState(null);
  const [loadingReporte, setLoadingReporte] = useState(false);
  const [msgReporte, setMsgReporte] = useState("");

  const cargarHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      setHealth(data);
    } catch {
      setHealth({ status: "offline", snowflake_connected: false, groq_configured: false });
    }
  }, []);

  const cargarKpis = useCallback(
    async (nocache = false) => {
      setLoadingKpis(true);
      setErrorGlobal("");
      try {
        const params = new URLSearchParams();
        if (fechaInicio) params.set("fecha_inicio", fechaInicio);
        if (fechaFin) params.set("fecha_fin", fechaFin);
        if (categoria && categoria !== "TODAS") params.set("categoria", categoria);
        if (area && area !== "TODAS") params.set("area", area);
        params.set("incluir_parcial", String(incluirParcial));
        if (nocache) params.set("nocache", "true");

        const res = await fetch(`/api/kpis?${params.toString()}`);
        if (!res.ok) throw new Error(await res.text());
        setKpis(await res.json());
      } catch (err) {
        setErrorGlobal(`Error cargando KPIs desde Snowflake: ${err.message}`);
      } finally {
        setLoadingKpis(false);
      }
    },
    [fechaInicio, fechaFin, categoria, area, incluirParcial]
  );

  const cargarSecundarios = useCallback(async (nocache = false) => {
    const qs = nocache ? "?nocache=true" : "";
    try {
      const [resAnom, resAud, resRep] = await Promise.all([
        fetch(`/api/anomalias${qs}`),
        fetch(`/api/auditoria${qs}`),
        fetch(`/api/reportes${qs}`),
      ]);
      if (resAnom.ok) {
        const dataAnom = await resAnom.json();
        setAnomalias(dataAnom.anomalias || []);
      }
      if (resAud.ok) setAuditoria(await resAud.json());
      if (resRep.ok) {
        const dataRep = await resRep.json();
        setReportes(dataRep.reportes || []);
      }
    } catch {
      // Silenciado; la vista principal ya reporta estado de API
    }
  }, []);

  useEffect(() => {
    cargarHealth();
    cargarSecundarios();
  }, [cargarHealth, cargarSecundarios]);

  useEffect(() => {
    cargarKpis();
  }, [cargarKpis]);

  const limpiarFiltros = () => {
    setFechaInicio("");
    setFechaFin("");
    setCategoria("TODAS");
    setArea("TODAS");
    setIncluirParcial(false);
  };

  const enviarPregunta = async (texto) => {
    const q = (texto ?? pregunta).trim();
    if (!q || loadingChat) return;
    setLoadingChat(true);
    setErrorChat("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error consultando al analista");
      setMensajes((prev) => [...prev, data]);
      if (!texto) setPregunta("");
    } catch (err) {
      setErrorChat(err.message);
    } finally {
      setLoadingChat(false);
    }
  };

  const generarReporteSnowflake = async () => {
    setLoadingReporte(true);
    setMsgReporte("");
    try {
      const res = await fetch("/api/reportes/generar-snowflake", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo generar el reporte en Snowflake");
      setMsgReporte(data.mensaje || "Reporte generado en Snowflake con éxito.");
      await cargarSecundarios(true);
    } catch (err) {
      setMsgReporte(`Error: ${err.message}`);
    } finally {
      setLoadingReporte(false);
    }
  };

  const descargarPdfBajoDemanda = async (rep) => {
    if (!rep) return;
    try {
      const res = await fetch("/api/reportes/descargar-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodo_desde: rep.periodo_desde,
          periodo_hasta: rep.periodo_hasta,
          modelo: rep.modelo,
          reporte_texto: rep.reporte_texto,
          resumen_sql: rep.resumen_sql,
          por_categoria: rep.por_categoria,
          mensual: rep.mensual,
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || "Error al descargar el PDF");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Informe_Financiero_${rep.periodo_desde}_${rep.periodo_hasta}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      setMsgReporte(`Error al descargar PDF: ${err.message}`);
    }
  };

  const descargarPdfOficial = async (idReporte) => {
    try {
      const res = await fetch(`/api/reportes/${idReporte}/descargar-pdf`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || "Error al descargar el PDF oficial");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Informe_Financiero_Oficial_${idReporte}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      setMsgReporte(`Error al descargar PDF oficial: ${err.message}`);
    }
  };

  const generarReporteGroq = async () => {
    setLoadingReporte(true);
    setMsgReporte("");
    try {
      const res = await fetch("/api/reportes/generar-groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha_inicio: fechaInicio || null,
          fecha_fin: fechaFin || null,
          categoria,
          area,
          incluir_parcial: incluirParcial,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error generando reporte con Groq");
      setReporteGroq(data);
      setMsgReporte("Informe ejecutivo generado con éxito. Iniciando descarga en formato PDF...");
      await descargarPdfBajoDemanda(data);
    } catch (err) {
      setMsgReporte(`Error: ${err.message}`);
    } finally {
      setLoadingReporte(false);
    }
  };

  const resumen = kpis?.resumen || {};
  const mesesDisponibles = kpis?.filtros_disponibles?.meses || [];
  const categoriasDisponibles = Array.from(
    new Set((kpis?.filtros_disponibles?.categorias || []).map((c) => c.CATEGORIA))
  );
  const areasDisponibles = kpis?.filtros_disponibles?.areas || [];

  const periodoTexto =
    resumen.periodo_desde && resumen.periodo_hasta
      ? `${resumen.periodo_desde} → ${resumen.periodo_hasta}`
      : "—";

  const actualizadoTexto = resumen.actualizado_en
    ? new Date(resumen.actualizado_en).toLocaleString("es-CO", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";

  return (
    <div className="min-h-screen flex bg-background text-ink">
      <Sidebar
        activeTab={tab}
        onSelectTab={setTab}
        anomalyCount={anomalias.length}
        health={health}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header Principal Compacto, Elegante y Limpio */}
        <header className="sticky top-0 z-20 bg-card/90 backdrop-blur-md border-b border-border/80 px-4 sm:px-6 py-3.5 shadow-xs">
          <div className="max-w-[1380px] mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined" && window.innerWidth >= 1024) {
                    setSidebarCollapsed((c) => !c);
                  } else {
                    setMobileMenuOpen((o) => !o);
                  }
                }}
                className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-ink hover:bg-muted cursor-pointer focus-visible:outline-2 focus-visible:outline-primary shadow-xs transition-colors shrink-0"
                aria-label={
                  mobileMenuOpen
                    ? "Cerrar menú de navegación"
                    : "Alternar menú de navegación"
                }
                title="Alternar menú de navegación"
              >
                <Menu className="w-4 h-4" />
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                  <span>Plataforma Financiera</span>
                  <span className="text-slate-300">/</span>
                  <span className="text-primary font-semibold">Distribuidora del Caribe</span>
                </div>
                <h1 className="text-[23px] leading-tight font-bold tracking-tight text-ink">
                  {TAB_TITLES[tab]}
                </h1>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <Badge variant="neutral" icon={Calendar} className="tabular-nums">
                    {periodoTexto}
                  </Badge>
                  <Badge variant="neutral" icon={Coins}>
                    COP
                  </Badge>
                  {(categoria !== "TODAS" || area !== "TODAS") && (
                    <Badge variant="primary">
                      {categoria !== "TODAS" ? categoria : "Todas cat."} ·{" "}
                      {area !== "TODAS" ? area : "Todas áreas"}
                    </Badge>
                  )}
                  <Badge variant="neutral" icon={Clock} className="tabular-nums">
                    Act: {actualizadoTexto}
                  </Badge>
                  <Tooltip text="Todas las cifras se calculan vía SQL en Snowflake; la IA únicamente explica los resultados.">
                    <Badge variant="primary" icon={Database} className="cursor-help">
                      Snowflake · SQL calcula
                    </Badge>
                  </Tooltip>
                </div>
              </div>
            </div>

            <Button
              variant="secondary"
              size="md"
              icon={RefreshCw}
              loading={loadingKpis}
              onClick={() => {
                cargarHealth();
                cargarKpis(true);
                cargarSecundarios(true);
              }}
              className="shadow-xs hover:shadow-sm"
            >
              Actualizar datos
            </Button>
          </div>
        </header>

        {/* Área de Contenido */}
        <main
          className={`flex-1 px-3 sm:px-6 py-3 sm:py-4 max-w-[1400px] w-full mx-auto ${
            tab === "chat"
              ? "flex flex-col h-[calc(100dvh-4.75rem)] min-h-[550px]"
              : "space-y-4 sm:space-y-5"
          }`}
        >
          {errorGlobal && (
            <AlertBanner type="error" title="Error de conexión con Snowflake">
              {errorGlobal}
            </AlertBanner>
          )}

          {!health?.groq_configured && (tab === "chat" || tab === "reportes") && (
            <AlertBanner type="warning" title="Configuración de Groq pendiente">
              Falta configurar <code className="font-mono">GROQ_API_KEY</code> en{" "}
              <code className="font-mono">.env</code> para habilitar el modelo{" "}
              <code className="font-mono">{health?.groq_model || "openai/gpt-oss-120b"}</code>. El
              dashboard SQL y los reportes en Snowflake siguen disponibles.
            </AlertBanner>
          )}

          {(tab === "dashboard" || tab === "reportes") && (
            <GlobalFilters
              fechaInicio={fechaInicio}
              fechaFin={fechaFin}
              categoria={categoria}
              area={area}
              incluirParcial={incluirParcial}
              mesesDisponibles={mesesDisponibles}
              categoriasDisponibles={categoriasDisponibles}
              areasDisponibles={areasDisponibles}
              onChangeFechaInicio={setFechaInicio}
              onChangeFechaFin={setFechaFin}
              onChangeCategoria={setCategoria}
              onChangeArea={setArea}
              onChangeIncluirParcial={setIncluirParcial}
              onReset={limpiarFiltros}
            />
          )}

          {tab === "dashboard" && (
            <DashboardView
              kpis={kpis}
              auditoria={auditoria}
              loading={loadingKpis}
              onResetFiltros={limpiarFiltros}
            />
          )}

          {tab === "chat" && (
            <AnalystView
              health={health}
              pregunta={pregunta}
              mensajes={mensajes}
              loading={loadingChat}
              error={errorChat}
              onChangePregunta={setPregunta}
              onEnviarPregunta={enviarPregunta}
              onLimpiarChat={() => setMensajes([])}
            />
          )}

          {tab === "anomalias" && <AnomaliesView anomalias={anomalias} />}

          {tab === "reportes" && (
            <ReportsView
              kpis={kpis}
              reporteGroq={reporteGroq}
              reportes={reportes}
              loadingReporte={loadingReporte}
              msgReporte={msgReporte}
              onGenerarSnowflake={generarReporteSnowflake}
              onGenerarGroq={generarReporteGroq}
              onDescargarPdfBajoDemanda={descargarPdfBajoDemanda}
              onDescargarPdfOficial={descargarPdfOficial}
            />
          )}
        </main>
      </div>
    </div>
  );
}
