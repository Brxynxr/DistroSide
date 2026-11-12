import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renderizador limpio de Markdown para respuestas del Agente IA y Reportes Ejecutivos.
 * Alineado con la tipografía Inter y jerarquía de DataFinance AI.
 */
export default function MarkdownRenderer({ content, className = "" }) {
  if (!content) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="text-sm leading-relaxed text-ink">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-ink">{children}</strong>
          ),
          em: ({ children }) => <em className="italic text-muted-foreground">{children}</em>,
          h1: ({ children }) => (
            <h3 className="text-base font-semibold text-ink pt-2">{children}</h3>
          ),
          h2: ({ children }) => (
            <h3 className="text-[15px] font-semibold text-ink pt-2">{children}</h3>
          ),
          h3: ({ children }) => (
            <h4 className="text-sm font-semibold text-ink pt-1.5">{children}</h4>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 space-y-1 text-sm text-ink marker:text-slate-400">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 space-y-1 text-sm text-ink marker:font-medium marker:text-muted-foreground">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-sm leading-relaxed text-ink">{children}</li>
          ),
          code: ({ inline, children }) => {
            if (inline) {
              return (
                <code className="font-mono text-xs bg-muted text-ink px-1.5 py-0.5 rounded">
                  {children}
                </code>
              );
            }
            return (
              <pre className="font-mono text-xs bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto my-2">
                <code>{children}</code>
              </pre>
            );
          },
          table: ({ children }) => (
            <div className="overflow-x-auto my-2 rounded-lg border border-border">
              <table className="w-full text-left border-collapse text-[13px] tabular-nums">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted/80 text-xs font-medium text-muted-foreground border-b border-border">
              {children}
            </thead>
          ),
          th: ({ children }) => <th className="px-3 py-2 whitespace-nowrap">{children}</th>,
          td: ({ children }) => (
            <td className="px-3 py-2 border-t border-border text-ink whitespace-nowrap">
              {children}
            </td>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary pl-3 py-0.5 text-sm text-muted-foreground my-2">
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
