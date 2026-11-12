import { useMemo } from "react";
import { ShieldCheck } from "lucide-react";
import KpiCard from "../components/KpiCard.jsx";
import PlotlyChart from "../components/PlotlyChart.jsx";
import SourceBadge from "../components/SourceBadge.jsx";
import {
  PLOTLY_CATEGORICAL,
  PLOTLY_SERIES,
  formatCOP,
  formatMillones,
  formatPct,
} from "../utils/formatters.js";

const EMPTY_MESSAGE =
  "No hay datos suficientes para el periodo o los filtros seleccionados en Snowflake.";

/**
 * Vista 1: Resumen Financiero (KPIs Bento, Evolución mensual, Categorías/Áreas y Tabla SQL).
 */
export default function DashboardView({ kpis, auditoria, loading }) {
  const resumen = kpis?.resumen || {};
  const mensual = kpis?.mensual || [];

  const evolucionData = useMemo(() => {
    const x = mensual.map((r) => r.ANIO_MES);
    return [
      {
        x,
        y: mensual.map((r) => r.INGRESOS / 1e6),
        type: "bar",
        name: "Ingresos (M COP)",
        marker: { color: PLOTLY_SERIES.ingresos },
        hovertemplate: "%{x}<br>Ingresos: %{y:.2f} M COP<extra></extra>",
      },
      {
        x,
        y: mensual.map((r) => r.GASTOS / 1e6),
        type: "bar",
        name: "Gastos (M COP)",
        marker: { color: PLOTLY_SERIES.gastos },
        hovertemplate: "%{x}<br>Gastos: %{y:.2f} M COP<extra></extra>",
      },
      {
        x,
        y: mensual.map((r) => r.UTILIDAD / 1e6),
        type: "scatter",
        mode: "lines+markers",
        name: "Utilidad (M COP)",
        line: { color: PLOTLY_SERIES.utilidad, width: 3 },
        marker: { size: 6, color: PLOTLY_SERIES.utilidad },
        hovertemplate: "%{x}<br>Utilidad: %{y:.2f} M COP<extra></extra>",
      },
    ];
  }, [mensual]);

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
        marker: { color: PLOTLY_SERIES.gastos },
        hovertemplate: "%{y}: %{x:.2f} M COP<extra></extra>",
      },
    ];
  }, [kpis]);

  const gastosAreaData = useMemo(() => {
    const gastosArea = (kpis?.por_area || []).filter((r) => r.TIPO === "GASTO");
    return [
      {
        labels: gastosArea.map((r) => r.AREA),
        values: gastosArea.map((r) => r.MONTO_TOTAL / 1e6),
        type: "pie",
        hole: 0.48,
        marker: { colors: PLOTLY_CATEGORICAL },
        hovertemplate: "%{label}: %{value:.2f} M COP (%{percent})<extra></extra>",
      },
    ];
  }, [kpis]);

  const evolucionLayout = useMemo(
    () => ({
      barmode: "group",
      hovermode: "x unified",
      yaxis: { title: "Millones COP" },
      legend: { orientation: "h", y: 1.14, x: 0 },
    }),
    []
  );

  const categoriaLayout = useMemo(
    () => ({
      margin: { t: 16, r: 20, b: 40, l: 135 },
      xaxis: { title: "Millones COP" },
    }),
    []
  );

  const areaLayout = useMemo(
    () => ({
      margin: { t: 16, r: 16, b: 16, l: 16 },
      legend: { orientation: "h", y: -0.05 },
    }),
    []
  );

  const utilidadPositiva = (resumen.utilidad_total || 0) >= 0;

  return (
    <div className="space-y-4">
      {/* Row 1: Bento KPI Strip */}
      <section
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3"
        aria-label="Indicadores clave"
      >
        <KpiCard
          label="Ingresos Totales"
          value={formatMillones(resumen.ingresos_totales)}
          subValue={formatCOP(resumen.ingresos_totales)}
          tone="positive"
          loading={loading}
        />
        <KpiCard
          label="Gastos Totales"
          value={formatMillones(resumen.gastos_totales)}
          subValue={formatCOP(resumen.gastos_totales)}
          tone="destructive"
          loading={loading}
        />
        <KpiCard
          label="Utilidad Neta"
          value={formatMillones(resumen.utilidad_total)}
          subValue={formatCOP(resumen.utilidad_total)}
          tone={utilidadPositiva ? "primary" : "destructive"}
          loading={loading}
        />
        <KpiCard
          label="Margen Operativo"
          value={`${resumen.margen_pct ?? 0}%`}
          subValue={`${resumen.total_transacciones?.toLocaleString("es-CO") || 0} transacciones limpias`}
          tone="neutral"
          loading={loading}
        />
      </section>

      {!loading && mensual.length === 0 && (
        <div
          role="status"
          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {EMPTY_MESSAGE}
        </div>
      )}

      {/* Row 2: Evolución + Gastos por Área */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h3 className="font-sans text-base font-semibold text-foreground">
              Evolución Mensual: Ingresos, Gastos y Utilidad
            </h3>
            <SourceBadge variant="sql" showIcon>
              Dato SQL · Gold/Silver
            </SourceBadge>
          </div>
          <PlotlyChart data={evolucionData} layout={evolucionLayout} loading={loading} />
        </div>

        <div className="lg:col-span-4 bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h3 className="font-sans text-base font-semibold text-foreground">
              Gastos por Área
            </h3>
            <SourceBadge variant="sql">Dato SQL</SourceBadge>
          </div>
          <PlotlyChart data={gastosAreaData} layout={areaLayout} loading={loading} />
        </div>
      </section>

      {/* Row 3: Gastos por Categoría + Tabla Mensual Compacta */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h3 className="font-sans text-base font-semibold text-foreground">
              Gastos por Categoría
            </h3>
            <SourceBadge variant="sql">Dato SQL</SourceBadge>
          </div>
          <PlotlyChart data={gastosCategoriaData} layout={categoriaLayout} loading={loading} />
        </div>

        <div className="lg:col-span-7 bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="font-sans text-base font-semibold text-foreground">
              Serie Mensual Verificada (COP)
            </h3>
            <SourceBadge variant="sql">{mensual.length} periodos</SourceBadge>
          </div>

          <div className="overflow-x-auto max-h-[340px] rounded-lg border border-border">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-muted text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Mes</th>
                  <th className="px-3 py-2 text-right">Ingresos</th>
                  <th className="px-3 py-2 text-right">Gastos</th>
                  <th className="px-3 py-2 text-right">Utilidad</th>
                  <th className="px-3 py-2 text-right">Margen</th>
                  <th className="px-3 py-2 text-right">Var. Utilidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {mensual
                  .slice()
                  .reverse()
                  .map((r) => (
                    <tr
                      key={r.ANIO_MES}
                      className="hover:bg-muted/50 transition-colors duration-150 motion-reduce:transition-none"
                    >
                      <td className="px-3 py-2 font-mono font-semibold text-ink whitespace-nowrap">
                        {r.ANIO_MES}
                      </td>
                      <td className="px-3 py-2 font-mono tabular-nums text-right text-positive whitespace-nowrap">
                        {formatMillones(r.INGRESOS)}
                      </td>
                      <td className="px-3 py-2 font-mono tabular-nums text-right text-destructive whitespace-nowrap">
                        {formatMillones(r.GASTOS)}
                      </td>
                      <td
                        className={`px-3 py-2 font-mono font-semibold tabular-nums text-right whitespace-nowrap ${
                          (r.UTILIDAD || 0) >= 0 ? "text-primary" : "text-destructive"
                        }`}
                      >
                        {formatMillones(r.UTILIDAD)}
                      </td>
                      <td className="px-3 py-2 font-mono tabular-nums text-right text-ink whitespace-nowrap">
                        {r.MARGEN_PCT ?? "—"}%
                      </td>
                      <td className="px-3 py-2 font-mono tabular-nums text-right text-muted-foreground whitespace-nowrap">
                        {formatPct(r.VAR_UTILIDAD_PCT)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Auditoría Medallion */}
      {auditoria?.conteos && (
        <section
          className="bg-card border border-border rounded-xl px-4 py-3 shadow-sm flex flex-wrap items-center justify-between gap-3 text-sm"
          aria-label="Trazabilidad Medallion"
        >
          <div className="flex flex-wrap items-center gap-2 text-ink">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
            <strong>Trazabilidad Medallion:</strong>
            <span>
              Bronze (
              <code className="font-mono font-semibold tabular-nums">
                {auditoria.conteos.BRONZE?.toLocaleString("es-CO")}
              </code>
              ) → Silver limpio (
              <code className="font-mono font-semibold tabular-nums text-positive">
                {auditoria.conteos.SILVER?.toLocaleString("es-CO")}
              </code>
              ) + Rechazados auditados (
              <code className="font-mono font-semibold tabular-nums text-accent">
                {auditoria.conteos.RECHAZADOS?.toLocaleString("es-CO")}
              </code>
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
  );
}
