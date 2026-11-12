import { Building2, Calendar, Filter, RotateCcw, Tag } from "lucide-react";
import Button from "./ui/Button.jsx";

/**
 * Barra compacta, elegante y uniforme de filtros financieros globales.
 */
export default function GlobalFilters({
  fechaInicio,
  fechaFin,
  categoria,
  area,
  incluirParcial,
  mesesDisponibles,
  categoriasDisponibles,
  areasDisponibles,
  onChangeFechaInicio,
  onChangeFechaFin,
  onChangeCategoria,
  onChangeArea,
  onChangeIncluirParcial,
  onReset,
}) {
  const selectClass =
    "h-9 w-full rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-ink transition-all duration-150 motion-reduce:transition-none hover:border-slate-300 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 cursor-pointer shadow-xs";

  const hasActiveFilters =
    Boolean(fechaInicio) ||
    Boolean(fechaFin) ||
    categoria !== "TODAS" ||
    area !== "TODAS" ||
    incluirParcial;

  const countActive = [
    Boolean(fechaInicio),
    Boolean(fechaFin),
    categoria !== "TODAS",
    area !== "TODAS",
    incluirParcial,
  ].filter(Boolean).length;

  return (
    <section
      className="bg-card border border-border rounded-xl p-3.5 sm:p-4 shadow-xs"
      aria-label="Filtros financieros globales"
    >
      <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-border/70">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
          <span className="text-xs font-semibold text-ink uppercase tracking-wider">
            Filtros del periodo
          </span>
          {hasActiveFilters && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-primary border border-blue-200">
              {countActive} {countActive === 1 ? "activo" : "activos"}
            </span>
          )}
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-ink cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Restablecer</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
        <div className="lg:col-span-2 flex flex-col gap-1">
          <label htmlFor="filtro-desde" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Calendar className="w-3 h-3 text-slate-400" />
            <span>Mes desde</span>
          </label>
          <select
            id="filtro-desde"
            className={selectClass}
            value={fechaInicio}
            onChange={(e) => onChangeFechaInicio(e.target.value)}
          >
            <option value="">Todos los meses</option>
            {mesesDisponibles.map((m) => (
              <option key={m.ANIO_MES} value={m.ANIO_MES}>
                {m.ANIO_MES} {!m.ES_COMPLETO ? "(parcial)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2 flex flex-col gap-1">
          <label htmlFor="filtro-hasta" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Calendar className="w-3 h-3 text-slate-400" />
            <span>Mes hasta</span>
          </label>
          <select
            id="filtro-hasta"
            className={selectClass}
            value={fechaFin}
            onChange={(e) => onChangeFechaFin(e.target.value)}
          >
            <option value="">Todos los meses</option>
            {mesesDisponibles.map((m) => (
              <option key={m.ANIO_MES} value={m.ANIO_MES}>
                {m.ANIO_MES} {!m.ES_COMPLETO ? "(parcial)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2 flex flex-col gap-1">
          <label htmlFor="filtro-cat" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Tag className="w-3 h-3 text-slate-400" />
            <span>Categoría</span>
          </label>
          <select
            id="filtro-cat"
            className={selectClass}
            value={categoria}
            onChange={(e) => onChangeCategoria(e.target.value)}
          >
            <option value="TODAS">Todas las categorías</option>
            {categoriasDisponibles.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2 flex flex-col gap-1">
          <label htmlFor="filtro-area" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Building2 className="w-3 h-3 text-slate-400" />
            <span>Área</span>
          </label>
          <select
            id="filtro-area"
            className={selectClass}
            value={area}
            onChange={(e) => onChangeArea(e.target.value)}
          >
            <option value="TODAS">Todas las áreas</option>
            {areasDisponibles.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2">
          <label
            htmlFor="chk-parcial"
            className="h-9 flex items-center justify-between rounded-lg border border-border bg-background px-3 text-xs font-medium text-ink cursor-pointer select-none hover:bg-muted/50 transition-colors shadow-xs"
          >
            <span className="truncate">Meses parciales</span>
            <input
              id="chk-parcial"
              type="checkbox"
              checked={incluirParcial}
              onChange={(e) => onChangeIncluirParcial(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-primary accent-primary cursor-pointer focus:ring-primary/20"
            />
          </label>
        </div>

        <div className="lg:col-span-2 flex justify-end">
          <Button
            variant={hasActiveFilters ? "secondary" : "ghost"}
            size="md"
            icon={RotateCcw}
            onClick={onReset}
            disabled={!hasActiveFilters}
            className="w-full text-xs"
          >
            Limpiar filtros
          </Button>
        </div>
      </div>
    </section>
  );
}
