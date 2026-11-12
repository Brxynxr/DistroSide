import { Filter, RotateCcw } from "lucide-react";

/**
 * Barra compacta de filtros globales (periodo, categoría, área y mes parcial).
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
    "w-full rounded-lg border border-slate-300 bg-card px-2.5 py-1.5 text-sm text-ink transition-colors duration-150 motion-reduce:transition-none focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer";

  return (
    <section
      className="bg-card border border-border rounded-xl p-3 shadow-sm"
      aria-label="Filtros financieros globales"
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
        <Filter className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
        <span>Filtros del periodo (COP)</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor="filtro-desde" className="text-xs font-semibold text-muted-foreground">
            Mes desde
          </label>
          <select
            id="filtro-desde"
            className={selectClass}
            value={fechaInicio}
            onChange={(e) => onChangeFechaInicio(e.target.value)}
          >
            <option value="">Todos</option>
            {mesesDisponibles.map((m) => (
              <option key={m.ANIO_MES} value={m.ANIO_MES}>
                {m.ANIO_MES} {!m.ES_COMPLETO ? "(parcial)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="filtro-hasta" className="text-xs font-semibold text-muted-foreground">
            Mes hasta
          </label>
          <select
            id="filtro-hasta"
            className={selectClass}
            value={fechaFin}
            onChange={(e) => onChangeFechaFin(e.target.value)}
          >
            <option value="">Todos</option>
            {mesesDisponibles.map((m) => (
              <option key={m.ANIO_MES} value={m.ANIO_MES}>
                {m.ANIO_MES} {!m.ES_COMPLETO ? "(parcial)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="filtro-cat" className="text-xs font-semibold text-muted-foreground">
            Categoría
          </label>
          <select
            id="filtro-cat"
            className={selectClass}
            value={categoria}
            onChange={(e) => onChangeCategoria(e.target.value)}
          >
            <option value="TODAS">Todas</option>
            {categoriasDisponibles.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="filtro-area" className="text-xs font-semibold text-muted-foreground">
            Área
          </label>
          <select
            id="filtro-area"
            className={selectClass}
            value={area}
            onChange={(e) => onChangeArea(e.target.value)}
          >
            <option value="TODAS">Todas</option>
            {areasDisponibles.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <label
          htmlFor="chk-parcial"
          className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-ink cursor-pointer select-none h-[34px]"
        >
          <input
            id="chk-parcial"
            type="checkbox"
            checked={incluirParcial}
            onChange={(e) => onChangeIncluirParcial(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
          />
          <span className="truncate">Incluir mes parcial</span>
        </label>

        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground cursor-pointer transition-colors duration-150 motion-reduce:transition-none hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring h-[34px]"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Limpiar filtros</span>
        </button>
      </div>
    </section>
  );
}
