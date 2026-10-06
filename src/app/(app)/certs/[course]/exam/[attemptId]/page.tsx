import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { attemptIds, deadline, getOwnAttempt } from "@/lib/certs/attempts";
import { parseJson, type AnswerState } from "@/lib/certs/shared";
import { ExamRunner } from "./ExamRunner";

export default async function ExamPage({ params }: { params: Promise<{ course: string; attemptId: string }> }) {
  const user = await requireUser();
  const { course, attemptId } = await params;
  const attempt = await getOwnAttempt(user.id, attemptId);
  if (!attempt || attempt.course.slug !== course) notFound();
  if (attempt.status === "FINISHED") redirect(`/certs/${course}/results/${attemptId}`);

  const ids = attemptIds(attempt);
  const [answers, marks] = await Promise.all([
    db.attemptAnswer.findMany({ where: { attemptId } }),
    db.questionMark.findMany({ where: { userId: user.id, questionId: { in: ids } }, select: { questionId: true } }),
  ]);
  const state: Record<string, AnswerState> = {};
  for (const a of answers) {
    const selected = parseJson<number[]>(a.selected, []);
    state[a.questionId] = {
      selected,
      flagged: a.flagged,
      // En modo examen no se revela si fue correcta hasta el final.
      ...(attempt.mode === "INSTANT" && selected.length ? { correct: a.correct } : {}),
    };
  }
  const end = deadline(attempt);

  return (
    <ExamRunner
      attemptId={attemptId}
      courseSlug={course}
      courseCode={attempt.course.code}
      title={attempt.title}
      mode={attempt.mode === "INSTANT" ? "INSTANT" : "END"}
      ids={ids}
      initialAnswers={state}
      initialPending={marks.map((m) => m.questionId)}
      deadline={end?.toISOString() ?? null}
      serverNow={Date.now()}
      lang={user.lang}
      exact={parseJson<{ exact?: boolean }>(attempt.filters, {}).exact === true}
    />
  );
}
