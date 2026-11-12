import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import PlotlyChart from "../components/PlotlyChart.jsx";
import SourceBadge from "../components/SourceBadge.jsx";
import { PLOTLY_SERIES, formatMillones } from "../utils/formatters.js";

/**
 * Vista 3: Monitor de Anomalías Estadísticas (GOLD.ANOMALIAS).
 */
export default function AnomaliesView({ anomalias }) {
  const [filtroTipo, setFiltroTipo] = useState("TODOS");

  const filtradas = useMemo(() => {
    if (filtroTipo === "TODOS") return anomalias;
    return anomalias.filter((a) => a.TIPO_ANOMALIA === filtroTipo);
  }, [anomalias, filtroTipo]);

  const anomaliasChartData = useMemo(() => {
    const ordenadas = filtradas.slice().reverse();
    return [
      {
        x: ordenadas.map((a) => `${a.ANIO_MES} · ${a.CATEGORIA}`),
        y: ordenadas.map((a) => a.Z_SCORE),
        type: "bar",
        marker: {
          color: ordenadas.map((a) =>
            a.Z_SCORE >= 0 ? PLOTLY_SERIES.gastos : PLOTLY_SERIES.alerta
          ),
        },
        hovertemplate: "%{x}<br>Z-Score: %{y:.2f}<extra></extra>",
      },
    ];
  }, [filtradas]);

  const chartLayout = useMemo(
    () => ({
      yaxis: { title: "Z-Score (desviaciones estándar)" },
      margin: { t: 20, r: 20, b: 110, l: 60 },
    }),
    []
  );

  const picosCount = anomalias.filter((a) => a.TIPO_ANOMALIA === "PICO_ATIPICO").length;

  return (
    <div className="space-y-4">
      {picosCount > 0 && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <AlertTriangle className="w-4 h-4 text-accent shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <strong>Alertas estadísticas activas:</strong> se detectaron{" "}
            <span className="font-mono font-bold tabular-nums">{anomalias.length}</span> anomalías
            en Snowflake ({" "}
            <span className="font-mono font-semibold tabular-nums">{picosCount}</span> picos
            atípicos). Revisa periodo, categoría y Z-Score antes de emitir conclusiones.
          </div>
        </div>
      )}

      <section className="bg-card border border-border rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="font-sans text-base font-semibold text-foreground">
            Desviación Estadística (Z-Score)
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filtrar por tipo de anomalía"
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="rounded-lg border border-slate-300 bg-card px-2.5 py-1 text-xs font-medium text-ink cursor-pointer focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="TODOS">Todos los tipos</option>
              <option value="PICO_ATIPICO">PICO_ATIPICO</option>
              <option value="CAIDA_ATIPICA">CAIDA_ATIPICA</option>
            </select>
            <SourceBadge variant="alert" showIcon>
              Alerta Estadística · GOLD.ANOMALIAS
            </SourceBadge>
          </div>
        </div>

        <PlotlyChart data={anomaliasChartData} layout={chartLayout} />
      </section>

      <section className="bg-card border border-border rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="font-sans text-base font-semibold text-foreground">
            Detalle de Anomalías Detectadas
          </h3>
          <SourceBadge variant="alert">{filtradas.length} registros</SourceBadge>
        </div>

        {filtradas.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No hay anomalías registradas para el filtro seleccionado.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left border-collapse">
              <thead className="bg-muted text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Mes</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Categoría</th>
                  <th className="px-3 py-2 text-right">Valor Observado</th>
                  <th className="px-3 py-2 text-right">Promedio Esperado</th>
                  <th className="px-3 py-2 text-right">Z-Score</th>
                  <th className="px-3 py-2">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {filtradas.map((a, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-muted/50 transition-colors duration-150 motion-reduce:transition-none"
                  >
                    <td className="px-3 py-2 font-mono font-semibold text-ink whitespace-nowrap">
                      {a.ANIO_MES}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <SourceBadge
                        variant={a.TIPO_ANOMALIA === "PICO_ATIPICO" ? "danger" : "alert"}
                      >
                        {a.TIPO_ANOMALIA}
                      </SourceBadge>
                    </td>
                    <td className="px-3 py-2 font-medium text-ink whitespace-nowrap">
                      {a.CATEGORIA}
                    </td>
                    <td className="px-3 py-2 font-mono tabular-nums text-right text-ink whitespace-nowrap">
                      {formatMillones(a.VALOR_OBSERVADO)}
                    </td>
                    <td className="px-3 py-2 font-mono tabular-nums text-right text-muted-foreground whitespace-nowrap">
                      {formatMillones(a.VALOR_ESPERADO)}
                    </td>
                    <td className="px-3 py-2 font-mono font-bold tabular-nums text-right text-ink whitespace-nowrap">
                      {a.Z_SCORE}
                    </td>
                    <td className="px-3 py-2 text-sm text-ink min-w-[240px]">{a.MOTIVO}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
