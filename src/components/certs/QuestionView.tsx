"use client";

import { textOf, type ClientQuestion, type Lang, type Reveal } from "@/lib/certs/shared";

const LETTERS = "ABCDEF";

export async function jsonFetch<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.json !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error ?? `Error ${res.status}`), { data, status: res.status });
  return data as T;
}

/**
 * Enunciado + opciones. Sin `reveal` se puede seleccionar; con `reveal` muestra
 * la correcta, lo que eligió el usuario y la explicación por opción.
 */
export function QuestionView({
  q,
  selected,
  reveal,
  onToggle,
  disabled,
  number,
  lang = "en",
  hideStem,
}: {
  q: ClientQuestion;
  selected: number[];
  reveal?: Reveal | null;
  onToggle?: (i: number) => void;
  disabled?: boolean;
  number?: number;
  lang?: Lang;
  hideStem?: boolean;
}) {
  const multi = q.pick > 1;
  const text = textOf(q.text, lang);
  const rtext = reveal ? textOf(reveal.text, lang) : null;
  const pickLabel = lang === "es" ? `Elige ${q.pick}` : `Choose ${q.pick}`;
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className="chip">{q.domain}</span>
        {q.topics.map((t) => (
          <span key={t} className="chip">{t}</span>
        ))}
        {multi && <span className="chip !border-warn !text-warn">{pickLabel}</span>}
      </div>
      {!hideStem && (
        <p className="text-[1.05rem] leading-relaxed whitespace-pre-line">
          {number !== undefined && <span className="text-muted mr-1.5">{number}.</span>}
          {text.stem}
        </p>
      )}
      <div className="mt-4 grid gap-2">
        {text.options.map((opt, i) => {
          const isSel = selected.includes(i);
          const isOk = reveal?.correct.includes(i);
          const cls = reveal
            ? isOk
              ? "border-ok bg-ok/10"
              : isSel
                ? "border-bad bg-bad/10"
                : "opacity-70"
            : isSel
              ? "border-accent bg-accent/10"
              : "hover:border-accent";
          return (
            <button
              key={i}
              type="button"
              onClick={() => onToggle?.(i)}
              disabled={disabled || !!reveal}
              className={`text-left rounded-lg border border-border px-3 py-2.5 text-sm transition-colors flex gap-3 ${cls}`}
            >
              <span
                className={`shrink-0 w-6 h-6 inline-flex items-center justify-center text-xs font-semibold border ${
                  multi ? "rounded" : "rounded-full"
                } ${isSel ? "bg-accent text-accent-fg border-accent" : "border-border"}`}
              >
                {LETTERS[i]}
              </span>
              <span className="flex-1">
                {opt}
                {rtext?.optionNotes[i] && (
                  <span className={`block mt-1 text-xs ${isOk ? "text-ok" : "text-muted"}`}>{rtext.optionNotes[i]}</span>
                )}
              </span>
              {reveal && isOk && <span className="text-ok font-bold">✓</span>}
              {reveal && isSel && !isOk && <span className="text-bad font-bold">✗</span>}
            </button>
          );
        })}
      </div>
      {reveal && rtext && (
        <div className="mt-4 rounded-lg bg-surface-2 border border-border p-3 text-sm leading-relaxed">
          <span className="font-semibold">{lang === "es" ? "Explicación: " : "Explanation: "}</span>
          {rtext.explanation}
          {reveal.sources.length > 0 && (
            <div className="mt-2 pt-2 border-t border-border text-xs">
              <span className="text-muted">{lang === "es" ? "Documentación oficial: " : "Official docs: "}</span>
              {reveal.sources.map((u) => (
                <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="text-accent underline mr-2 break-all">
                  {sourceLabel(u)}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Barra horizontal de porcentaje con color según el umbral de aprobación. */
export function PctBar({ value, pass = 70 }: { value: number; pass?: number }) {
  const color = value >= pass ? "bg-ok" : value >= pass - 15 ? "bg-warn" : "bg-bad";
  return (
    <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
      <div className={`h-full ${color} transition-all`} style={{ width: `${Math.max(2, value)}%` }} />
    </div>
  );
}

/** Etiqueta corta para un enlace de documentación (último segmento legible de la URL). */
function sourceLabel(url: string) {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop() ?? u.hostname;
    return decodeURIComponent(last.replace(/\.html?$/, "")).replace(/[-_]/g, " ");
  } catch {
    return url;
  }
}

/** Selector compacto de idioma de las preguntas. */
export function LangToggle({ lang, onChange, hasEs = true }: { lang: Lang; onChange: (l: Lang) => void; hasEs?: boolean }) {
  return (
    <div className="inline-flex rounded-lg border border-border overflow-hidden text-xs font-semibold" role="group" aria-label="Idioma">
      {(["en", "es"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(l)}
          disabled={l === "es" && !hasEs}
          title={l === "es" && !hasEs ? "Sin traducción al español" : undefined}
          className={`px-2 py-1 ${lang === l ? "bg-accent text-accent-fg" : "hover:bg-surface-2"} disabled:opacity-40`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

/** Guarda la preferencia de idioma del usuario (sin bloquear la interfaz). */
export function saveLang(lang: Lang) {
  fetch("/api/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lang }) }).catch(() => {});
}
