import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  Bot,
  Check,
  ChevronDown,
  Code2,
  Copy,
  CornerDownLeft,
  Database,
  History,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  User,
  X,
} from "lucide-react";
import MarkdownRenderer from "../components/MarkdownRenderer.jsx";
import SourceBadge from "../components/SourceBadge.jsx";
import AlertBanner from "../components/ui/AlertBanner.jsx";
import Badge from "../components/ui/Badge.jsx";
import Button from "../components/ui/Button.jsx";

const PREGUNTAS_SUGERIDAS = [
  {
    icon: "💰",
    title: "Ingresos y Gastos",
    query: "¿Cuáles fueron los ingresos y gastos del último mes completo?",
    desc: "Balance mensual, margen y utilidad en COP.",
  },
  {
    icon: "📈",
    title: "Variación de Utilidad",
    query: "¿Cómo cambió la utilidad del último periodo frente al anterior?",
    desc: "Comparación mes a mes con variación absoluta y porcentual.",
  },
  {
    icon: "🏷️",
    title: "Gastos por Categoría",
    query: "¿Cuál fue la categoría con mayor gasto en 2026?",
    desc: "Proveedores, nómina, arriendo, logística o marketing.",
  },
  {
    icon: "⚠️",
    title: "Detección de Anomalías",
    query: "¿Qué anomalías detectó el sistema y por qué fueron señaladas?",
    desc: "Alertas estadísticas con Z-Score >= 2.5 en Snowflake.",
  },
];

/**
 * Vista de Conversación con el Agente Analista Financiero.
 * Rediseño completo bajo los estándares de UI/UX Pro Max (Minimalismo & Swiss Style).
 */
export default function AnalystView({
  health,
  pregunta,
  mensajes = [],
  loading = false,
  error = "",
  onChangePregunta,
  onEnviarPregunta,
  onLimpiarChat,
}) {
  const [copiadoId, setCopiadoId] = useState(null);
  const [feedbackMap, setFeedbackMap] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState("");

  const chatContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const endOfChatRef = useRef(null);

  // Auto-scroll al final con animación suave cuando cambian los mensajes o el estado de carga
  const scrollToBottom = (smooth = true) => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    }
  };

  useEffect(() => {
    scrollToBottom(true);
  }, [mensajes.length, loading, pendingPrompt]);

  // Si termina de cargar, limpiamos el prompt pendiente
  useEffect(() => {
    if (!loading) {
      setPendingPrompt("");
    }
  }, [loading]);

  // Detección de scroll para mostrar el botón flotante "Bajar al último mensaje"
  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    setShowScrollBottom(distanceToBottom > 140);
  };

  // Auto-expansión vertical del textarea (1 a 5 líneas)
  const adjustTextareaHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const newHeight = Math.min(el.scrollHeight, 140);
    el.style.height = `${Math.max(newHeight, 44)}px`;
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [pregunta]);

  const handleEnviar = (texto) => {
    const q = (texto ?? pregunta).trim();
    if (!q || loading) return;
    setPendingPrompt(q);
    onEnviarPregunta(q);
    if (!texto) {
      onChangePregunta("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "44px";
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleEnviar();
    }
  };

  const copiar = async (id, texto) => {
    try {
      await navigator.clipboard.writeText(texto || "");
      setCopiadoId(id);
      setTimeout(() => setCopiadoId(null), 2000);
    } catch {
      // Ignorar sin permisos de portapapeles
    }
  };

  const toggleFeedback = (idx, tipo) => {
    setFeedbackMap((prev) => ({
      ...prev,
      [idx]: prev[idx] === tipo ? null : tipo,
    }));
  };

  const modelName =
    health?.groq_model?.split("/").pop() || "gpt-oss-120b (Groq)";

  const renderHistoryContent = () => (
    <>
      <div className="p-3.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-primary" aria-hidden="true" />
          <span className="text-xs font-semibold text-ink">Historial de sesión</span>
        </div>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="p-1 rounded-lg text-muted-foreground hover:text-ink hover:bg-slate-200/60 transition-colors cursor-pointer"
          aria-label="Cerrar panel de historial"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {mensajes.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            No hay consultas registradas en esta sesión.
          </div>
        ) : (
          mensajes.map((m, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setSidebarOpen(false);
                const targetEl = document.getElementById(`mensaje-turn-${idx}`);
                if (targetEl) {
                  targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
              className="w-full text-left p-2.5 rounded-xl hover:bg-slate-200/70 transition-colors text-xs text-ink/90 group flex items-start gap-2 cursor-pointer border border-transparent hover:border-slate-200"
            >
              <MessageSquare className="w-3.5 h-3.5 text-slate-400 group-hover:text-primary shrink-0 mt-0.5" />
              <span className="line-clamp-2 leading-relaxed">{m.question}</span>
            </button>
          ))
        )}
      </div>

      {mensajes.length > 0 && onLimpiarChat && (
        <div className="p-3 border-t border-border bg-card">
          <Button
            variant="ghost"
            size="sm"
            icon={Trash2}
            onClick={() => {
              onLimpiarChat();
              setSidebarOpen(false);
            }}
            className="w-full justify-center text-xs text-destructive hover:bg-red-50 hover:text-destructive"
          >
            Limpiar conversación
          </Button>
        </div>
      )}
    </>
  );

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full min-h-0 bg-card rounded-2xl border border-border shadow-xs overflow-hidden relative">
      {/* 1. Panel Lateral Colapsable de Historial de Sesión */}
      {/* En escritorio (md:): panel lateral side-by-side */}
      <aside
        className={`hidden md:flex ${
          sidebarOpen ? "w-72" : "w-0"
        } transition-all duration-200 border-r border-border bg-slate-50/70 flex-col shrink-0 overflow-hidden select-none`}
        aria-label="Historial de consultas de la sesión"
      >
        {renderHistoryContent()}
      </aside>

      {/* En móvil (< md): modal drawer con backdrop para no aplastar el chat */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <aside
            className="relative w-72 max-w-[85vw] h-full bg-card shadow-2xl border-r border-border z-10 flex flex-col"
            aria-label="Historial de consultas móvil"
          >
            {renderHistoryContent()}
          </aside>
        </div>
      )}

      {/* 2. Área Central de Conversación */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        {/* Cabecera del Chat */}
        <header className="px-4 sm:px-6 py-3 border-b border-border/80 bg-card/90 backdrop-blur-md flex items-center justify-between gap-3 shrink-0 z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 p-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-ink hover:bg-muted transition-colors cursor-pointer"
              title={sidebarOpen ? "Ocultar historial" : "Ver historial de consultas"}
              aria-label="Alternar historial"
            >
              {sidebarOpen ? (
                <PanelLeftClose className="w-4 h-4" />
              ) : (
                <PanelLeftOpen className="w-4 h-4" />
              )}
              <span className="hidden sm:inline font-medium">Historial</span>
              {mensajes.length > 0 && (
                <span className="bg-primary/10 text-primary font-bold text-[10px] px-1.5 py-0.2 rounded-full">
                  {mensajes.length}
                </span>
              )}
            </button>

            <div className="h-4 w-px bg-border/80 hidden sm:block" />

            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-primary shrink-0">
                <Sparkles className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-ink truncate leading-tight">
                  Analista Financiero IA
                </h2>
                <p className="text-[11px] text-muted-foreground truncate">
                  Distribuidora del Caribe S.A.S.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <SourceBadge variant="ai" showIcon className="text-[11px]">
              {modelName}
            </SourceBadge>
            <SourceBadge variant="sql" className="hidden sm:inline-flex text-[11px]">
              Snowflake · Solo lectura
            </SourceBadge>

            {mensajes.length > 0 && onLimpiarChat && (
              <button
                type="button"
                onClick={onLimpiarChat}
                className="p-1.5 rounded-lg text-slate-400 hover:text-destructive hover:bg-red-50 transition-colors cursor-pointer"
                title="Reiniciar chat"
                aria-label="Reiniciar chat"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </header>

        {/* Feed de Mensajes con scroll suave */}
        <div
          ref={chatContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6 scroll-smooth"
          role="log"
          aria-live="polite"
        >
          {/* A. ESTADO VACÍO (WELCOME SCREEN) */}
          {mensajes.length === 0 && !loading && !pendingPrompt && (
            <div className="max-w-2xl mx-auto py-6 sm:py-10 text-center space-y-6 animate-in fade-in duration-300">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-primary text-white shadow-md ring-4 ring-blue-50">
                <Sparkles className="w-7 h-7" aria-hidden="true" />
              </div>

              <div className="space-y-2 max-w-lg mx-auto">
                <Badge variant="primary" icon={Database} className="mx-auto">
                  SQL Calcula · La IA Explica
                </Badge>
                <h3 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
                  ¿Qué deseas analizar hoy?
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Formula consultas financieras en lenguaje natural. El sistema genera consultas SQL
                  validadas de solo lectura sobre <strong>Snowflake</strong> y redacta una explicación
                  ejecutiva con datos 100% verificados.
                </p>
              </div>

              {/* Tarjetas de Prompts Sugeridos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-left">
                {PREGUNTAS_SUGERIDAS.map((item, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleEnviar(item.query)}
                    className="group relative p-4 rounded-xl border border-border bg-card hover:bg-slate-50/80 hover:border-primary/40 transition-all duration-200 shadow-xs hover:shadow-sm cursor-pointer text-left flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-base" role="img" aria-label={item.title}>
                          {item.icon}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                      </div>
                      <div className="text-xs font-bold text-ink group-hover:text-primary transition-colors">
                        {item.title}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                        {item.desc}
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-border/60 text-[11px] font-medium text-slate-600 line-clamp-1 italic">
                      &ldquo;{item.query}&rdquo;
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* B. LISTA CRONOLÓGICA DE MENSAJES */}
          <div className="max-w-3xl sm:max-w-4xl mx-auto space-y-6">
            {mensajes.map((m, idx) => (
              <div
                key={idx}
                id={`mensaje-turn-${idx}`}
                className="space-y-4 pt-2 first:pt-0 animate-in fade-in duration-200"
              >
                {/* 1. Mensaje del Usuario (Alineado a la derecha) */}
                <div className="flex justify-end items-start gap-2.5 pl-6 sm:pl-16">
                  <div className="bg-primary text-white rounded-2xl rounded-tr-xs px-4 py-3 shadow-xs max-w-[90%] sm:max-w-[80%] text-sm leading-relaxed">
                    <p className="whitespace-pre-wrap">{m.question}</p>
                  </div>
                  <div
                    className="w-8 h-8 rounded-full bg-blue-700 text-white flex items-center justify-center shrink-0 shadow-xs ring-2 ring-white"
                    title="Tú"
                    aria-label="Tú"
                  >
                    <User className="w-4 h-4" />
                  </div>
                </div>

                {/* 2. Respuesta del Asistente IA (Alineada a la izquierda) */}
                <div className="flex justify-start items-start gap-3 pr-2 sm:pr-8">
                  <div
                    className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0 mt-1 shadow-xs"
                    title="Analista Financiero IA"
                  >
                    <Bot className="w-4 h-4" />
                  </div>

                  <article className="flex-1 min-w-0 bg-card border border-border/90 rounded-2xl rounded-tl-xs p-4 sm:p-5 shadow-xs space-y-4 hover:border-slate-300 transition-colors">
                    {/* Header de la respuesta del asistente */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-border/80">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-ink">
                          Analista Financiero
                        </span>
                        <SourceBadge variant="ai" className="text-[10px]">
                          Explicación IA
                        </SourceBadge>
                        {m.row_count !== undefined && (
                          <SourceBadge variant="sql" className="text-[10px]">
                            {m.row_count} {m.row_count === 1 ? "fila" : "filas"}
                          </SourceBadge>
                        )}
                      </div>

                      {/* Botones de acción rápidos */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => copiar(`ans-${idx}`, m.answer)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-slate-500 hover:text-ink hover:bg-slate-100 transition-colors cursor-pointer"
                          aria-label="Copiar respuesta"
                        >
                          {copiadoId === `ans-${idx}` ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700 font-semibold">Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Copiar</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleEnviar(m.question)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-slate-500 hover:text-ink hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Volver a consultar"
                          aria-label="Regenerar respuesta"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Regenerar</span>
                        </button>
                      </div>
                    </div>

                    {/* Explicación Ejecutiva en Markdown */}
                    <div className="prose-clean">
                      <MarkdownRenderer content={m.answer} />
                    </div>

                    {/* Tabla de Resultados SQL de Snowflake (si aplica) */}
                    {m.rows && m.rows.length > 0 && (
                      <div className="pt-2 border-t border-border/60">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-1.5">
                            <Database className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                            <span className="text-xs font-semibold text-ink">
                              Datos estructurados de Snowflake
                            </span>
                          </div>
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            Mostrando {Math.min(m.rows.length, 25)} de {m.row_count} registros
                          </span>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-border max-h-64 shadow-xs">
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
                            <tbody className="divide-y divide-border text-ink bg-card">
                              {m.rows.slice(0, 25).map((row, rIdx) => (
                                <tr
                                  key={rIdx}
                                  className="hover:bg-blue-50/40 transition-colors"
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

                    {/* Trazabilidad SQL Ejecutada (Colapsable con estilo) */}
                    {m.sql && (
                      <details className="group border border-border rounded-xl bg-slate-50/50 overflow-hidden">
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
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-slate-500 hover:text-ink hover:bg-slate-200/70 transition-colors"
                              aria-label="Copiar consulta SQL"
                            >
                              {copiadoId === `sql-${idx}` ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span className="text-emerald-700 font-semibold">Copiado</span>
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
                          <pre className="font-mono text-xs leading-relaxed bg-slate-950 text-slate-100 p-3.5 rounded-lg overflow-x-auto">
                            <code>{m.sql}</code>
                          </pre>
                        </div>
                      </details>
                    )}

                    {/* Barra de Micro-interacción: Feedback de utilidad */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <span>¿Fue útil esta respuesta?</span>
                        <button
                          type="button"
                          onClick={() => toggleFeedback(idx, "up")}
                          className={`p-1 rounded-md transition-colors cursor-pointer ${
                            feedbackMap[idx] === "up"
                              ? "bg-emerald-50 text-emerald-700 font-semibold"
                              : "hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                          }`}
                          title="Respuesta útil"
                          aria-label="Respuesta útil"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleFeedback(idx, "down")}
                          className={`p-1 rounded-md transition-colors cursor-pointer ${
                            feedbackMap[idx] === "down"
                              ? "bg-red-50 text-red-700 font-semibold"
                              : "hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                          }`}
                          title="Respuesta no útil"
                          aria-label="Respuesta no útil"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </button>
                        {feedbackMap[idx] && (
                          <span className="text-[10px] text-emerald-700 font-medium ml-1">
                            ¡Gracias por tu retroalimentación!
                          </span>
                        )}
                      </div>

                      <span className="text-[10px] font-mono text-slate-400">
                        {m.model || "Groq"}
                      </span>
                    </div>
                  </article>
                </div>
              </div>
            ))}

            {/* C. TURNO EN PROCESO (INDICADOR ANIMADO DE "ESCRIBIENDO...") */}
            {loading && (
              <div className="space-y-4 animate-in fade-in duration-200">
                {/* Pregunta optimista del usuario */}
                {pendingPrompt && (
                  <div className="flex justify-end items-start gap-2.5 pl-6 sm:pl-16">
                    <div className="bg-primary text-white rounded-2xl rounded-tr-xs px-4 py-3 shadow-xs max-w-[90%] sm:max-w-[80%] text-sm leading-relaxed">
                      <p className="whitespace-pre-wrap">{pendingPrompt}</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-blue-700 text-white flex items-center justify-center shrink-0 shadow-xs ring-2 ring-white">
                      <User className="w-4 h-4" />
                    </div>
                  </div>
                )}

                {/* Burbuja animada del Asistente */}
                <div className="flex justify-start items-start gap-3 pr-2 sm:pr-8">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0 shadow-xs">
                    <Bot className="w-4 h-4 animate-pulse" />
                  </div>
                  <div className="bg-card border border-border rounded-2xl rounded-tl-xs p-4 shadow-xs flex items-center gap-3">
                    <div className="flex items-center gap-1.5 py-1">
                      <span className="w-2 h-2 rounded-full bg-primary/80 animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-2 h-2 rounded-full bg-primary/80 animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-2 h-2 rounded-full bg-primary/80 animate-bounce" />
                    </div>
                    <span className="text-xs text-muted-foreground font-medium">
                      Consultando Snowflake mediante SQL de solo lectura y analizando...
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* D. ERROR EN LA CONSULTA */}
            {error && (
              <div className="pt-2">
                <AlertBanner
                  type="error"
                  title="No se pudo completar la consulta"
                  className="rounded-xl shadow-xs"
                >
                  <div className="space-y-2">
                    <p className="text-xs">{error}</p>
                    {pendingPrompt && (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={RotateCcw}
                        onClick={() => handleEnviar(pendingPrompt)}
                        className="text-xs h-7"
                      >
                        Reintentar consulta
                      </Button>
                    )}
                  </div>
                </AlertBanner>
              </div>
            )}

            <div ref={endOfChatRef} />
          </div>
        </div>

        {/* 3. Botón Flotante para bajar al último mensaje */}
        {showScrollBottom && (
          <button
            type="button"
            onClick={() => scrollToBottom(true)}
            className="absolute bottom-24 right-6 sm:right-8 z-20 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 text-white shadow-lg backdrop-blur-sm text-xs font-medium hover:bg-slate-800 transition-all duration-200 cursor-pointer animate-in fade-in slide-in-from-bottom-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Bajar al último mensaje"
          >
            <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Últimos mensajes</span>
          </button>
        )}

        {/* 4. Barra de Entrada (Input Fijo en la parte inferior) */}
        <footer className="sticky bottom-0 z-10 bg-card/90 backdrop-blur-md border-t border-border/80 px-4 py-3 sm:py-3.5 shadow-sm">
          <div className="max-w-3xl sm:max-w-4xl mx-auto space-y-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleEnviar();
              }}
              className="relative flex items-end gap-2 bg-background border border-border rounded-2xl p-1.5 shadow-xs transition-all focus-within:border-primary/80 focus-within:ring-2 focus-within:ring-primary/20"
            >
              <label htmlFor="chat-textarea" className="sr-only">
                Pregunta financiera al analista
              </label>

              <textarea
                id="chat-textarea"
                ref={textareaRef}
                value={pregunta}
                onChange={(e) => onChangePregunta(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                rows={1}
                placeholder="Pregunta sobre ingresos, gastos por categoría o área, márgenes, variaciones o anomalías..."
                className="flex-1 max-h-36 min-h-[44px] py-2.5 px-3 bg-transparent text-sm text-ink placeholder:text-slate-400 focus:outline-none resize-none leading-relaxed disabled:opacity-50"
              />

              {pregunta.trim() && (
                <button
                  type="button"
                  onClick={() => onChangePregunta("")}
                  className="p-2 text-slate-400 hover:text-ink transition-colors cursor-pointer rounded-lg mb-0.5"
                  title="Borrar texto"
                  aria-label="Borrar texto"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={!pregunta.trim() || loading}
                loading={loading}
                icon={Send}
                className="h-10 px-4 rounded-xl shrink-0 mb-0.5 shadow-xs"
                aria-label="Enviar pregunta"
              >
                <span className="hidden sm:inline">Enviar</span>
              </Button>
            </form>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
              <span className="hidden sm:inline-flex items-center gap-1">
                Presiona{" "}
                <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono text-[10px] text-slate-600">
                  Enter ↵
                </kbd>{" "}
                para enviar ·{" "}
                <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono text-[10px] text-slate-600">
                  Shift + Enter
                </kbd>{" "}
                para nueva línea
              </span>
              <span className="ml-auto text-[10px] text-slate-400">
                SQL verificado en Snowflake · Moneda: COP
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
