"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { QuizQuestion } from "@/lib/content";
import { QuizCard } from "@/components/Quiz";

type Props = {
  due: QuizQuestion[];
  lessonQuestions: QuizQuestion[];
  lessons: { slug: string; title: string }[];
  selectedLesson: string | null;
  weak: { question: string; lapses: number; lessonSlug: string }[];
  nextDueAt: string | null;
};

export function ReviewSession({ due, lessonQuestions, lessons, selectedLesson, weak, nextDueAt }: Props) {
  const router = useRouter();
  const queue = selectedLesson ? lessonQuestions : due;
  const [i, setI] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState({ ok: 0, bad: 0 });

  const finished = i >= queue.length;

  return (
    <div className="mt-6 space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">Modo:</span>
        <select
          className="input !w-auto !py-1"
          value={selectedLesson ?? ""}
          onChange={(e) => router.push(e.target.value ? `/review?lesson=${e.target.value}` : "/review")}
        >
          <option value="">Tarjetas pendientes ({due.length})</option>
          {lessons.map((l) => (
            <option key={l.slug} value={l.slug}>Quiz completo: {l.title}</option>
          ))}
        </select>
      </div>

      {queue.length === 0 ? (
        <div className="card p-6 text-center">
          <div className="text-lg font-semibold">¡Nada pendiente por ahora! 🎉</div>
          <p className="text-sm text-muted mt-1">
            {nextDueAt
              ? `Tu próxima tarjeta vence el ${new Date(nextDueAt).toLocaleString("es")}.`
              : "Responde los quizzes de las lecciones para crear tarjetas de repaso."}
          </p>
          <Link href="/learn" className="btn mt-4">Ir a las lecciones</Link>
        </div>
      ) : finished ? (
        <div className="card p-6 text-center">
          <div className="text-lg font-semibold">Sesión terminada</div>
          <p className="text-sm text-muted mt-1">
            {score.ok} correctas · {score.bad} incorrectas
          </p>
          <button className="btn mt-4" onClick={() => router.refresh()}>Actualizar</button>
        </div>
      ) : (
        <div>
          <div className="flex justify-between text-sm text-muted mb-2">
            <span>Pregunta {i + 1} de {queue.length}</span>
            <span className="text-ok">{score.ok} ✓</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden mb-4">
            <div className="h-full bg-accent transition-all" style={{ width: `${(i / queue.length) * 100}%` }} />
          </div>
          <QuizCard
            key={queue[i].id}
            q={queue[i]}
            onAnswered={(correct) => {
              setAnswered(true);
              setScore((s) => (correct ? { ...s, ok: s.ok + 1 } : { ...s, bad: s.bad + 1 }));
            }}
          />
          {answered && (
            <button
              className="btn-primary mt-4"
              onClick={() => {
                setAnswered(false);
                setI(i + 1);
              }}
            >
              Siguiente →
            </button>
          )}
        </div>
      )}

      {weak.length > 0 && (
        <section>
          <h2 className="font-semibold text-lg">Tus puntos débiles</h2>
          <p className="text-sm text-muted">Preguntas que más has fallado.</p>
          <ul className="card mt-2 divide-y divide-border">
            {weak.map((w, idx) => (
              <li key={idx} className="px-4 py-2.5 flex items-start gap-3 text-sm">
                <span className="text-bad font-mono text-xs mt-0.5">×{w.lapses}</span>
                <Link href={`/learn/${w.lessonSlug}#quiz`} className="flex-1 hover:text-accent">{w.question}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
