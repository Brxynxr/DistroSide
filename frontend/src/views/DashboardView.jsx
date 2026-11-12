import { useMemo } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart2,
  BarChart3,
  CreditCard,
  DollarSign,
  Layers,
  Percent,
  PieChart,
  ShieldCheck,
  Table as TableIcon,
  Wallet,
} from "lucide-react";
import KpiCard from "../components/KpiCard.jsx";
import PlotlyChart from "../components/PlotlyChart.jsx";
import SourceBadge from "../components/SourceBadge.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import {
  PLOTLY_CATEGORICAL,
  PLOTLY_SERIES,
  formatCOP,
  formatMillones,
  formatPct,
} from "../utils/formatters.js";

/**
 * Vista 1: Resumen Financiero — Protagonismo en KPIs, gráficos limpios y serie mensual verificada.
 */
export default function DashboardView({ kpis, auditoria, loading, onResetFiltros }) {
  const resumen = kpis?.resumen || {};
  const mensual = kpis?.mensual || [];

  // Último mes cerrado de la serie para mostrar variaciones MoM confiables
  const ultimoMesConVariacion = useMemo(() => {
    if (mensual.length < 2) return null;
    return mensual[mensual.length - 1];
  }, [mensual]);

  // Gráfico 1: Evolución Mensual
  const evolucionData = useMemo(() => {
    const x = mensual.map((r) => r.ANIO_MES);
    return [
      {
        x,
        y: mensual.map((r) => r.INGRESOS / 1e6),
        type: "bar",
        name: "Ingresos",
        marker: { color: PLOTLY_SERIES.ingresos, opacity: 0.9, line: { width: 0 } },
        hovertemplate: "<b>%{x}</b><br>Ingresos: %{y:.2f} M COP<extra></extra>",
      },
      {
        x,
        y: mensual.map((r) => r.GASTOS / 1e6),
        type: "bar",
        name: "Gastos",
        marker: { color: PLOTLY_SERIES.gastos, opacity: 0.85, line: { width: 0 } },
        hovertemplate: "<b>%{x}</b><br>Gastos: %{y:.2f} M COP<extra></extra>",
      },
      {
        x,
        y: mensual.map((r) => r.UTILIDAD / 1e6),
        type: "scatter",
        mode: "lines+markers",
        name: "Utilidad neta",
        line: { color: PLOTLY_SERIES.utilidad, width: 2.5 },
        marker: { size: 6, color: PLOTLY_SERIES.utilidad },
        hovertemplate: "<b>%{x}</b><br>Utilidad: %{y:.2f} M COP<extra></extra>",
      },
    ];
  }, [mensual]);

  // Gráfico 2: Gastos por Categoría
  const gastosCategoriaData = useMemo(() => {
    const gastos = (kpis?.por_categoria || [])
      .filter((r) => r.TIPO === "GASTO")
      .slice()
      .reverse();
    return [
      {
        x: gastos.map((r) => r.MONTO_TOTAL / 1e6),
        y: gastos.map((r) => r.CATEGORIA),
        type: "bar",
        orientation: "h",
        marker: { color: "#3B82F6", opacity: 0.85 },
        hovertemplate: "<b>%{y}</b>: %{x:.2f} M COP<extra></extra>",
      },
    ];
  }, [kpis]);

  // Gráfico 3: Gastos por Área
  const gastosAreaData = useMemo(() => {
    const gastosArea = (kpis?.por_area || []).filter((r) => r.TIPO === "GASTO");
    return [
      {
        labels: gastosArea.map((r) => r.AREA),
        values: gastosArea.map((r) => r.MONTO_TOTAL / 1e6),
        type: "pie",
        hole: 0.55,
        marker: { colors: PLOTLY_CATEGORICAL },
        textinfo: "percent",
        hovertemplate: "<b>%{label}</b>: %{value:.2f} M COP (%{percent})<extra></extra>",
      },
    ];
  }, [kpis]);

  const evolucionLayout = useMemo(
    () => ({
      barmode: "group",
      bargap: 0.25,
      bargroupgap: 0.1,
      hovermode: "x unified",
      yaxis: { title: "Millones COP" },
      legend: { orientation: "h", y: 1.15, x: 0 },
    }),
    []
  );

  const categoriaLayout = useMemo(
    () => ({
      margin: { t: 10, r: 16, b: 36, l: 125 },
      xaxis: { title: "Millones COP" },
    }),
    []
  );

  const areaLayout = useMemo(
    () => ({
      margin: { t: 10, r: 10, b: 10, l: 10 },
      legend: { orientation: "h", y: -0.1 },
    }),
    []
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

          {/* 4. Auditoría Medallion Discreta */}
          {auditoria?.conteos && (
            <section
              className="bg-card border border-border rounded-xl p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs"
              aria-label="Trazabilidad Medallion"
            >
              <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                <ShieldCheck className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                <span className="font-semibold text-ink">Trazabilidad Medallion:</span>
                <span>
                  Bronze (
                  <strong className="text-ink tabular-nums">
                    {auditoria.conteos.BRONZE?.toLocaleString("es-CO")}
                  </strong>
                  ) → Silver (
                  <strong className="text-positive tabular-nums">
                    {auditoria.conteos.SILVER?.toLocaleString("es-CO")}
                  </strong>
                  ) + Rechazados (
                  <strong className="text-accent tabular-nums">
                    {auditoria.conteos.RECHAZADOS?.toLocaleString("es-CO")}
                  </strong>
                  )
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(auditoria.motivos_rechazo || []).map((m) => (
                  <SourceBadge key={m.MOTIVO_RECHAZO} variant="alert">
                    {m.MOTIVO_RECHAZO}: {m.CANTIDAD}
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
