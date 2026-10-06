"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { jsonFetch } from "./QuestionView";

export type StartPayload = Record<string, unknown> & { courseSlug: string; kind: "FULL" | "CUSTOM" | "REVIEW"; mode: "INSTANT" | "END" };

/** Crea un intento y navega al examen. */
export function useStartExam() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function start(payload: StartPayload) {
    setBusy(true);
    setError(null);
    try {
      const { id } = await jsonFetch<{ id: string }>("/api/certs/attempts", { method: "POST", json: payload });
      router.push(`/certs/${payload.courseSlug}/exam/${id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }
  return { start, busy, error };
}

/** Botón que arranca un examen con una configuración fija (p. ej. "10 preguntas de S3"). */
export function StartExamButton({
  payload,
  children,
  className = "btn",
}: {
  payload: StartPayload;
  children: React.ReactNode;
  className?: string;
}) {
  const { start, busy, error } = useStartExam();
  return (
    <span className="inline-flex flex-col">
      <button className={className} disabled={busy} onClick={() => start(payload)}>
        {busy ? "Preparando…" : children}
      </button>
      {error && <span className="text-xs text-bad mt-1">{error}</span>}
    </span>
  );
}

/** Selector de modo: corrección inmediata o al final. */
export function ModePicker({ value, onChange }: { value: "INSTANT" | "END"; onChange: (m: "INSTANT" | "END") => void }) {
  const opts = [
    { v: "END" as const, label: "Modo examen", hint: "Resultados al terminar" },
    { v: "INSTANT" as const, label: "Modo práctica", hint: "Te dice al momento si acertaste" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={`rounded-lg border px-3 py-2 text-left ${
            value === o.v ? "border-accent bg-accent/10" : "border-border hover:bg-surface-2"
          }`}
        >
          <div className="text-sm font-semibold">{o.label}</div>
          <div className="text-xs text-muted">{o.hint}</div>
        </button>
      ))}
    </div>
  );
}
