"use client";

import { useState } from "react";
import type { QuizQuestion } from "@/lib/content";

/** Pregunta de opción múltiple; al responder registra el resultado para el repaso espaciado. */
export function QuizCard({
  q,
  index,
  onAnswered,
}: {
  q: QuizQuestion;
  index?: number;
  onAnswered?: (correct: boolean) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked !== null;

  async function pick(i: number) {
    if (answered) return;
    setPicked(i);
    const correct = i === q.answer;
    onAnswered?.(correct);
    await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: q.id, correct }),
    });
  }

  return (
    <div className="card p-4">
      <p className="font-medium">
        {index !== undefined && <span className="text-muted mr-1">{index + 1}.</span>}
        {q.question}
      </p>
      <div className="mt-3 grid gap-2">
        {q.options.map((opt, i) => {
          const state = !answered
            ? "hover:border-accent"
            : i === q.answer
              ? "border-ok bg-ok/10"
              : i === picked
                ? "border-bad bg-bad/10"
                : "opacity-60";
          return (
            <button
              key={i}
              onClick={() => pick(i)}
              disabled={answered}
              className={`text-left rounded-lg border border-border px-3 py-2 text-sm transition-colors cursor-pointer disabled:cursor-default ${state}`}
            >
              <span className="font-mono text-xs text-muted mr-2">{String.fromCharCode(65 + i)}</span>
              {opt}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className={`mt-3 text-sm rounded-lg px-3 py-2 ${picked === q.answer ? "bg-ok/10" : "bg-bad/10"}`}>
          <strong>{picked === q.answer ? "¡Correcto! " : "No exactamente. "}</strong>
          {q.explanation}
        </div>
      )}
    </div>
  );
}
