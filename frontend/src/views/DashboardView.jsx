import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart2,
  BarChart3,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Coins,
  CreditCard,
  DollarSign,
  Layers,
  Percent,
  PieChart,
  Play,
  Receipt,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Table as TableIcon,
  Wallet,
} from "lucide-react";
import KpiCard from "../components/KpiCard.jsx";
import PlotlyChart from "../components/PlotlyChart.jsx";
import SourceBadge from "../components/SourceBadge.jsx";
import AlertBanner from "../components/ui/AlertBanner.jsx";
import Button from "../components/ui/Button.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import {
  PLOTLY_CATEGORICAL,
  PLOTLY_SERIES,
  formatCOP,
  formatMillones,
  formatPct,
} from "../utils/formatters.js";

/**
 * Vista 1: Resumen Financiero, Centinela Operativo & Cuadre Diario de Liquidez.
 */
export default function DashboardView({
  kpis,
  auditoria,
  loading,
  alertasCentinela = [],
  loadingCentinela = false,
  msgCentinela = "",
  onEvaluarCentinela,
  onCambiarEstadoAlerta,
  cuadreDiario = null,
  loadingCuadre = false,
  msgCuadre = "",
  onEjecutarCuadre,
  onResetFiltros,
}) {
  const resumen = kpis?.resumen || {};
  const mensual = kpis?.mensual || [];
  const mesesDisponibles = kpis?.filtros_disponibles?.meses || [];

  const [mesCentinela, setMesCentinela] = useState("");
  const [alertaExpandidaId, setAlertaExpandidaId] = useState(null);

  // Cuadre diario de liquidez
  const [fechaCuadreInput, setFechaCuadreInput] = useState("");
  const [mostrarHistorialCuadre, setMostrarHistorialCuadre] = useState(false);

  const alertasActivas = useMemo(
    () => alertasCentinela.filter((a) => a.ESTADO === "ACTIVA"),
    [alertasCentinela]
  );

  const ultimoCuadre = cuadreDiario?.ultimo || null;
  const tendenciaLiquidez = cuadreDiario?.tendencia || [];
  const historialCuadres = cuadreDiario?.historial || [];

  // Gráfico Tendencia de Liquidez Diaria (Plotly)
  const chartLiquidezData = useMemo(() => {
    if (!tendenciaLiquidez.length) return [];
    const x = tendenciaLiquidez.map((d) => d.FECHA);
    return [
      {
        x,
        y: tendenciaLiquidez.map((d) => d.VENTAS_CONTADO / 1e6),
        type: "bar",
        name: "Contado (Efectivo)",
        marker: { color: "#10B981" },
      },
      {
        x,
        y: tendenciaLiquidez.map((d) => d.VENTAS_CREDITO / 1e6),
        type: "bar",
        name: "Venta a Crédito",
        marker: { color: "#F59E0B" },
      },
      {
        x,
        y: tendenciaLiquidez.map((d) => d.RATIO_CONTADO_PCT),
        type: "scatter",
        mode: "lines+markers",
        name: "Ratio Contado %",
        yaxis: "y2",
        line: { color: "#0284C7", width: 2.5 },
        marker: { size: 6, color: "#0284C7" },
      },
    ];
  }, [tendenciaLiquidez]);

  const chartLiquidezLayout = useMemo(
    () => ({
      barmode: "stack",
      height: 220,
      margin: { t: 20, r: 45, b: 35, l: 45 },
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      xaxis: {
        tickangle: -25,
        tickfont: { family: "Inter, system-ui, sans-serif", size: 10, color: "#64748B" },
        gridcolor: "#F1F5F9",
      },
      yaxis: {
        title: { text: "Ventas (M COP)", font: { size: 10, color: "#64748B" } },
        tickfont: { size: 10, color: "#64748B" },
        gridcolor: "#F1F5F9",
      },
      yaxis2: {
        title: { text: "Ratio Contado %", font: { size: 10, color: "#0284C7" } },
        overlaying: "y",
        side: "right",
        range: [0, 100],
        tickfont: { size: 10, color: "#0284C7" },
        showgrid: false,
      },
      shapes: [
        {
          type: "line",
          xref: "paper",
          x0: 0,
          x1: 1,
          yref: "y2",
          y0: 45,
          y1: 45,
          line: { color: "#EF4444", width: 1.5, dash: "dot" },
        },
      ],
      legend: {
        orientation: "h",
        y: -0.25,
        x: 0.5,
        xanchor: "center",
        font: { family: "Inter, system-ui, sans-serif", size: 10, color: "#475569" },
      },
    }),
    []
  );


  // Último mes cerrado de la serie para mostrar variaciones MoM confiables
  const ultimoMesConVariacion = useMemo(() => {
    if (mensual.length < 2) return null;
    return mensual[mensual.length - 1];
  }, [mensual]);

  // Gráfico 1: Evolución Mensual (ui-ux-pro-max: Trend Over Time / Combined Bar & Spline)
  const evolucionData = useMemo(() => {
    const x = mensual.map((r) => r.ANIO_MES);
    return [
      {
        x,
        y: mensual.map((r) => r.INGRESOS / 1e6),
        type: "bar",
        name: "Ingresos",
        marker: {
          color: PLOTLY_SERIES.ingresos,
          line: { color: PLOTLY_SERIES.ingresosBorder, width: 1 },
          opacity: 0.95,
        },
        hovertemplate: "Ingresos: %{y:.2f} M COP<extra></extra>",
      },
      {
        x,
        y: mensual.map((r) => r.GASTOS / 1e6),
        type: "bar",
        name: "Gastos",
        marker: {
          color: PLOTLY_SERIES.gastos,
          line: { color: PLOTLY_SERIES.gastosBorder, width: 1 },
          opacity: 0.9,
        },
        hovertemplate: "Gastos: %{y:.2f} M COP<extra></extra>",
      },
      {
        x,
        y: mensual.map((r) => r.UTILIDAD / 1e6),
        type: "scatter",
        mode: "lines+markers",
        name: "Utilidad neta",
        line: { color: PLOTLY_SERIES.utilidad, width: 2.5, shape: "spline" },
        marker: {
          size: 7,
          color: PLOTLY_SERIES.utilidad,
          symbol: "circle",
          line: { color: "#FFFFFF", width: 1.5 },
        },
        hovertemplate: "Utilidad: %{y:.2f} M COP<extra></extra>",
      },
    ];
  }, [mensual]);

  // Gráfico 2: Gastos por Categoría (ui-ux-pro-max: Compare Categories / Horizontal Bar sorted descending)
  const gastosCategoriaData = useMemo(() => {
    const gastos = (kpis?.por_categoria || [])
      .filter((r) => r.TIPO === "GASTO")
      .slice()
      .reverse();

    return [
      {
        x: gastos.map((r) => r.MONTO_TOTAL / 1e6),
        y: gastos.map((r) => r.CATEGORIA),
        text: gastos.map((r) => `${(r.MONTO_TOTAL / 1e6).toFixed(1)} M`),
        textposition: "outside",
        cliponaxis: false,
        textfont: {
          family: "Inter, system-ui, sans-serif",
          size: 11,
          color: "#475569",
        },
        type: "bar",
        orientation: "h",
        marker: {
          color: PLOTLY_SERIES.utilidad,
          line: { color: PLOTLY_SERIES.utilidadBorder, width: 1 },
          opacity: 0.9,
        },
        hovertemplate: "<b>%{y}</b><br>Total gasto: %{x:.2f} M COP<extra></extra>",
      },
    ];
  }, [kpis]);

  // Gráfico 3: Gastos por Área (ui-ux-pro-max: Part-to-Whole Donut, 12 o'clock start, central KPI)
  const gastosArea = useMemo(
    () => (kpis?.por_area || []).filter((r) => r.TIPO === "GASTO"),
    [kpis]
  );

  const totalGastosArea = useMemo(
    () => gastosArea.reduce((acc, r) => acc + (Number(r.MONTO_TOTAL) || 0), 0),
    [gastosArea]
  );

  const gastosAreaData = useMemo(() => {
    return [
      {
        labels: gastosArea.map((r) => r.AREA),
        values: gastosArea.map((r) => r.MONTO_TOTAL / 1e6),
        type: "pie",
        hole: 0.6,
        rotation: 90,
        direction: "clockwise",
        marker: {
          colors: PLOTLY_CATEGORICAL,
          line: { color: "#FFFFFF", width: 2 },
        },
        textinfo: "percent",
        textfont: {
          family: "Inter, system-ui, sans-serif",
          size: 11,
          color: "#FFFFFF",
        },
        hovertemplate:
          "<b>%{label}</b><br>Gasto: %{value:.2f} M COP<br>Participación: %{percent}<extra></extra>",
      },
    ];
  }, [gastosArea]);

  const evolucionLayout = useMemo(
    () => ({
      barmode: "group",
      bargap: 0.28,
      bargroupgap: 0.12,
      hovermode: "x unified",
      margin: { t: 24, r: 16, b: 46, l: 60 },
      yaxis: {
        title: {
          text: "Millones COP",
          font: { family: "Inter, system-ui, sans-serif", size: 11, color: "#64748B" },
        },
        tickprefix: "$",
        ticksuffix: "M",
      },
      xaxis: {
        tickangle: -25,
      },
      legend: {
        orientation: "h",
        y: 1.15,
        x: 0,
        font: { family: "Inter, system-ui, sans-serif", size: 12, color: "#475569" },
        itemgap: 16,
      },
    }),
    []
  );

  const categoriaLayout = useMemo(
    () => ({
      margin: { t: 12, r: 48, b: 38, l: 135 },
      xaxis: {
        title: {
          text: "Millones COP",
          font: { family: "Inter, system-ui, sans-serif", size: 11, color: "#64748B" },
        },
        tickprefix: "$",
        ticksuffix: "M",
      },
      yaxis: {
        tickfont: {
          family: "Inter, system-ui, sans-serif",
          size: 12,
          color: "#0F172A",
        },
      },
    }),
    []
  );

  const areaLayout = useMemo(
    () => ({
      margin: { t: 10, r: 10, b: 34, l: 10 },
      showlegend: true,
      legend: {
        orientation: "h",
        y: -0.12,
        x: 0.5,
        xanchor: "center",
        font: { family: "Inter, system-ui, sans-serif", size: 11, color: "#475569" },
      },
      annotations: [
        {
          text: `<b>Total Áreas</b><br><span style="font-size:13px;font-weight:700;color:#0F172A">${formatMillones(totalGastosArea)}</span>`,
          showarrow: false,
          font: { family: "Inter, system-ui, sans-serif", size: 11, color: "#64748B" },
        },
      ],
    }),
    [totalGastosArea]
  );

  const utilidadPositiva = (resumen.utilidad_total || 0) >= 0;

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* 1. Tarjetas KPI Protagonistas */}
      <section
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4"
        aria-label="Indicadores financieros clave"
      >
        <KpiCard
          label="Ingresos totales"
          value={formatMillones(resumen.ingresos_totales)}
          subValue={formatCOP(resumen.ingresos_totales)}
          tone="positive"
          icon={DollarSign}
          tooltip="Suma total de ventas al por mayor (contado + crédito) y servicios en el periodo filtrado."
          deltaPct={ultimoMesConVariacion?.VAR_INGRESOS_PCT}
          deltaLabel="vs mes ant."
          loading={loading}
        />

        <KpiCard
          label="Gastos totales"
          value={formatMillones(resumen.gastos_totales)}
          subValue={formatCOP(resumen.gastos_totales)}
          tone="destructive"
          icon={CreditCard}
          tooltip="Egresos operativos: proveedores, nómina, arriendo, logística, marketing, servicios públicos e impuestos."
          deltaPct={ultimoMesConVariacion?.VAR_GASTOS_PCT}
          deltaLabel="vs mes ant."
          invertDeltaColor={true}
          loading={loading}
        />

        <KpiCard
          label="Utilidad neta"
          value={formatMillones(resumen.utilidad_total)}
          subValue={formatCOP(resumen.utilidad_total)}
          tone={utilidadPositiva ? "primary" : "destructive"}
          icon={Wallet}
          tooltip="Resultado operativo calculado: Ingresos Totales menos Gastos Totales (COP)."
          deltaPct={ultimoMesConVariacion?.VAR_UTILIDAD_PCT}
          deltaLabel="vs mes ant."
          loading={loading}
        />

        <KpiCard
          label="Margen operativo"
          value={`${resumen.margen_pct ?? 0}%`}
          subValue={`${resumen.total_transacciones?.toLocaleString("es-CO") || 0} transacciones`}
          tone={resumen.margen_pct >= 15 ? "positive" : "neutral"}
          icon={Percent}
          tooltip="Porcentaje de utilidad respecto a los ingresos totales: (Utilidad / Ingresos) * 100."
          loading={loading}
        />
      </section>

      {/* 2. CENTINELA SEMANAL DE SOBRECOSTOS OPERATIVOS (AUTOMATIZACIÓN OPCIÓN 2) */}
      <section className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border/70">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-ink">
                  Centinela Operativo — Alertas Tempranas de Sobrecosto
                </h3>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                  Opción 2 · Run-Rate
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Evalúa semanalmente el ritmo de consumo (burn rate) por categoría y proyecta desviaciones antes del fin de mes.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <select
              value={mesCentinela}
              onChange={(e) => setMesCentinela(e.target.value)}
              className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-ink focus:outline-hidden focus:ring-1 focus:ring-primary"
            >
              <option value="">(Mes en curso)</option>
              {mesesDisponibles.map((m) => (
                <option key={m.ANIO_MES} value={m.ANIO_MES}>
                  {m.ANIO_MES}
                </option>
              ))}
            </select>

            <Button
              size="sm"
              variant="secondary"
              icon={Play}
              loading={loadingCentinela}
              onClick={() => onEvaluarCentinela && onEvaluarCentinela(mesCentinela || null)}
              className="h-8 text-xs font-semibold"
            >
              Escanear Run-Rate
            </Button>
          </div>
        </div>

        {msgCentinela && (
          <AlertBanner type={msgCentinela.startsWith("Error:") ? "error" : "info"}>
            {msgCentinela}
          </AlertBanner>
        )}

        {/* Listado de Alertas Activas */}
        {alertasActivas.length > 0 ? (
          <div className="space-y-3">
            {alertasActivas.map((alerta) => {
              const estaExpandida = alertaExpandidaId === alerta.ID_ALERTA;
              const esCritico = alerta.NIVEL_RIESGO === "CRITICO";
              return (
                <div
                  key={alerta.ID_ALERTA}
                  className={`rounded-xl border p-4 transition-all ${
                    esCritico
                      ? "bg-rose-50/50 border-rose-200"
                      : "bg-amber-50/50 border-amber-200"
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle
                        className={`w-5 h-5 mt-0.5 shrink-0 ${
                          esCritico ? "text-rose-600" : "text-amber-600"
                        }`}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              esCritico
                                ? "bg-rose-100 text-rose-800 border border-rose-200"
                                : "bg-amber-100 text-amber-800 border border-amber-200"
                            }`}
                          >
                            Riesgo {alerta.NIVEL_RIESGO}
                          </span>
                          <strong className="text-sm font-bold text-ink">
                            {alerta.CATEGORIA} — Área {alerta.AREA}
                          </strong>
                          <span className="text-xs text-muted-foreground">
                            (Periodo {alerta.PERIODO} · Día {alerta.DIAS_TRANSCURRIDOS} de {alerta.DIAS_TOTALES_MES})
                          </span>
                        </div>

                        {/* Indicadores cuantitativos del desvío */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 text-xs tabular-nums">
                          <div>
                            <span className="text-[11px] text-muted-foreground block">Gasto acumulado</span>
                            <span className="font-bold text-ink">{formatMillones(alerta.GASTO_ACUMULADO)}</span>
                          </div>
                          <div>
                            <span className="text-[11px] text-muted-foreground block">Presupuesto histórico</span>
                            <span className="font-medium text-slate-600">{formatMillones(alerta.PROMEDIO_HISTORICO_MENSUAL)}</span>
                          </div>
                          <div>
                            <span className="text-[11px] text-muted-foreground block">% Consumido</span>
                            <span className={`font-bold ${esCritico ? "text-destructive" : "text-amber-700"}`}>
                              {alerta.PORCENTAJE_CONSUMIDO}%
                            </span>
                          </div>
                          <div>
                            <span className="text-[11px] text-muted-foreground block">Proyección Cierre</span>
                            <span className={`font-bold ${esCritico ? "text-destructive" : "text-amber-700"}`}>
                              {formatMillones(alerta.PROYECCION_FIN_MES)} (+{alerta.DESVIO_PROYECTADO_PCT}%)
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={estaExpandida ? ChevronUp : ChevronDown}
                        onClick={() => setAlertaExpandidaId(estaExpandida ? null : alerta.ID_ALERTA)}
                        className="text-xs h-8"
                      >
                        {estaExpandida ? "Ocultar causas" : "Ver causas"}
                      </Button>

                      <Button
                        size="sm"
                        variant="secondary"
                        icon={Check}
                        onClick={() =>
                          onCambiarEstadoAlerta && onCambiarEstadoAlerta(alerta.ID_ALERTA, "MITIGADA")
                        }
                        className="text-xs h-8 text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                        title="Marcar alerta como atendida/mitigada"
                      >
                        Mitigada
                      </Button>
                    </div>
                  </div>

                  {/* Diagnóstico IA y transacciones críticas aisladas */}
                  {estaExpandida && (
                    <div className="mt-3 pt-3 border-t border-border/70 space-y-3 animate-in fade-in duration-200">
                      <div className="bg-white/80 rounded-lg p-3 border border-border/80 text-xs text-slate-700 whitespace-pre-line leading-relaxed font-sans">
                        <strong className="text-slate-900 block mb-1">Diagnóstico Operativo (IA):</strong>
                        {alerta.DIAGNOSTICO_IA}
                      </div>

                      {alerta.TRANSACCIONES_CRITICAS && alerta.TRANSACCIONES_CRITICAS.length > 0 && (
                        <div>
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
                            Movimientos más costosos identificados en Snowflake:
                          </span>
                          <div className="overflow-x-auto rounded-lg border border-border bg-white text-xs">
                            <table className="w-full text-left">
                              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-border">
                                <tr>
                                  <th className="py-1.5 px-3">ID</th>
                                  <th className="py-1.5 px-3">Fecha</th>
                                  <th className="py-1.5 px-3">Descripción</th>
                                  <th className="py-1.5 px-3 text-right">Monto</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/60 tabular-nums">
                                {alerta.TRANSACCIONES_CRITICAS.map((tx) => (
                                  <tr key={tx.ID_TRANSACCION} className="hover:bg-slate-50/60">
                                    <td className="py-1.5 px-3 text-muted-foreground font-mono">{tx.ID_TRANSACCION}</td>
                                    <td className="py-1.5 px-3 text-slate-600">{tx.FECHA}</td>
                                    <td className="py-1.5 px-3 font-medium text-ink">{tx.DESCRIPCION}</td>
                                    <td className="py-1.5 px-3 text-right font-semibold text-destructive">
                                      {formatMillones(tx.MONTO)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-emerald-900">
                <strong>Ritmo de Gasto Bajo Control:</strong> Todas las áreas operan dentro de los presupuestos previstos. No hay alertas preventivas de sobrecosto activas.
              </span>
            </div>
            <span className="text-emerald-700 font-medium tabular-nums hidden sm:inline-block">
              0 sobrecostos proyectados
            </span>
          </div>
        )}
      </section>

      {/* 3. CUADRE DIARIO DE VENTAS Y MONITOREO DE LIQUIDEZ (AUTOMATIZACIÓN OPCIÓN 3) */}
      <section className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border/70">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0">
              <Coins className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-ink">
                  Cuadre Diario de Ventas y Monitoreo de Liquidez
                </h3>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Opción 3 · Caja y Cartera
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Auditoría al cierre de ruta: controla el recaudo efectivo (Venta Contado ≥ 45%) para asegurar solvencia frente a compromisos de proveedores y nómina.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <input
              type="date"
              value={fechaCuadreInput}
              onChange={(e) => setFechaCuadreInput(e.target.value)}
              className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-ink focus:outline-hidden focus:ring-1 focus:ring-primary"
              title="Fecha específica a evaluar (o dejar vacío para último día registrado)"
            />
            <Button
              size="sm"
              variant="secondary"
              icon={Play}
              loading={loadingCuadre}
              onClick={() => onEjecutarCuadre && onEjecutarCuadre(fechaCuadreInput || null)}
              className="h-8 text-xs font-semibold"
            >
              Auditar Cierre Diario
            </Button>
            {historialCuadres.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                icon={mostrarHistorialCuadre ? ChevronUp : ChevronDown}
                onClick={() => setMostrarHistorialCuadre((v) => !v)}
                className="h-8 text-xs text-muted-foreground"
              >
                {mostrarHistorialCuadre ? "Ocultar Bitácora" : `Bitácora (${historialCuadres.length})`}
              </Button>
            )}
          </div>
        </div>

        {msgCuadre && (
          <AlertBanner type={msgCuadre.startsWith("Error:") ? "error" : "info"}>
            {msgCuadre}
          </AlertBanner>
        )}

        {ultimoCuadre ? (
          <div className="space-y-4">
            {/* Panel Principal: Indicadores y Barra de Mezcla Contado vs Crédito */}
            <div className="rounded-xl border border-border bg-slate-50/50 p-4 space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border ${
                      ultimoCuadre.ESTADO_LIQUIDEZ === "OPTIMA"
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                        : ultimoCuadre.ESTADO_LIQUIDEZ === "ADVERTENCIA"
                        ? "bg-amber-100 text-amber-800 border-amber-300"
                        : "bg-rose-100 text-rose-800 border-rose-300"
                    }`}
                  >
                    {ultimoCuadre.ESTADO_LIQUIDEZ === "OPTIMA" && "✅ Liquidez Óptima"}
                    {ultimoCuadre.ESTADO_LIQUIDEZ === "ADVERTENCIA" && "⚠️ Advertencia de Liquidez"}
                    {ultimoCuadre.ESTADO_LIQUIDEZ === "CRITICA" && "🚨 Riesgo Crítico de Iliquidez"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Cierre auditado: <strong className="text-ink">{ultimoCuadre.FECHA}</strong> ({ultimoCuadre.TOTAL_TRANSACCIONES} ventas)
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-muted-foreground block">Recaudo total del día</span>
                  <span className="text-base font-bold text-ink tabular-nums">
                    {formatMillones(ultimoCuadre.TOTAL_VENTAS)}
                  </span>
                  <span className="text-[11px] text-slate-500 block font-normal">
                    {formatCOP(ultimoCuadre.TOTAL_VENTAS)}
                  </span>
                </div>
              </div>

              {/* Barra Proporcional de Mezcla de Ventas */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-slate-700">Composición del Recaudo</span>
                  <span className="text-[11px] text-muted-foreground">
                    Meta prudencial de contado: <strong>≥ 45.0%</strong>
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-200 overflow-hidden flex shadow-inner">
                  <div
                    style={{ width: `${Math.min(100, ultimoCuadre.RATIO_CONTADO_PCT || 0)}%` }}
                    className="bg-emerald-500 transition-all duration-500"
                    title={`Contado: ${ultimoCuadre.RATIO_CONTADO_PCT}%`}
                  />
                  <div
                    style={{ width: `${Math.min(100, ultimoCuadre.RATIO_CREDITO_PCT || 0)}%` }}
                    className="bg-amber-500 transition-all duration-500"
                    title={`Crédito: ${ultimoCuadre.RATIO_CREDITO_PCT}%`}
                  />
                  <div
                    style={{
                      width: `${Math.max(
                        0,
                        100 - (ultimoCuadre.RATIO_CONTADO_PCT || 0) - (ultimoCuadre.RATIO_CREDITO_PCT || 0)
                      )}%`,
                    }}
                    className="bg-slate-400 transition-all duration-500"
                    title="Servicios y otros"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 mt-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-slate-600">
                      Contado (Efectivo/Transf.): <strong>{formatMillones(ultimoCuadre.VENTAS_CONTADO)}</strong> ({ultimoCuadre.RATIO_CONTADO_PCT}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="text-slate-600">
                      Ventas a Crédito: <strong>{formatMillones(ultimoCuadre.VENTAS_CREDITO)}</strong> ({ultimoCuadre.RATIO_CREDITO_PCT}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                    <span className="text-slate-600">
                      Servicios: <strong>{formatMillones(ultimoCuadre.SERVICIOS)}</strong>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Dos Columnas: Dictamen IA a la izquierda | Top Ventas a la derecha */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Dictamen IA de Tesorería */}
              <div className="lg:col-span-6 rounded-xl border border-sky-100 bg-sky-50/40 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sky-800 font-semibold text-xs uppercase tracking-wider">
                    <Sparkles className="w-4 h-4 text-sky-600" />
                    <span>Dictamen Ejecutivo de Tesorería (IA / Snowflake)</span>
                  </div>
                  <span className="text-[10px] text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded font-mono">
                    ID #{ultimoCuadre.ID_CUADRE}
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed font-normal whitespace-pre-line bg-white/70 p-3 rounded-lg border border-sky-100 shadow-2xs">
                  {ultimoCuadre.SINTESIS_TESORERIA || "No hay dictamen registrado para este cuadre."}
                </p>
                <div className="text-[10px] text-muted-foreground flex items-center justify-between pt-1">
                  <span>Registrado en Snowflake: {ultimoCuadre.REGISTRADO_EN}</span>
                  <span>Ejecutado por: {ultimoCuadre.EJECUTADO_POR}</span>
                </div>
              </div>

              {/* Mayores Ventas del Día */}
              <div className="lg:col-span-6 rounded-xl border border-border bg-card p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-ink font-semibold text-xs uppercase tracking-wider">
                    <Receipt className="w-4 h-4 text-slate-500" />
                    <span>Mayores Operaciones Comerciales del Día</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">Snowflake Gold Facts</span>
                </div>

                {ultimoCuadre.top_ventas && ultimoCuadre.top_ventas.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border border-border text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-slate-500 font-medium border-b border-border">
                        <tr>
                          <th className="py-1 px-2.5">Descripción</th>
                          <th className="py-1 px-2.5">Canal</th>
                          <th className="py-1 px-2.5 text-right">Monto</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60 tabular-nums">
                        {ultimoCuadre.top_ventas.map((tx) => (
                          <tr key={tx.ID_TRANSACCION} className="hover:bg-slate-50/60">
                            <td className="py-1.5 px-2.5 font-medium text-ink truncate max-w-[200px]">
                              {tx.DESCRIPCION}
                            </td>
                            <td className="py-1.5 px-2.5 text-slate-500">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                  tx.CATEGORIA === "VENTA CONTADO"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-amber-50 text-amber-700 border border-amber-200"
                                }`}
                              >
                                {tx.CATEGORIA}
                              </span>
                            </td>
                            <td className="py-1.5 px-2.5 text-right font-semibold text-ink">
                              {formatMillones(tx.MONTO)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic py-3">
                    Detalle de transacciones individuales no cargado.
                  </p>
                )}
              </div>
            </div>

            {/* Gráfico de Evolución de Liquidez Diaria */}
            {chartLiquidezData.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-ink uppercase tracking-wider">
                    Evolución Reciente de Recaudo Diario y Ratio de Contado (Últimos 14 Días)
                  </h4>
                  <span className="text-[10px] text-rose-600 font-semibold flex items-center gap-1">
                    <span className="w-2 h-0.5 bg-rose-500 inline-block" /> Umbral Mínimo 45%
                  </span>
                </div>
                <PlotlyChart
                  data={chartLiquidezData}
                  layout={chartLiquidezLayout}
                  loading={loadingCuadre}
                />
              </div>
            )}

            {/* Bitácora Histórica Plegable */}
            {mostrarHistorialCuadre && (
              <div className="rounded-xl border border-border bg-white p-4 space-y-3">
                <h4 className="text-xs font-semibold text-ink uppercase tracking-wider">
                  Bitácora de Cuadres Diarios Auditados en Snowflake
                </h4>
                <div className="overflow-x-auto rounded-lg border border-border text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-border">
                      <tr>
                        <th className="py-2 px-3">ID</th>
                        <th className="py-2 px-3">Fecha</th>
                        <th className="py-2 px-3 text-right">Venta Total</th>
                        <th className="py-2 px-3 text-right">Contado</th>
                        <th className="py-2 px-3 text-right">Crédito</th>
                        <th className="py-2 px-3 text-right">Ratio Contado %</th>
                        <th className="py-2 px-3 text-center">Estado</th>
                        <th className="py-2 px-3">Ejecutor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 tabular-nums">
                      {historialCuadres.map((h) => (
                        <tr key={h.ID_CUADRE} className="hover:bg-slate-50/60">
                          <td className="py-2 px-3 font-mono text-muted-foreground">{h.ID_CUADRE}</td>
                          <td className="py-2 px-3 font-medium text-ink">{h.FECHA}</td>
                          <td className="py-2 px-3 text-right font-semibold">{formatMillones(h.TOTAL_VENTAS)}</td>
                          <td className="py-2 px-3 text-right text-emerald-700 font-medium">{formatMillones(h.VENTAS_CONTADO)}</td>
                          <td className="py-2 px-3 text-right text-amber-700 font-medium">{formatMillones(h.VENTAS_CREDITO)}</td>
                          <td className="py-2 px-3 text-right font-bold">{h.RATIO_CONTADO_PCT}%</td>
                          <td className="py-2 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                h.ESTADO_LIQUIDEZ === "OPTIMA"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : h.ESTADO_LIQUIDEZ === "ADVERTENCIA"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {h.ESTADO_LIQUIDEZ}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-muted-foreground text-[11px]">{h.EJECUTADO_POR}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-slate-50 border border-border text-xs text-muted-foreground">
            No se ha ejecutado el cuadre diario de ventas todavía. Haz clic en "Auditar Cierre Diario" para evaluar la última fecha registrada.
          </div>
        )}
      </section>

      {/* Estado vacío si no hay filas para el filtro */}
      {!loading && mensual.length === 0 && (
        <EmptyState
          title="Sin datos para el filtro seleccionado"
          description="No se encontraron registros en Snowflake para este rango de fechas o combinación de filtros."
          actionLabel="Restablecer filtros"
          onAction={onResetFiltros}
        />
      )}

      {/* 2. Gráficos Principales */}
      {mensual.length > 0 && (
        <div className="space-y-4 sm:space-y-5">
          {/* Evolución mensual (Ancho completo) */}
          <section className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs hover:shadow-card transition-shadow">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-border/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-primary shrink-0">
                  <BarChart3 className="w-4 h-4" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-[15px] font-semibold text-ink">
                    Evolución mensual: Ingresos, Gastos y Utilidad
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Comparativa temporal de desempeño operativo consolidado en Snowflake Gold
                  </p>
                </div>
              </div>
              <SourceBadge variant="sql">Dato SQL</SourceBadge>
            </div>
            <PlotlyChart data={evolucionData} layout={evolucionLayout} loading={loading} />
          </section>

          {/* Gastos por Categoría y por Área */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
            <div className="lg:col-span-7 bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs hover:shadow-card transition-shadow">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-border/70">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                    <BarChart2 className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-semibold text-ink">
                      Gastos por categoría
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Distribución acumulada ordenada por volumen monetario
                    </p>
                  </div>
                </div>
                <SourceBadge variant="sql">Dato SQL</SourceBadge>
              </div>
              <PlotlyChart
                data={gastosCategoriaData}
                layout={categoriaLayout}
                loading={loading}
              />
            </div>

            <div className="lg:col-span-5 bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs hover:shadow-card transition-shadow">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-border/70">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                    <PieChart className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-semibold text-ink">
                      Gastos por área
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Participación de Operaciones, Ventas y Administración
                    </p>
                  </div>
                </div>
                <SourceBadge variant="sql">Dato SQL</SourceBadge>
              </div>
              <PlotlyChart data={gastosAreaData} layout={areaLayout} loading={loading} />
            </div>
          </section>

          {/* 3. Tabla de Serie Mensual Verificada */}
          <section className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-border/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                  <TableIcon className="w-4 h-4" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-[15px] font-semibold text-ink">
                    Serie mensual verificada
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Indicadores agregados reproducibles calculados con precisión monetaria (COP)
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 tabular-nums">
                {mensual.length} meses registrados
              </span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left border-collapse text-[13px] tabular-nums">
                <thead className="bg-muted/70 text-xs font-semibold text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-3.5 py-2.5 whitespace-nowrap">Mes</th>
                    <th className="px-3.5 py-2.5 text-right whitespace-nowrap">
                      Ingresos
                    </th>
                    <th className="px-3.5 py-2.5 text-right whitespace-nowrap">
                      Gastos
                    </th>
                    <th className="px-3.5 py-2.5 text-right whitespace-nowrap">
                      Utilidad
                    </th>
                    <th className="px-3.5 py-2.5 text-right whitespace-nowrap">
                      Margen
                    </th>
                    <th className="px-3.5 py-2.5 text-right whitespace-nowrap">
                      Var. Utilidad
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-ink">
                  {mensual
                    .slice()
                    .reverse()
                    .map((r) => {
                      const margenNum = Number(r.MARGEN_PCT) || 0;
                      return (
                        <tr
                          key={r.ANIO_MES}
                          className="hover:bg-blue-50/40 transition-colors duration-150 motion-reduce:transition-none"
                        >
                          <td className="px-3.5 py-2.5 font-semibold text-ink whitespace-nowrap">
                            {r.ANIO_MES}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-medium text-positive whitespace-nowrap">
                            {formatMillones(r.INGRESOS)}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-medium text-destructive whitespace-nowrap">
                            {formatMillones(r.GASTOS)}
                          </td>
                          <td
                            className={`px-3.5 py-2.5 text-right font-semibold whitespace-nowrap ${
                              (r.UTILIDAD || 0) >= 0 ? "text-ink" : "text-destructive"
                            }`}
                          >
                            {formatMillones(r.UTILIDAD)}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-medium whitespace-nowrap">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                                margenNum >= 15
                                  ? "bg-emerald-50 text-emerald-700"
                                  : margenNum >= 5
                                    ? "bg-slate-100 text-slate-700"
                                    : "bg-rose-50 text-rose-700"
                              }`}
                            >
                              {r.MARGEN_PCT ?? "—"}%
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-medium whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 font-semibold ${
                                (r.VAR_UTILIDAD_PCT || 0) > 0
                                  ? "text-positive"
                                  : (r.VAR_UTILIDAD_PCT || 0) < 0
                                    ? "text-destructive"
                                    : "text-muted-foreground"
                              }`}
                            >
                              {(r.VAR_UTILIDAD_PCT || 0) > 0 ? (
                                <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                              ) : (r.VAR_UTILIDAD_PCT || 0) < 0 ? (
                                <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />
                              ) : null}
                              {formatPct(r.VAR_UTILIDAD_PCT)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </section>

          {/* 4. Verificación de Calidad e Integridad en Snowflake */}
          {auditoria?.conteos && (
            <section
              className="bg-card border border-border rounded-xl p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs"
              aria-label="Integridad de Datos Snowflake"
            >
              <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                <ShieldCheck className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                <span className="font-semibold text-ink">
                  Integridad Snowflake ({auditoria.esquema || "DATAFINANCE.PUBLIC"}):
                </span>
                <span>
                  <strong className="text-positive tabular-nums">
                    {(auditoria.conteos.TOTAL_TRANSACCIONES || auditoria.conteos.SILVER || 0).toLocaleString("es-CO")}
                  </strong>{" "}
                  transacciones limpias |{" "}
                  <strong className="text-ink tabular-nums">
                    {(auditoria.conteos.IDS_UNICOS || auditoria.conteos.TOTAL_TRANSACCIONES || 0).toLocaleString("es-CO")}
                  </strong>{" "}
                  IDs únicos |{" "}
                  <span className="text-positive font-medium">100% Conforme</span>
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(auditoria.metricas_calidad || []).map((m) => (
                  <SourceBadge key={m.regla} variant="sql">
                    {m.regla}: {m.estado}
                  </SourceBadge>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
