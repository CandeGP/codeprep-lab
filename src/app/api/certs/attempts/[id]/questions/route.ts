import { apiUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { attemptIds, getOwnAttempt } from "@/lib/certs/attempts";
import { loadQuestions, toClient, toReveal } from "@/lib/certs/questions";
import type { Reveal } from "@/lib/certs/shared";

/**
 * Preguntas del intento en bloques (?offset=0&limit=10) para no cargar todo el examen de golpe.
 * En modo END las respuestas correctas sólo se envían cuando el intento terminó.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const { id } = await params;
  const attempt = await getOwnAttempt(user.id, id);
  if (!attempt) return Response.json({ error: "Intento no encontrado" }, { status: 404 });

  const url = new URL(req.url);
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  const limit = Math.min(20, Math.max(1, Number(url.searchParams.get("limit")) || 10));
  const slice = attemptIds(attempt).slice(offset, offset + limit);
  const questions = await loadQuestions(slice);

  const finished = attempt.status === "FINISHED";
  const reveals: Record<string, Reveal> = {};
  if (finished || attempt.mode === "INSTANT") {
    const answered = finished
      ? new Set(slice)
      : new Set(
          (
            await db.attemptAnswer.findMany({
              where: { attemptId: id, questionId: { in: slice }, NOT: { selected: "[]" } },
              select: { questionId: true },
            })
          ).map((a) => a.questionId),
        );
    for (const q of questions) if (answered.has(q.id)) reveals[q.id] = toReveal(q);
  }
  return Response.json({ offset, questions: questions.map((q) => toClient(q, user.lang)), reveals });
}
