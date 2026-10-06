"use client";

import { useEffect, useRef, useState } from "react";
import { Markdown } from "./Markdown";

type Msg = { role: "user" | "assistant"; content: string };

type Props = {
  lessonSlug?: string;
  /** Fragmento sobre el que el usuario quiere preguntar (se adjunta a la siguiente pregunta). */
  focus?: string | null;
  onClearFocus?: () => void;
  suggestions?: string[];
  tall?: boolean;
};

export function ChatPanel({ lessonSlug, focus, onClearFocus, suggestions = [], tall }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const qs = lessonSlug ? `?lessonSlug=${encodeURIComponent(lessonSlug)}` : "";
    fetch(`/api/ask${qs}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setMessages)
      .catch(() => {});
  }, [lessonSlug]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    const history: Msg[] = [...messages, { role: "user", content: question }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Se envían los últimos 20 mensajes para mantener el contexto acotado.
        body: JSON.stringify({ lessonSlug: lessonSlug ?? null, focus: focus ?? null, messages: history.slice(-20) }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Error" }));
        setMessages([...history, { role: "assistant", content: `**Error:** ${err.error}` }]);
        return;
      }
      onClearFocus?.();
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages([...history, { role: "assistant", content: acc }]);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setMessages([...history, { role: "assistant", content: "**Error:** no se pudo conectar." }]);
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  async function clear() {
    if (!confirm("¿Borrar el historial de esta conversación?")) return;
    const qs = lessonSlug ? `?lessonSlug=${encodeURIComponent(lessonSlug)}` : "";
    await fetch(`/api/ask${qs}`, { method: "DELETE" });
    setMessages([]);
  }

  return (
    <div className={`flex flex-col ${tall ? "h-[calc(100vh-9rem)]" : "h-[32rem]"}`}>
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.length === 0 && (
          <div className="text-sm text-muted space-y-3">
            <p>Pregunta lo que quieras{lessonSlug ? " sobre esta lección" : ""}. El tutor te dará pistas antes que soluciones completas.</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button key={s} className="btn !text-xs" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-2xl rounded-br-sm bg-accent text-accent-fg px-3.5 py-2 text-sm whitespace-pre-wrap"
                  : "card px-3.5 py-2 min-w-0"
              }
            >
              {m.role === "assistant" ? (
                m.content ? <Markdown compact>{m.content}</Markdown> : <span className="text-sm text-muted">Pensando…</span>
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {focus && (
        <div className="mt-2 flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs">
          <span className="text-muted shrink-0">Sobre:</span>
          <span className="line-clamp-2 flex-1">{focus}</span>
          <button className="text-muted cursor-pointer" onClick={onClearFocus}>✕</button>
        </div>
      )}
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <textarea
          className="input resize-none h-11 flex-1"
          placeholder="Escribe tu pregunta… (Enter para enviar)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
        />
        {busy ? (
          <button type="button" className="btn" onClick={() => abortRef.current?.abort()}>Detener</button>
        ) : (
          <button className="btn-primary" disabled={!input.trim()}>Enviar</button>
        )}
      </form>
      {messages.length > 0 && !busy && (
        <button className="mt-1 self-start text-xs text-muted hover:text-text cursor-pointer" onClick={clear}>
          Borrar historial
        </button>
      )}
    </div>
  );
}
