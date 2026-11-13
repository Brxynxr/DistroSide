import { useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Filter,
} from "lucide-react";
import PlotlyChart from "../components/PlotlyChart.jsx";
import SourceBadge from "../components/SourceBadge.jsx";
import AlertBanner from "../components/ui/AlertBanner.jsx";
import Badge from "../components/ui/Badge.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { PLOTLY_SERIES, formatMillones } from "../utils/formatters.js";

function obtenerGravedad(zScore) {
  const absZ = Math.abs(Number(zScore) || 0);
  if (absZ >= 3.5) {
    return { label: "Crítica", variant: "negative" };
  }
  return { label: "Advertencia", variant: "warning" };
}

/**
 * Vista 3: Monitor de Anomalías — Lectura rápida de desviaciones estadísticas (Z-Score >= 2.5).
 */
export default function AnomaliesView({ anomalias }) {
  const [filtroTipo, setFiltroTipo] = useState("TODOS");

  const filtradas = useMemo(() => {
    if (filtroTipo === "TODOS") return anomalias;
    return anomalias.filter((a) => a.TIPO_ANOMALIA === filtroTipo);
  }, [anomalias, filtroTipo]);

  const criticasCount = useMemo(
    () => anomalias.filter((a) => Math.abs(Number(a.Z_SCORE) || 0) >= 3.5).length,
    [anomalias]
  );

  const advertenciasCount = useMemo(
    () => anomalias.length - criticasCount,
    [anomalias, criticasCount]
  );

  const maxDesviacion = useMemo(() => {
    if (anomalias.length === 0) return 0;
    return Math.max(...anomalias.map((a) => Math.abs(Number(a.Z_SCORE) || 0)));
  }, [anomalias]);

  const anomaliasChartData = useMemo(() => {
    const ordenadas = filtradas.slice().reverse();
    return [
      {
        x: ordenadas.map((a) => `${a.ANIO_MES} · ${a.CATEGORIA}`),
        y: ordenadas.map((a) => Number(a.Z_SCORE) || 0),
        text: ordenadas.map((a) => `${(Number(a.Z_SCORE) || 0).toFixed(1)}σ`),
        textposition: "outside",
        cliponaxis: false,
        textfont: {
          family: "Inter, system-ui, sans-serif",
          size: 10,
          color: "#475569",
        },
        type: "bar",
        marker: {
          color: ordenadas.map((a) =>
            Math.abs(Number(a.Z_SCORE) || 0) >= 3.5
              ? PLOTLY_SERIES.critica
              : PLOTLY_SERIES.alerta
          ),
          line: {
            color: ordenadas.map((a) =>
              Math.abs(Number(a.Z_SCORE) || 0) >= 3.5
                ? PLOTLY_SERIES.criticaBorder
                : PLOTLY_SERIES.alertaBorder
            ),
            width: 1,
          },
          opacity: 0.9,
        },
        customdata: ordenadas.map((a) => [
          obtenerGravedad(a.Z_SCORE).label,
          formatMillones(a.VALOR_OBSERVADO),
          formatMillones(a.VALOR_ESPERADO),
          a.TIPO_ANOMALIA,
        ]),
        hovertemplate:
          "<b>%{x}</b><br>Gravedad: %{customdata[0]}<br>Z-Score: %{y:.2f} σ<br>Observado: %{customdata[1]}<br>Esperado: %{customdata[2]}<extra></extra>",
      },
    ];
  }, [filtradas]);

  const chartLayout = useMemo(
    () => ({
      margin: { t: 28, r: 24, b: 100, l: 60 },
      yaxis: {
        title: {
          text: "Z-Score (Desviación σ)",
          font: { family: "Inter, system-ui, sans-serif", size: 11, color: "#64748B" },
        },
        ticksuffix: "σ",
        zeroline: true,
        zerolinecolor: "#94A3B8",
        zerolinewidth: 1.5,
      },
      xaxis: {
        tickangle: -30,
        tickfont: {
          family: "Inter, system-ui, sans-serif",
          size: 11,
          color: "#475569",
        },
      },
      shapes: [
        {
          type: "line",
          xref: "paper",
          x0: 0,
          x1: 1,
          y0: 3.5,
          y1: 3.5,
          line: {
            color: PLOTLY_SERIES.critica,
            width: 1.5,
            dash: "dot",
          },
        },
        {
          type: "line",
          xref: "paper",
          x0: 0,
          x1: 1,
          y0: 2.5,
          y1: 2.5,
          line: {
            color: PLOTLY_SERIES.alerta,
            width: 1.5,
            dash: "dot",
          },
        },
      ],
      annotations: [
        {
          xref: "paper",
          x: 1,
          y: 3.5,
          xanchor: "right",
          yanchor: "bottom",
          text: "Umbral Crítico (3.5σ)",
          showarrow: false,
          font: {
            family: "Inter, system-ui, sans-serif",
            size: 10,
            color: PLOTLY_SERIES.critica,
          },
        },
        {
          xref: "paper",
          x: 1,
          y: 2.5,
          xanchor: "right",
          yanchor: "bottom",
          text: "Umbral Advertencia (2.5σ)",
          showarrow: false,
          font: {
            family: "Inter, system-ui, sans-serif",
            size: 10,
            color: PLOTLY_SERIES.alerta,
          },
        },
      ],
    }),
    []
  );

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* 1. Tarjetas de métricas clave de anomalías */}
      <section
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
        aria-label="Resumen de anomalías estadísticas"
      >
        <article className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs flex items-center justify-between gap-3">
          <div>
            <span className="text-xs font-medium text-muted-foreground block">
              Total detectadas
            </span>
            <div className="text-2xl font-bold text-ink tabular-nums mt-0.5">
              {anomalias.length}
            </div>
            <span className="text-[11px] text-muted-foreground">Meses cerrados auditados</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
            <Activity className="w-5 h-5" />
          </div>
        </article>

        <article className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs flex items-center justify-between gap-3">
          <div>
            <span className="text-xs font-medium text-rose-700 block">
              Anomalías críticas
            </span>
            <div className="text-2xl font-bold text-destructive tabular-nums mt-0.5">
              {criticasCount}
            </div>
            <span className="text-[11px] text-muted-foreground">|Z-Score| &ge; 3.5 σ</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-destructive shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
        </article>

        <article className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs flex items-center justify-between gap-3">
          <div>
            <span className="text-xs font-medium text-amber-800 block">
              Advertencias moderadas
            </span>
            <div className="text-2xl font-bold text-accent tabular-nums mt-0.5">
              {advertenciasCount}
            </div>
            <span className="text-[11px] text-muted-foreground">2.5 &le; |Z-Score| &lt; 3.5 σ</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-accent shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </article>

        <article className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs flex items-center justify-between gap-3">
          <div>
            <span className="text-xs font-medium text-primary block">
              Mayor desviación
            </span>
            <div className="text-2xl font-bold text-ink tabular-nums mt-0.5">
              {maxDesviacion.toFixed(2)} σ
            </div>
            <span className="text-[11px] text-muted-foreground">Pico atípico máximo</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-primary shrink-0">
            <AlertOctagon className="w-5 h-5" />
          </div>
        </article>
      </section>

      {anomalias.length > 0 && (
        <AlertBanner
          type={criticasCount > 0 ? "error" : "warning"}
          title="Desviaciones estadísticas detectadas en meses cerrados"
        >
          Se identificaron{" "}
          <strong className="tabular-nums font-bold">{anomalias.length}</strong> anomalías en Snowflake Gold
          ({criticasCount} críticas con |Z-Score| &ge; 3.5 σ y{" "}
          {advertenciasCount} advertencias estadísticas).
        </AlertBanner>
      )}

      {/* Gráfica Z-Score */}
      <section className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs hover:shadow-card transition-shadow">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-2.5 border-b border-border/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-accent shrink-0">
              <BarChart3 className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-ink">
                Desviación estadística por categoría y mes (Z-Score)
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Valores que exceden 2.5 desviaciones estándar frente a la media móvil histórica
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                aria-label="Filtrar por tipo de anomalía"
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="h-8 rounded-lg border border-border bg-card px-2.5 text-xs font-semibold text-ink cursor-pointer focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 shadow-xs"
              >
                <option value="TODOS">Todos los tipos</option>
                <option value="PICO_ATIPICO">Picos atípicos (gasto elevado)</option>
                <option value="CAIDA_ATIPICA">Caídas atípicas</option>
              </select>
            </div>
            <SourceBadge variant="alert">GOLD.ANOMALIAS</SourceBadge>
          </div>
        </div>

        {filtradas.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title="Sin anomalías para este filtro"
            description="Cambia el selector de tipo para ver todas las anomalías detectadas."
            actionLabel={filtroTipo !== "TODOS" ? "Mostrar todas" : undefined}
            onAction={() => setFiltroTipo("TODOS")}
          />
        ) : (
          <PlotlyChart data={anomaliasChartData} layout={chartLayout} />
        )}
      </section>

      {/* Tabla detallada */}
      {filtradas.length > 0 && (
        <section className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-border/70">
            <div>
              <h2 className="text-[15px] font-semibold text-ink">
                Registro detallado de anomalías
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Valores observados vs valores proyectados por el modelo de calidad de datos
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 tabular-nums">
              {filtradas.length} registros
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left border-collapse text-[13px] tabular-nums">
              <thead className="bg-muted/70 text-xs font-semibold text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-3.5 py-2.5 whitespace-nowrap">Gravedad</th>
                  <th className="px-3.5 py-2.5 whitespace-nowrap">Mes</th>
                  <th className="px-3.5 py-2.5 whitespace-nowrap">Categoría</th>
                  <th className="px-3.5 py-2.5 whitespace-nowrap">Tipo</th>
                  <th className="px-3.5 py-2.5 text-right whitespace-nowrap">
                    Observado
                  </th>
                  <th className="px-3.5 py-2.5 text-right whitespace-nowrap">
                    Esperado
                  </th>
                  <th className="px-3.5 py-2.5 text-right whitespace-nowrap">
                    Z-Score
                  </th>
                  <th className="px-3.5 py-2.5">Explicación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-ink">
                {filtradas.map((a, idx) => {
                  const gravedad = obtenerGravedad(a.Z_SCORE);
                  const isPico = a.TIPO_ANOMALIA === "PICO_ATIPICO";
                  return (
                    <tr
                      key={idx}
                      className="hover:bg-amber-50/30 transition-colors duration-150 motion-reduce:transition-none"
                    >
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <Badge
                          variant={gravedad.variant}
                          dot={true}
                          icon={gravedad.variant === "negative" ? AlertCircle : AlertTriangle}
                        >
                          {gravedad.label}
                        </Badge>
                      </td>
                      <td className="px-3.5 py-2.5 font-semibold text-ink whitespace-nowrap">
                        {a.ANIO_MES}
                      </td>
                      <td className="px-3.5 py-2.5 font-medium text-ink whitespace-nowrap">
                        {a.CATEGORIA}
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                            isPico
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-amber-50 text-amber-800 border-amber-200"
                          }`}
                        >
                          {isPico ? (
                            <ArrowUpRight className="w-3 h-3 shrink-0" />
                          ) : (
                            <ArrowDownRight className="w-3 h-3 shrink-0" />
                          )}
                          <span>{a.TIPO_ANOMALIA}</span>
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-bold text-ink whitespace-nowrap">
                        {formatMillones(a.VALOR_OBSERVADO)}
                      </td>
                      <td className="px-3.5 py-2.5 text-right text-muted-foreground whitespace-nowrap font-medium">
                        {formatMillones(a.VALOR_ESPERADO)}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-bold text-ink whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                          {Number(a.Z_SCORE).toFixed(2)} σ
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-xs text-muted-foreground min-w-[240px] leading-relaxed">
                        {a.MOTIVO}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
