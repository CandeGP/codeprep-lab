"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { jsonFetch } from "./QuestionView";

type Progress = { done: number; target: number };

/**
 * Genera preguntas o flashcards con IA pidiendo lotes de hasta 10 al servidor,
 * uno tras otro, mostrando el progreso. Se puede detener entre lotes.
 */
export function useGenerator(courseSlug: string) {
  const router = useRouter();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef(false);

  async function run(opts: { kind: "questions" | "flashcards"; target: number; topics?: string[]; difficulty?: number }) {
    setRunning(true);
    setError(null);
    stopRef.current = false;
    setProgress({ done: 0, target: opts.target });
    let jobId: string | undefined;
    let done = 0;
    let emptyBatches = 0;
    try {
      while (done < opts.target && !stopRef.current) {
        const r = await jsonFetch<{ jobId: string; saved: number; done: number; target: number }>(
          `/api/certs/courses/${courseSlug}/generate`,
          { method: "POST", json: { kind: opts.kind, target: opts.target, topics: opts.topics ?? [], difficulty: opts.difficulty, jobId } },
        );
        jobId = r.jobId;
        done = r.done;
        setProgress({ done: r.done, target: r.target });
        // Si varios lotes seguidos no aportan nada nuevo (todo duplicado), se detiene.
        emptyBatches = r.saved === 0 ? emptyBatches + 1 : 0;
        if (emptyBatches >= 2) {
          setError("La IA ya no encuentra preguntas nuevas para esos temas.");
          break;
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
      router.refresh();
    }
    return done;
  }

  return { run, running, progress, error, stop: () => (stopRef.current = true) };
}

export function GeneratorStatus({ g, label }: { g: ReturnType<typeof useGenerator>; label: string }) {
  if (!g.progress && !g.error) return null;
  const pct = g.progress ? Math.round((g.progress.done / g.progress.target) * 100) : 0;
  return (
    <div className="mt-3 text-sm">
      {g.progress && (
        <>
          <div className="flex justify-between text-xs text-muted mb-1">
            <span>
              {g.running ? `Generando ${label} en lotes de 10…` : `${label[0].toUpperCase()}${label.slice(1)} generadas`}{" "}
              {g.progress.done}/{g.progress.target}
            </span>
            {g.running && (
              <button className="underline" onClick={g.stop}>
                Detener después de este lote
              </button>
            )}
          </div>
          <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
            <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
          </div>
        </>
      )}
      {g.error && <p className="text-bad mt-2">{g.error}</p>}
    </div>
  );
}
