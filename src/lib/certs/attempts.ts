import "server-only";
import { db } from "@/lib/db";
import { schedule } from "@/lib/srs";
import { parseJson, sameSet } from "./shared";
import { correctOf, getQuestion } from "./questions";

export async function getOwnAttempt(userId: string, id: string) {
  const attempt = await db.examAttempt.findUnique({ where: { id }, include: { course: true } });
  if (!attempt || attempt.userId !== userId) return null;
  return attempt;
}

export function attemptIds(a: { questionIds: string }) {
  return parseJson<string[]>(a.questionIds, []);
}

/** Momento límite del intento (null si no tiene tiempo). */
export function deadline(a: { startedAt: Date; timeLimitSec: number | null }) {
  return a.timeLimitSec ? new Date(a.startedAt.getTime() + a.timeLimitSec * 1000) : null;
}

/** Guarda (o actualiza) la respuesta de una pregunta y devuelve si fue correcta. */
export async function saveAnswer(
  attemptId: string,
  questionId: string,
  data: { selected?: number[]; flagged?: boolean; timeMs?: number },
) {
  const key = { attemptId_questionId: { attemptId, questionId } };
  const prev = await db.attemptAnswer.findUnique({ where: key });
  let correct = prev?.correct ?? false;
  let selected = prev ? parseJson<number[]>(prev.selected, []) : [];
  if (data.selected) {
    const q = await getQuestion(questionId);
    if (!q) throw new Error("Pregunta no encontrada");
    selected = data.selected;
    correct = selected.length > 0 && sameSet(selected, correctOf(q));
  }
  const row = await db.attemptAnswer.upsert({
    where: key,
    create: {
      attemptId,
      questionId,
      selected: JSON.stringify(selected),
      correct,
      flagged: data.flagged ?? false,
      timeMs: data.timeMs ?? 0,
    },
    update: {
      ...(data.selected ? { selected: JSON.stringify(selected), correct, answeredAt: new Date() } : {}),
      ...(data.flagged !== undefined ? { flagged: data.flagged } : {}),
      ...(data.timeMs ? { timeMs: (prev?.timeMs ?? 0) + data.timeMs } : {}),
    },
  });
  return { correct: row.correct, answered: selected.length > 0 };
}

/**
 * Cierra el intento: calcula el puntaje y alimenta la repetición espaciada.
 * Las falladas (o sin responder) entran/vuelven al repaso; las acertadas sólo
 * reprograman tarjetas que ya existían.
 */
export async function finishAttempt(attempt: { id: string; userId: string; courseId: string; questionIds: string }) {
  const ids = attemptIds(attempt);
  const answers = await db.attemptAnswer.findMany({ where: { attemptId: attempt.id } });
  const byQ = new Map(answers.map((a) => [a.questionId, a]));
  const ok = ids.filter((id) => byQ.get(id)?.correct).length;
  const score = ids.length ? ok / ids.length : 0;

  const cards = await db.studyCard.findMany({
    where: { userId: attempt.userId, itemType: "QUESTION", itemId: { in: ids } },
  });
  const cardBy = new Map(cards.map((c) => [c.itemId, c]));
  const now = new Date();
  const ops = [];
  for (const id of ids) {
    const correct = byQ.get(id)?.correct ?? false;
    const card = cardBy.get(id);
    if (correct && !card) continue;
    const next = schedule(card ?? { ease: 2.5, interval: 0, repetitions: 0, lapses: 0 }, correct ? 4 : 1, now);
    ops.push(
      db.studyCard.upsert({
        where: { userId_itemType_itemId: { userId: attempt.userId, itemType: "QUESTION", itemId: id } },
        create: { userId: attempt.userId, itemType: "QUESTION", itemId: id, courseId: attempt.courseId, ...next, lastResult: correct },
        update: { ...next, lastResult: correct },
      }),
    );
  }
  ops.push(
    db.examAttempt.update({
      where: { id: attempt.id },
      data: { status: "FINISHED", finishedAt: now, score },
    }),
  );
  await db.$transaction(ops);
  return { score, ok, total: ids.length };
}
