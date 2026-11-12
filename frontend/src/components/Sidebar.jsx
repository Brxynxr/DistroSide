import {
  AlertTriangle,
  BarChart3,
  Building,
  FileText,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  X,
} from "lucide-react";

const NAV_ITEMS = [
  { id: "dashboard", label: "Resumen Financiero", icon: BarChart3 },
  { id: "chat", label: "Agente Analista", icon: Sparkles },
  { id: "anomalias", label: "Anomalías", icon: AlertTriangle, countKey: "anomalies" },
  { id: "reportes", label: "Reportes Ejecutivos", icon: FileText },
];

/**
 * Sidebar minimalista estilo Stripe/Linear/Ramp, colapsable en escritorio y drawer en móvil.
 */
export default function Sidebar({
  activeTab,
  onSelectTab,
  anomalyCount,
  health,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}) {
  const renderSidebarBody = (isCollapsedDesktop = false) => (
    <div className="flex h-full flex-col justify-between bg-card text-ink p-3 select-none">
      <div>
        {/* Identidad */}
        <div
          className={`flex items-center ${
            isCollapsedDesktop ? "justify-center flex-col gap-2" : "justify-between gap-2"
          } pb-3.5 border-b border-border`}
        >
          <div className={`flex items-center gap-2.5 min-w-0 ${isCollapsedDesktop ? "justify-center" : ""}`}>
            <span
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-700 text-white text-xs font-bold tracking-tight shadow-xs ring-1 ring-white/20"
              title="DataFinance AI — Distribuidora del Caribe S.A.S."
            >
              DF
            </span>
            {!isCollapsedDesktop && (
              <div className="min-w-0">
                <div className="text-[14px] font-bold tracking-tight text-ink truncate leading-tight">
                  DataFinance AI
                </div>
                <p className="text-[11px] font-medium text-muted-foreground truncate">
                  Distribuidora del Caribe
                </p>
              </div>
            )}
          </div>

          {/* Botón contraer en escritorio */}
          <button
            type="button"
            onClick={onToggleCollapse}
            title={isCollapsedDesktop ? "Expandir barra lateral" : "Contraer barra lateral"}
            aria-label={isCollapsedDesktop ? "Expandir barra lateral" : "Contraer barra lateral"}
            className="hidden lg:inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-ink hover:bg-muted cursor-pointer transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary"
          >
            {isCollapsedDesktop ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>

          {/* Botón cerrar en móvil */}
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-ink hover:bg-muted cursor-pointer focus-visible:outline-2 focus-visible:outline-primary"
            aria-label="Cerrar menú"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navegación */}
        <nav className="mt-4 flex flex-col gap-1" aria-label="Navegación principal">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const showAnomCount = item.countKey === "anomalies" && anomalyCount > 0;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile();
                }}
                title={isCollapsedDesktop ? item.label : undefined}
                aria-current={isActive ? "page" : undefined}
                className={`relative group w-full flex items-center ${
                  isCollapsedDesktop ? "justify-center px-2" : "justify-between px-3"
                } py-2.5 rounded-lg text-[13px] cursor-pointer transition-all duration-150 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-primary ${
                  isActive
                    ? "bg-blue-50 text-primary font-semibold shadow-xs"
                    : "text-muted-foreground font-medium hover:bg-muted/70 hover:text-ink"
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                      isActive ? "text-primary" : "text-slate-400 group-hover:text-ink"
                    }`}
                    strokeWidth={isActive ? 2.2 : 1.8}
                    aria-hidden="true"
                  />
                  {!isCollapsedDesktop && <span className="truncate">{item.label}</span>}
                </span>

                {!isCollapsedDesktop && showAnomCount && (
                  <span
                    className={`text-[11px] font-bold tabular-nums rounded-full px-2 py-0.5 leading-none border ${
                      isActive
                        ? "bg-amber-100 text-amber-900 border-amber-300"
                        : "bg-amber-50 text-amber-800 border-amber-200"
                    }`}
                  >
                    {anomalyCount}
                  </span>
                )}

                {isCollapsedDesktop && showAnomCount && (
                  <span
                    className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-accent ring-2 ring-card animate-pulse"
                    aria-label={`${anomalyCount} anomalías`}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Separador visual y estado discreto de conexiones */}
      <div className="border-t border-border pt-3">
        {isCollapsedDesktop ? (
          <div className="flex flex-col items-center gap-3 py-1">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                health?.snowflake_connected ? "bg-positive ring-4 ring-emerald-100" : "bg-accent ring-4 ring-amber-100"
              }`}
              title={`Snowflake (${health?.snowflake?.ROL || "ROL_DATAFINANCE"}) · ${
                health?.snowflake_connected ? "Conectado" : "Desconectado"
              }`}
            />
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                health?.groq_configured ? "bg-positive ring-4 ring-emerald-100" : "bg-accent ring-4 ring-amber-100"
              }`}
              title={`Groq (${health?.groq_model || "gpt-oss-120b"}) · ${
                health?.groq_configured ? "Activo" : "Sin API Key"
              }`}
            />
          </div>
        ) : (
          <div className="rounded-xl border border-border/80 bg-slate-50/70 p-3 space-y-2.5">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Sistemas en línea</span>
              <span className="h-1.5 w-1.5 rounded-full bg-positive animate-pulse" />
            </div>

            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground truncate font-medium">
                Snowflake
              </span>
              <span
                className={`inline-flex items-center gap-1.5 font-semibold text-[11px] px-2 py-0.5 rounded-full border ${
                  health?.snowflake_connected
                    ? "bg-emerald-50 text-positive border-emerald-200"
                    : "bg-amber-50 text-accent border-amber-200"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    health?.snowflake_connected ? "bg-positive" : "bg-accent"
                  }`}
                />
                <span>{health?.snowflake_connected ? "Activo" : "Offline"}</span>
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground truncate font-medium">
                Groq ({health?.groq_model?.split("/").pop() || "gpt-oss-120b"})
              </span>
              <span
                className={`inline-flex items-center gap-1.5 font-semibold text-[11px] px-2 py-0.5 rounded-full border ${
                  health?.groq_configured
                    ? "bg-emerald-50 text-positive border-emerald-200"
                    : "bg-amber-50 text-accent border-amber-200"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    health?.groq_configured ? "bg-positive" : "bg-accent"
                  }`}
                />
                <span>{health?.groq_configured ? "Activo" : "Config"}</span>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={`hidden lg:block shrink-0 sticky top-0 h-screen border-r border-border z-sticky transition-[width] duration-200 motion-reduce:transition-none ${
          collapsed ? "w-[68px]" : "w-60"
        }`}
      >
        {renderSidebarBody(collapsed)}
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-modal flex">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative w-64 max-w-[85vw] h-full shadow-md border-r border-border z-modal">
            {renderSidebarBody(false)}
          </div>
        </div>
      )}
    </>
  );
}
