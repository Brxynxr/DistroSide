import { Inbox } from "lucide-react";
import Button from "./Button.jsx";

/**
 * Estado vacío profesional y orientador cuando no hay registros o filtros sin coincidencia.
 */
export default function EmptyState({
  icon: Icon = Inbox,
  title = "No hay datos para mostrar",
  description = "Prueba modificando el rango de fechas o los filtros seleccionados.",
  actionLabel,
  onAction,
  className = "",
}) {
  return (
    <div
      role="status"
      className={`flex flex-col items-center justify-center p-8 text-center bg-card border border-border rounded-xl ${className}`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
        <Icon className="w-5 h-5" aria-hidden="true" />
      </div>
      <h4 className="font-sans text-sm font-semibold text-ink">{title}</h4>
      <p className="mt-1 text-xs text-muted-foreground max-w-sm">{description}</p>
      {actionLabel && onAction && (
        <Button size="sm" variant="secondary" onClick={onAction} className="mt-4">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
