import { memo, useEffect, useRef } from "react";
import Plotly from "plotly.js-dist-min";

/**
 * Wrapper memorizado de Plotly.js adaptado a las especificaciones de UI/UX Pro Max:
 * - Tipografía Inter & alineación tabular
 * - Ejes minimalistas de bajo ruido visual
 * - Tooltips de alto contraste tipo tarjeta (#0F172A)
 * - Soporte responsivo dinámico vía ResizeObserver
 */
function PlotlyChart({
  data,
  layout,
  config,
  heightClass = "h-[330px] min-h-[300px]",
  loading = false,
}) {
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || loading) return;

    const baseLayout = {
      autosize: true,
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      font: {
        family: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        color: "#64748B",
        size: 12,
      },
      margin: { t: 24, r: 16, b: 40, l: 56 },
      hoverlabel: {
        bgcolor: "#0F172A",
        bordercolor: "#334155",
        font: {
          family: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          color: "#FFFFFF",
          size: 12,
        },
        namelength: -1,
      },
      xaxis: {
        showgrid: true,
        gridcolor: "#F1F5F9",
        gridwidth: 1,
        zeroline: true,
        zerolinecolor: "#E2E8F0",
        zerolinewidth: 1,
        tickfont: {
          family: "Inter, system-ui, sans-serif",
          color: "#64748B",
          size: 11,
        },
        linecolor: "#E2E8F0",
      },
      yaxis: {
        showgrid: true,
        gridcolor: "#F1F5F9",
        gridwidth: 1,
        zeroline: true,
        zerolinecolor: "#E2E8F0",
        zerolinewidth: 1,
        tickfont: {
          family: "Inter, system-ui, sans-serif",
          color: "#64748B",
          size: 11,
        },
        linecolor: "#E2E8F0",
      },
    };

    const mergedLayout = {
      ...baseLayout,
      ...layout,
      xaxis: {
        ...baseLayout.xaxis,
        ...(layout?.xaxis || {}),
      },
      yaxis: {
        ...baseLayout.yaxis,
        ...(layout?.yaxis || {}),
      },
      hoverlabel: {
        ...baseLayout.hoverlabel,
        ...(layout?.hoverlabel || {}),
      },
    };

    const mergedConfig = {
      responsive: true,
      displaylogo: false,
      displayModeBar: false,
      scrollZoom: false,
      doubleClick: "reset",
      ...config,
    };

    Plotly.react(el, data, mergedLayout, mergedConfig);

    // ResizeObserver para responder a cambios de contenedor (ej: colapso de sidebar o breakpoints)
    let resizeObserver = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        if (el) {
          Plotly.Plots.resize(el);
        }
      });
      resizeObserver.observe(el);
    }

    const handleWindowResize = () => {
      if (el) {
        Plotly.Plots.resize(el);
      }
    };
    window.addEventListener("resize", handleWindowResize);

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener("resize", handleWindowResize);
      Plotly.purge(el);
    };
  }, [data, layout, config, loading]);

  if (loading) {
    return (
      <div
        className={`w-full ${heightClass} rounded-xl bg-muted/60 animate-pulse motion-reduce:animate-none flex items-center justify-center`}
        aria-label="Cargando gráfica financiera..."
      >
        <span className="text-xs text-muted-foreground font-medium">
          Cargando datos analíticos...
        </span>
      </div>
    );
  }

  return <div ref={containerRef} className={`w-full ${heightClass}`} />;
}

export default memo(PlotlyChart);
