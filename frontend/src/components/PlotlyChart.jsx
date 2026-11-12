import { memo, useEffect, useRef } from "react";
import Plotly from "plotly.js-dist-min";

/**
 * Wrapper memorizado de Plotly.js adaptado a estética minimalista SaaS (Inter, ejes discretos, sin ruido).
 */
function PlotlyChart({ data, layout, config, heightClass = "h-[330px] min-h-[300px]", loading = false }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || loading) return;

    const mergedLayout = {
      autosize: true,
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      font: { family: "Inter, system-ui, sans-serif", color: "#64748B", size: 12 },
      margin: { t: 24, r: 16, b: 40, l: 56 },
      hoverlabel: {
        bgcolor: "#0F172A",
        bordercolor: "#1E293B",
        font: { family: "Inter, system-ui, sans-serif", color: "#FFFFFF", size: 12 },
      },
      xaxis: {
        gridcolor: "#F1F5F9",
        zerolinecolor: "#E2E8F0",
        tickfont: { color: "#64748B", size: 11 },
        ...(layout?.xaxis || {}),
      },
      yaxis: {
        gridcolor: "#F1F5F9",
        zerolinecolor: "#E2E8F0",
        tickfont: { color: "#64748B", size: 11 },
        ...(layout?.yaxis || {}),
      },
      ...layout,
    };

    if (layout?.xaxis) {
      mergedLayout.xaxis = {
        gridcolor: "#F1F5F9",
        zerolinecolor: "#E2E8F0",
        tickfont: { color: "#64748B", size: 11 },
        ...layout.xaxis,
      };
    }
    if (layout?.yaxis) {
      mergedLayout.yaxis = {
        gridcolor: "#F1F5F9",
        zerolinecolor: "#E2E8F0",
        tickfont: { color: "#64748B", size: 11 },
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
