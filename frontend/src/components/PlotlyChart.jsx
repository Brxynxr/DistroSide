import { memo, useEffect, useRef } from "react";
import Plotly from "plotly.js-dist-min";

/**
 * Wrapper memorizado de Plotly.js con dimensiones reservadas para evitar CLS
 * y estilos sincronizados con MASTER.md.
 */
function PlotlyChart({ data, layout, config, heightClass = "h-[340px] min-h-[320px]", loading = false }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || loading) return;

    const mergedLayout = {
      autosize: true,
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      font: { family: "Fira Sans, system-ui, sans-serif", color: "#475569", size: 12 },
      margin: { t: 24, r: 16, b: 44, l: 60 },
      hoverlabel: {
        bgcolor: "#0F172A",
        bordercolor: "#1E40AF",
        font: { family: "Fira Code, monospace", color: "#FFFFFF", size: 12 },
      },
      xaxis: {
        gridcolor: "#E2E8F0",
        zerolinecolor: "#CBD5E1",
        ...(layout?.xaxis || {}),
      },
      yaxis: {
        gridcolor: "#E2E8F0",
        zerolinecolor: "#CBD5E1",
        ...(layout?.yaxis || {}),
      },
      ...layout,
    };

    if (layout?.xaxis) {
      mergedLayout.xaxis = {
        gridcolor: "#E2E8F0",
        zerolinecolor: "#CBD5E1",
        ...layout.xaxis,
      };
    }
    if (layout?.yaxis) {
      mergedLayout.yaxis = {
        gridcolor: "#E2E8F0",
        zerolinecolor: "#CBD5E1",
        ...layout.yaxis,
      };
    }

    const mergedConfig = {
      responsive: true,
      displaylogo: false,
      displayModeBar: false,
      ...config,
    };

    Plotly.react(el, data, mergedLayout, mergedConfig);

    const handleResize = () => Plotly.Plots.resize(el);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      Plotly.purge(el);
    };
  }, [data, layout, config, loading]);

  if (loading) {
    return (
      <div
        className={`w-full ${heightClass} rounded-lg bg-muted animate-pulse motion-reduce:animate-none`}
        aria-label="Cargando gráfica"
      />
    );
  }

  return <div ref={containerRef} className={`w-full ${heightClass}`} />;
}

export default memo(PlotlyChart);
