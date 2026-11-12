import { useState } from "react";

/**
 * Tooltip accesible y refinado para aclaraciones métricas sin saturar la interfaz.
 */
export default function Tooltip({ text, children, position = "top" }) {
  const [visible, setVisible] = useState(false);

  if (!text) return children;

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      tabIndex={0}
      role="tooltip"
      aria-label={text}
    >
      {children}
      {visible && (
        <span
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-popover w-max max-w-[260px] px-3 py-2 text-xs font-normal text-slate-100 bg-slate-900/95 backdrop-blur-xs rounded-lg shadow-lg border border-slate-700/50 leading-relaxed text-left pointer-events-none animate-in fade-in duration-150"
        >
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
        </span>
      )}
    </span>
  );
}
