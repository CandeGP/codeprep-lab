import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { attemptIds, getOwnAttempt } from "@/lib/certs/attempts";
import { breakdown } from "@/lib/certs/analytics";
import { loadQuestions, toClient, toReveal } from "@/lib/certs/questions";
import { formatDuration, parseJson, pct, scaledScore } from "@/lib/certs/shared";
import { PctBar } from "@/components/certs/QuestionView";
import { StartExamButton } from "@/components/certs/StartExam";
import { ResultsReview, type ReviewItem } from "./ResultsReview";

export default async function ResultsPage({ params }: { params: Promise<{ course: string; attemptId: string }> }) {
  const user = await requireUser();
  const { course: slug, attemptId } = await params;
  const attempt = await getOwnAttempt(user.id, attemptId);
  if (!attempt || attempt.course.slug !== slug) notFound();
  if (attempt.status !== "FINISHED") redirect(`/certs/${slug}/exam/${attemptId}`);

  const ids = attemptIds(attempt);
  const [questions, answers, marks] = await Promise.all([
    loadQuestions(ids),
    db.attemptAnswer.findMany({ where: { attemptId } }),
    db.questionMark.findMany({ where: { userId: user.id, questionId: { in: ids } }, select: { questionId: true } }),
  ]);
  const byQ = new Map(answers.map((a) => [a.questionId, a]));
  const pending = new Set(marks.map((m) => m.questionId));

  const items: ReviewItem[] = questions.map((q, i) => {
    const a = byQ.get(q.id);
    const selected = a ? parseJson<number[]>(a.selected, []) : [];
    return {
      n: i + 1,
      q: toClient(q, user.lang),
      reveal: toReveal(q),
      selected,
      correct: !!a?.correct,
      answered: selected.length > 0,
      flagged: !!a?.flagged,
      pending: pending.has(q.id),
      timeMs: a?.timeMs ?? 0,
    };
  });

  const { byDomain, byTopic } = breakdown(
    questions.map((q) => ({
      correct: !!byQ.get(q.id)?.correct,
      domain: q.domain,
      topics: q.topics.map((t) => t.topic),
    })),
  );

  const pass = attempt.course.passingPct;
  const ok = items.filter((i) => i.correct).length;
  const score = pct(ok, items.length);
  const passed = score >= pass;
  // Los simulacros se califican además en la escala de AWS (100-1000), de forma aproximada.
  const scaled = attempt.kind === "FULL" ? scaledScore(score, pass, attempt.course.passingScore) : null;
  const wrong = items.filter((i) => !i.correct).length;
  const unanswered = items.filter((i) => !i.answered).length;
  const flagged = items.filter((i) => i.flagged).length;
  const duration = attempt.finishedAt ? attempt.finishedAt.getTime() - attempt.startedAt.getTime() : 0;
  const weak = byTopic.filter((t) => t.pct < pass);

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
      <Link href={`/certs/${slug}`} className="text-sm text-muted hover:text-accent">← {attempt.course.code}</Link>
      <h1 className="text-2xl font-bold mt-2">{attempt.title}</h1>
      <p className="text-sm text-muted">
        {attempt.mode === "END" ? "Modo examen" : "Modo práctica"} · {attempt.finishedAt?.toLocaleString("es")} · duración{" "}
        {formatDuration(duration)}
      </p>

      <div className="grid md:grid-cols-3 gap-4 mt-6">
        <div className={`card p-6 text-center ${passed ? "border-ok" : "border-bad"}`}>
          {scaled !== null ? (
            <>
              <div className={`text-5xl font-bold ${passed ? "text-ok" : "text-bad"}`}>{scaled}</div>
              <div className="text-xs text-muted mt-1">
                de 1000 · aprobar {attempt.course.passingScore} · {score}% correctas
              </div>
            </>
          ) : (
            <div className={`text-5xl font-bold ${passed ? "text-ok" : "text-bad"}`}>{score}%</div>
          )}
          <div className="font-semibold mt-1">{passed ? "¡Aprobado! 🎉" : "No aprobado todavía"}</div>
          <div className="text-sm text-muted mt-1">
            {ok} de {items.length} correctas · se necesita ≈ {pass}%
          </div>
          <div className="text-xs text-muted mt-2">
            {unanswered > 0 && <>Sin responder: {unanswered} · </>}
            Promedio por pregunta: {formatDuration(duration / Math.max(1, items.length))}
          </div>
          {scaled !== null && (
            <p className="text-[11px] text-muted mt-2">
              Escala aproximada: AWS no publica su fórmula y en el examen real 15 preguntas no puntúan.
            </p>
          )}
        </div>

        <div className="card p-5 md:col-span-2">
          <div className="text-sm font-semibold">Por dominio</div>
          <ul className="mt-3 space-y-3">
            {byDomain.map((d) => (
              <li key={d.slug}>
                <div className="flex justify-between text-sm">
                  <span>{d.name}</span>
                  <span className="text-muted">
                    {d.pct}% · {d.ok}/{d.total}
                  </span>
                </div>
                <div className="mt-1">
                  <PctBar value={d.pct} pass={pass} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mt-4">
        <div className="card p-5">
          <div className="text-sm font-semibold">Qué estudiar según este examen</div>
          {weak.length === 0 ? (
            <p className="text-sm text-ok mt-2">Superaste el umbral en todos los temas. ¡Sigue así!</p>
          ) : (
            <ul className="mt-2 divide-y divide-border">
              {weak.slice(0, 8).map((t) => (
                <li key={t.slug} className="py-2 flex items-center gap-3 text-sm">
                  <span className="w-12 text-right font-mono text-bad">{t.pct}%</span>
                  <span className="flex-1">
                    {t.name} <span className="text-xs text-muted">({t.ok}/{t.total})</span>
                  </span>
                  <StartExamButton
                    payload={{ courseSlug: slug, kind: "CUSTOM", mode: "INSTANT", count: 10, topics: [t.slug], pool: "all" }}
                  >
                    Practicar 10
                  </StartExamButton>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5">
          <div className="text-sm font-semibold">Siguiente paso</div>
          <p className="text-xs text-muted mt-1">
            Las preguntas que fallaste ya se agregaron a tu repaso espaciado y volverán en los próximos días.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            {wrong > 0 && (
              <StartExamButton
                className="btn-primary"
                payload={{ courseSlug: slug, kind: "REVIEW", mode: "INSTANT", source: "wrong", fromAttemptId: attemptId, count: 100 }}
              >
                Repetir las {wrong} falladas
              </StartExamButton>
            )}
            {flagged > 0 && (
              <StartExamButton
                payload={{ courseSlug: slug, kind: "REVIEW", mode: "INSTANT", source: "flagged", fromAttemptId: attemptId, count: 100 }}
              >
                Repasar las {flagged} marcadas
              </StartExamButton>
            )}
            {weak.length > 1 && (
              <StartExamButton
                payload={{
                  courseSlug: slug,
                  kind: "CUSTOM",
                  mode: "INSTANT",
                  count: 20,
                  topics: weak.slice(0, 6).map((t) => t.slug),
                  pool: "all",
                }}
              >
                20 de mis temas débiles
              </StartExamButton>
            )}
            <Link href={`/certs/${slug}`} className="btn">Volver al curso</Link>
          </div>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-xl font-bold">Revisión pregunta por pregunta</h2>
        <ResultsReview items={items} initialLang={user.lang} />
      </section>
    </div>
  );
}
