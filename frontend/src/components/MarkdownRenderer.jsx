import { useState } from "react";
import { Check, Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Componente de bloque de código con encabezado de lenguaje y botón de copiar interactivo.
 */
function CodeBlock({ language, codeText, children }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeText || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignorar sin permisos de portapapeles
    }
  };

  return (
    <div className="my-3 rounded-xl border border-slate-800 bg-slate-950 text-slate-100 overflow-hidden shadow-sm not-prose">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-900 border-b border-slate-800 text-[11px] font-mono text-slate-400">
        <span className="uppercase tracking-wider font-semibold text-slate-300">
          {language || "código"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer text-xs"
          aria-label="Copiar bloque de código"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              <span className="text-emerald-400 font-medium">Copiado</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Copiar</span>
            </>
          )}
        </button>
      </div>
      <div className="p-3.5 overflow-x-auto text-xs font-mono leading-relaxed">
        <code>{children}</code>
      </div>
    </div>
  );
}

/**
 * Renderizador limpio de Markdown para respuestas del Agente IA y Reportes Ejecutivos.
 * Alineado con la tipografía Inter, JetBrains Mono y jerarquía de DataFinance AI.
 */
export default function MarkdownRenderer({ content, className = "" }) {
  if (!content) return null;

  return (
    <div className={`space-y-2.5 text-ink leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="text-sm leading-relaxed text-ink/90">{children}</p>
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
            <ul className="list-disc pl-5 space-y-1.5 text-sm text-ink marker:text-primary/70">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 space-y-1.5 text-sm text-ink marker:font-semibold marker:text-muted-foreground">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-sm leading-relaxed text-ink/90">{children}</li>
          ),
          pre: ({ children }) => <>{children}</>,
          code: ({ className: codeClassName, children }) => {
            const match = /language-(\w+)/.exec(codeClassName || "");
            const isMultiline = String(children).includes("\n") || Boolean(match);

            if (!isMultiline) {
              return (
                <code className="font-mono text-xs bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded border border-slate-200/80 font-medium">
                  {children}
                </code>
              );
            }

            return (
              <CodeBlock
                language={match ? match[1] : ""}
                codeText={String(children).replace(/\n$/, "")}
              >
                {children}
              </CodeBlock>
            );
          },
          table: ({ children }) => (
            <div className="overflow-x-auto my-3 rounded-lg border border-border shadow-xs bg-card">
              <table className="w-full text-left border-collapse text-[13px] tabular-nums">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted text-xs font-semibold text-muted-foreground border-b border-border">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-3.5 py-2.5 whitespace-nowrap font-semibold">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-3.5 py-2 border-t border-border/70 text-ink whitespace-nowrap">
              {children}
            </td>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-slate-50/70 transition-colors">{children}</tr>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-3 border-primary/80 bg-blue-50/40 rounded-r-lg px-3.5 py-1.5 text-sm text-slate-700 my-2.5 italic">
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
