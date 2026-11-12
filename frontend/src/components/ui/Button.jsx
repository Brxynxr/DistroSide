import { forwardRef } from "react";
import { Loader2 } from "lucide-react";

const VARIANT_STYLES = {
  primary:
    "bg-primary text-white hover:bg-blue-700 active:bg-blue-800 border border-transparent shadow-xs hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.985]",
  secondary:
    "bg-card text-ink hover:bg-muted/80 active:bg-muted border border-border shadow-xs hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.985]",
  ghost:
    "bg-transparent text-muted-foreground hover:text-ink hover:bg-muted/80 border border-transparent focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.985]",
};

const SIZE_STYLES = {
  sm: "h-8 px-2.5 text-xs gap-1.5 rounded-lg",
  md: "h-9 px-3.5 text-sm gap-2 rounded-lg",
  lg: "h-10 px-4 text-sm gap-2 rounded-lg",
};

/**
 * Botón SaaS unificado con estados hover, active, focus-visible y loading claros.
 */
const Button = forwardRef(function Button(
  {
    variant = "secondary",
    size = "md",
    loading = false,
    disabled = false,
    icon: Icon,
    children,
    className = "",
    type = "button",
    ...props
  },
  ref
) {
  const vStyle = VARIANT_STYLES[variant] || VARIANT_STYLES.secondary;
  const sStyle = SIZE_STYLES[size] || SIZE_STYLES.md;
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center font-medium cursor-pointer transition-colors duration-150 motion-reduce:transition-none select-none disabled:opacity-50 disabled:cursor-not-allowed ${vStyle} ${sStyle} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden="true" />
      ) : Icon ? (
        <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
});

export default Button;
