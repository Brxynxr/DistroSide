import { useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Code2,
  Copy,
  Database,
  Search,
  Send,
  Sparkles,
} from "lucide-react";
import MarkdownRenderer from "../components/MarkdownRenderer.jsx";
import SourceBadge from "../components/SourceBadge.jsx";
import AlertBanner from "../components/ui/AlertBanner.jsx";
import Button from "../components/ui/Button.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";

const PREGUNTAS_SUGERIDAS = [
  "¿Cuáles fueron los ingresos y gastos del último mes completo?",
  "¿Cómo cambió la utilidad de junio de 2026 frente a mayo de 2026?",
  "¿Cuál fue la categoría con mayor gasto en 2026?",
  "¿Qué área gastó más durante todo el periodo?",
  "Compara el primer semestre de 2026 con el segundo semestre de 2026",
  "¿Qué anomalías detectó el sistema y por qué fueron señaladas?",
];

/**
 * Vista 2: Agente Analista — Espacio de conversación financiera inteligente con jerarquía ejecutiva.
 */
export default function AnalystView({
  health,
  pregunta,
  mensajes,
  loading,
  error,
  onChangePregunta,
  onEnviarPregunta,
}) {
  const [copiadoId, setCopiadoId] = useState(null);

  const copiar = async (id, texto) => {
    try {
      await navigator.clipboard.writeText(texto || "");
      setCopiadoId(id);
      setTimeout(() => setCopiadoId(null), 1800);
    } catch {
      // Ignorar sin permisos de portapapeles
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. Área de consulta destacada */}
      <section className="bg-card border border-border rounded-xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2 pb-2.5 border-b border-border/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <Sparkles className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink">
                Consulta financiera en lenguaje natural
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Formula preguntas directas en español. El sistema genera consultas SQL seguras de solo
                lectura sobre Snowflake y explica con datos verificados.
              </p>
            </div>
          </div>
          <SourceBadge variant="ai" showIcon>
            {health?.groq_model?.split("/").pop() || "gpt-oss-120b"} · Solo lectura
          </SourceBadge>
        </div>

        {/* Chips de sugerencias discretos */}
        <div className="my-3.5">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Preguntas sugeridas
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PREGUNTAS_SUGERIDAS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onEnviarPregunta(q)}
                disabled={loading}
                className="group inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:text-ink hover:border-slate-300 hover:bg-muted/70 transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
              >
                <span>{q}</span>
                <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-primary" />
              </button>
            ))}
          </div>
        </div>

        {/* Formulario de consulta estilo Input bar avanzado */}
        <form
          className="relative flex items-center gap-2 mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            onEnviarPregunta();
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <label htmlFor="chat-input" className="sr-only">
              Pregunta al analista
            </label>
            <input
              id="chat-input"
              type="text"
              placeholder="Ej: ¿Cuál fue el gasto en marketing en marzo de 2026 y cuánto subió frente a febrero?"
              value={pregunta}
              onChange={(e) => onChangePregunta(e.target.value)}
              disabled={loading}
              className="w-full h-11 pl-10 pr-20 rounded-xl border border-border bg-card text-sm text-ink placeholder:text-slate-400 transition-all hover:border-slate-300 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-muted shadow-xs"
            />
            <span className="hidden sm:inline-block absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
              Enter ↵
            </span>
          </div>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            icon={Send}
            disabled={!pregunta.trim()}
            className="h-11 px-5 rounded-xl shadow-xs"
          >
            {loading ? "Analizando..." : "Preguntar"}
          </Button>
        </form>

        {error && (
          <AlertBanner type="error" title="Error en la consulta" className="mt-3">
            {error}
          </AlertBanner>
        )}
      </section>

      {/* 2. Lista de respuestas con jerarquía ejecutiva */}
      <div className="space-y-4">
        {mensajes.length === 0 && !loading && (
          <EmptyState
            icon={Sparkles}
            title="Aún no has realizado ninguna consulta"
            description="Selecciona una de las preguntas sugeridas arriba o formula tu propia consulta financiera sobre ingresos, costos, utilidades o desviaciones."
          />
        )}

        {mensajes.map((m, idx) => (
          <article
            key={idx}
            className="bg-card border border-border rounded-xl p-5 shadow-xs space-y-4 hover:border-slate-300 transition-colors"
          >
            {/* Encabezado de la respuesta */}
            <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-border/80">
              <div className="min-w-0">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-0.5">
                  Pregunta realizada
                </span>
                <h3 className="text-sm font-bold text-ink leading-snug">{m.question}</h3>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <SourceBadge variant="ai" showIcon>
                  Explicación IA
                </SourceBadge>
                <SourceBadge variant="sql">
                  {m.row_count} {m.row_count === 1 ? "fila" : "filas"}
                </SourceBadge>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={copiadoId === `ans-${idx}` ? Check : Copy}
                  onClick={() => copiar(`ans-${idx}`, m.answer)}
                  className="h-7 px-2 text-xs"
                >
                  {copiadoId === `ans-${idx}` ? "Copiado" : "Copiar"}
                </Button>
              </div>
            </div>

            {/* Resumen ejecutivo redactado por la IA */}
            <div className="bg-slate-50/70 rounded-xl p-4 border border-slate-200/80 border-l-4 border-l-primary">
              <MarkdownRenderer content={m.answer} />
            </div>

            {/* Tabla de resultados SQL (si aplica) */}
            {m.rows && m.rows.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Database className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                  <span className="text-xs font-semibold text-ink">
                    Datos estructurados devueltos por Snowflake
                  </span>
                </div>

                <div className="overflow-x-auto rounded-lg border border-border max-h-64">
                  <table className="w-full text-left border-collapse text-[12px] tabular-nums">
                    <thead className="sticky top-0 bg-muted/95 text-xs font-semibold text-muted-foreground border-b border-border">
                      <tr>
                        {m.columns.map((c) => (
                          <th key={c} className="px-3 py-2 whitespace-nowrap">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-ink">
                      {m.rows.slice(0, 25).map((row, rIdx) => (
                        <tr
                          key={rIdx}
                          className="hover:bg-blue-50/30 transition-colors duration-150"
                        >
                          {m.columns.map((c) => (
                            <td key={c} className="px-3 py-1.5 whitespace-nowrap">
                              {row[c] !== null && row[c] !== undefined
                                ? String(row[c])
                                : "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Consulta SQL trazable colapsable */}
            {m.sql && (
              <details className="group border border-border rounded-lg bg-background/50">
                <summary className="flex items-center justify-between p-3 text-xs font-semibold text-muted-foreground hover:text-ink cursor-pointer select-none">
                  <span className="flex items-center gap-2">
                    <Code2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-primary transition-colors" />
                    <span>Consulta SQL ejecutada (trazabilidad y reproducibilidad)</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        copiar(`sql-${idx}`, m.sql);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-slate-500 hover:text-ink hover:bg-slate-200/60 transition-colors"
                    >
                      {copiadoId === `sql-${idx}` ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-700">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copiar SQL</span>
                        </>
                      )}
                    </button>
                    <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" />
                  </div>
                </summary>
                <div className="p-3 pt-0 border-t border-border">
                  <pre className="font-mono text-xs leading-relaxed bg-slate-900 text-slate-100 p-3.5 rounded-lg overflow-x-auto">
                    <code>{m.sql}</code>
                  </pre>
                </div>
              </details>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
