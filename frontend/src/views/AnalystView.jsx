import { Send } from "lucide-react";
import SourceBadge from "../components/SourceBadge.jsx";

const PREGUNTAS_SUGERIDAS = [
  "¿Cuáles fueron los ingresos y gastos del último mes completo?",
  "¿Cómo cambió la utilidad de junio de 2026 frente a mayo de 2026?",
  "¿Cuál fue la categoría con mayor gasto en 2026?",
  "¿Qué área gastó más durante todo el periodo?",
  "Compara el primer semestre de 2026 con el segundo semestre disponible",
  "¿Qué anomalías detectó el sistema y por qué fueron señaladas?",
];

/**
 * Vista 2: Consultas en lenguaje natural con separación Explicación IA / Dato SQL.
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
  return (
    <div className="space-y-4">
      <section className="bg-card border border-border rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="font-sans text-base font-semibold text-foreground">
            Pregúntale al analista financiero
          </h3>
          <SourceBadge variant="ai" showIcon>
            Groq ({health?.groq_model || "openai/gpt-oss-120b"}) · Solo lectura SELECT
          </SourceBadge>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          {PREGUNTAS_SUGERIDAS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onEnviarPregunta(q)}
              disabled={loading}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-left text-xs font-medium text-foreground cursor-pointer transition-colors duration-150 motion-reduce:transition-none hover:border-secondary hover:bg-blue-50/60 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {q}
            </button>
          ))}
        </div>

        <form
          className="flex flex-col sm:flex-row gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onEnviarPregunta();
          }}
        >
          <label htmlFor="chat-question-input" className="sr-only">
            Pregunta financiera en lenguaje natural
          </label>
          <input
            id="chat-question-input"
            type="text"
            placeholder="Ej: ¿Cuál fue el gasto en marketing en marzo de 2026?"
            value={pregunta}
            onChange={(e) => onChangePregunta(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 bg-card px-3 py-2 text-sm text-ink transition-colors duration-150 motion-reduce:transition-none focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary cursor-pointer transition-colors duration-150 motion-reduce:transition-none hover:bg-blue-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" aria-hidden="true" />
            <span>{loading ? "Consultando..." : "Preguntar"}</span>
          </button>
        </form>

        {error && (
          <div
            role="alert"
            className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {error}
          </div>
        )}
      </section>

      <div className="space-y-3">
        {mensajes.length === 0 && (
          <div className="bg-card border border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
            Selecciona una pregunta sugerida o escribe tu consulta. El modelo genera SQL validado de
            solo lectura contra Snowflake y redacta la explicación únicamente con los datos devueltos.
          </div>
        )}

        {mensajes.map((m, idx) => (
          <article key={idx} className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h4 className="font-sans text-sm font-bold text-foreground">{m.question}</h4>
              <div className="flex flex-wrap gap-1.5">
                <SourceBadge variant="ai" showIcon>
                  Explicación IA ({m.model})
                </SourceBadge>
                <SourceBadge variant="sql" showIcon>
                  {m.row_count} filas Snowflake
                </SourceBadge>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/60 p-3 text-sm leading-relaxed text-ink whitespace-pre-line">
              {m.answer}
            </div>

            <details className="group rounded-lg border border-border bg-background p-3">
              <summary className="text-xs font-semibold text-primary cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-ring">
                Ver consulta SQL ejecutada y tabla de resultados (trazabilidad)
              </summary>
              <pre className="mt-2.5 rounded-lg bg-slate-900 p-3 font-mono text-xs leading-relaxed text-slate-100 overflow-x-auto">
                {m.sql}
              </pre>
              {m.rows?.length > 0 && (
                <div className="mt-3 overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-muted text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <tr>
                        {m.columns.map((c) => (
                          <th key={c} className="px-3 py-2 whitespace-nowrap">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-xs font-mono tabular-nums">
                      {m.rows.slice(0, 20).map((row, rIdx) => (
                        <tr
                          key={rIdx}
                          className="hover:bg-muted/50 transition-colors duration-150 motion-reduce:transition-none"
                        >
                          {m.columns.map((c) => (
                            <td key={c} className="px-3 py-1.5 whitespace-nowrap text-ink">
                              {String(row[c] ?? "—")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </details>
          </article>
        ))}
      </div>
    </div>
  );
}
