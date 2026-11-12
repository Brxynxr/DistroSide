import { useCallback, useEffect, useState } from "react";
import { Menu, RefreshCw } from "lucide-react";
import GlobalFilters from "./components/GlobalFilters.jsx";
import Sidebar from "./components/Sidebar.jsx";
import SourceBadge from "./components/SourceBadge.jsx";
import AnalystView from "./views/AnalystView.jsx";
import AnomaliesView from "./views/AnomaliesView.jsx";
import DashboardView from "./views/DashboardView.jsx";
import ReportsView from "./views/ReportsView.jsx";

const TAB_TITLES = {
  dashboard: "Panel Financiero (COP)",
  chat: "Consultas en Lenguaje Natural",
  anomalias: "Detección de Anomalías",
  reportes: "Reportes Ejecutivos",
};

export default function App() {
  const [tab, setTab] = useState("dashboard");
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

  const cargarKpis = useCallback(async () => {
    setLoadingKpis(true);
    setErrorGlobal("");
    try {
      const params = new URLSearchParams();
      if (fechaInicio) params.set("fecha_inicio", fechaInicio);
      if (fechaFin) params.set("fecha_fin", fechaFin);
      if (categoria && categoria !== "TODAS") params.set("categoria", categoria);
      if (area && area !== "TODAS") params.set("area", area);
      params.set("incluir_parcial", String(incluirParcial));

      const res = await fetch(`/api/kpis?${params.toString()}`);
      if (!res.ok) throw new Error(await res.text());
      setKpis(await res.json());
    } catch (err) {
      setErrorGlobal(`Error cargando KPIs desde Snowflake: ${err.message}`);
    } finally {
      setLoadingKpis(false);
    }
  }, [fechaInicio, fechaFin, categoria, area, incluirParcial]);

  const cargarSecundarios = useCallback(async () => {
    try {
      const [resAnom, resAud, resRep] = await Promise.all([
        fetch("/api/anomalias"),
        fetch("/api/auditoria"),
        fetch("/api/reportes"),
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
      setMensajes((prev) => [data, ...prev]);
      if (!texto) setPregunta("");
    } catch (err) {
      setErrorChat(err.message);
    } finally {
      setLoadingChat(false);
    }
  };

  const generarReporteAirflow = async () => {
    setLoadingReporte(true);
    setMsgReporte("");
    try {
      const res = await fetch("/api/reportes/generar-airflow", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo disparar Airflow");
      setMsgReporte(`${data.mensaje} (Run: ${data.dag_run_id})`);
      setTimeout(() => cargarSecundarios(), 8000);
    } catch (err) {
      setMsgReporte(`Error: ${err.message}`);
    } finally {
      setLoadingReporte(false);
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

  return (
    <div className="min-h-screen flex bg-background text-ink">
      <Sidebar
        activeTab={tab}
        onSelectTab={setTab}
        anomalyCount={anomalias.length}
        health={health}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-header bg-card/95 backdrop-blur-xs border-b border-border px-4 lg:px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden mt-0.5 rounded-lg border border-border bg-card p-2 text-foreground cursor-pointer hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                aria-label="Abrir menú de navegación"
              >
                <Menu className="w-4 h-4" />
              </button>

              <div>
                <h1 className="font-sans text-lg font-bold tracking-tight text-foreground">
                  {TAB_TITLES[tab]}
                </h1>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <SourceBadge variant="sql" showIcon>
                    Periodo:{" "}
                    {resumen.periodo_desde && resumen.periodo_hasta
                      ? `${resumen.periodo_desde} → ${resumen.periodo_hasta}`
                      : "—"}
                  </SourceBadge>
                  <SourceBadge variant="sql">Moneda: COP</SourceBadge>
                  {(categoria !== "TODAS" || area !== "TODAS") && (
                    <SourceBadge variant="positive">
                      Filtro: {categoria !== "TODAS" ? categoria : "Todas cat."} ·{" "}
                      {area !== "TODAS" ? area : "Todas áreas"}
                    </SourceBadge>
                  )}
                  <SourceBadge variant="sql">
                    Actualizado:{" "}
                    {resumen.actualizado_en
                      ? new Date(resumen.actualizado_en).toLocaleString("es-CO")
                      : "—"}
                  </SourceBadge>
                  <SourceBadge variant="ai" showIcon>
                    SQL calcula · IA explica
                  </SourceBadge>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                cargarHealth();
                cargarKpis();
                cargarSecundarios();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground cursor-pointer transition-colors duration-150 motion-reduce:transition-none hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              <span>Actualizar</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 space-y-4 max-w-[1440px] w-full mx-auto">
          {errorGlobal && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {errorGlobal}
            </div>
          )}

          {!health?.groq_configured && (tab === "chat" || tab === "reportes") && (
            <div
              role="alert"
              className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              Falta configurar <strong className="font-mono">GROQ_API_KEY</strong> en el archivo{" "}
              <code className="font-mono">.env</code> del proyecto para habilitar las respuestas con{" "}
              <code className="font-mono">{health?.groq_model || "openai/gpt-oss-120b"}</code>. Los
              reportes almacenados en Snowflake (<code className="font-mono">AI_AGG</code>) y el
              dashboard SQL siguen funcionando.
            </div>
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
            <DashboardView kpis={kpis} auditoria={auditoria} loading={loadingKpis} />
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
            />
          )}

          {tab === "anomalias" && <AnomaliesView anomalias={anomalias} />}

          {tab === "reportes" && (
            <ReportsView
              reporteGroq={reporteGroq}
              reportes={reportes}
              loadingReporte={loadingReporte}
              msgReporte={msgReporte}
              onGenerarAirflow={generarReporteAirflow}
              onGenerarGroq={generarReporteGroq}
            />
          )}
        </main>
      </div>
    </div>
  );
}
