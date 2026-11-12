import { AlertTriangle, BarChart3, Bot, FileText, X } from "lucide-react";

const NAV_ITEMS = [
  { id: "dashboard", label: "Resumen Financiero", icon: BarChart3 },
  { id: "chat", label: "Agente Analista", icon: Bot },
  { id: "anomalias", label: "Anomalías", icon: AlertTriangle, countKey: "anomalies" },
  { id: "reportes", label: "Reportes Ejecutivos", icon: FileText },
];

/**
 * Barra lateral de navegación fija en escritorio (>=1024px) y drawer móvil en pantallas pequeñas.
 */
export default function Sidebar({
  activeTab,
  onSelectTab,
  anomalyCount,
  health,
  mobileOpen,
  onCloseMobile,
}) {
  const content = (
    <div className="flex h-full flex-col justify-between bg-slate-900 text-slate-100 p-4">
      <div>
        <div className="flex items-start justify-between gap-2 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-on-primary font-mono text-xs font-bold">
                DF
              </span>
              <span className="font-sans text-base font-bold tracking-tight text-white">
                DataFinance AI
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Distribuidora del Caribe S.A.S.</p>
          </div>

          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer focus-visible:outline-2 focus-visible:outline-ring"
            aria-label="Cerrar menú"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="mt-4 flex flex-col gap-1" aria-label="Navegación principal">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile();
                }}
                aria-current={isActive ? "page" : undefined}
                className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-ring ${
                  isActive
                    ? "bg-primary text-on-primary shadow-sm"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </span>
                {item.countKey === "anomalies" && (
                  <span
                    className={`font-mono text-xs tabular-nums rounded-full px-2 py-0.5 ${
                      isActive ? "bg-blue-800 text-white" : "bg-amber-500/20 text-amber-300"
                    }`}
                  >
                    {anomalyCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-slate-800 pt-3 space-y-2 text-xs text-slate-300">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate">
            Snowflake ({health?.snowflake?.ROL || "ROL_DATAFINANCE"})
          </span>
          <span
            className={`h-2.5 w-2.5 rounded-full shrink-0 ${
              health?.snowflake_connected ? "bg-emerald-500" : "bg-amber-500"
            }`}
            title={health?.snowflake_connected ? "Conectado" : "Sin conexión"}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate">Groq ({health?.groq_model || "gpt-oss-120b"})</span>
          <span
            className={`h-2.5 w-2.5 rounded-full shrink-0 ${
              health?.groq_configured ? "bg-emerald-500" : "bg-amber-500"
            }`}
            title={health?.groq_configured ? "Configurado" : "No configurado"}
          />
        </div>
        <div className="flex items-center justify-between gap-2 text-slate-400">
          <span>Warehouse</span>
          <span className="font-mono text-[11px]">
            {health?.snowflake?.WAREHOUSE || "WH_DATAFINANCE"}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Escritorio */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen border-r border-slate-800 z-sticky">
        {content}
      </aside>

      {/* Drawer móvil */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-modal flex">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative w-72 max-w-[85vw] h-full shadow-lg z-modal">{content}</div>
        </div>
      )}
    </>
  );
}
