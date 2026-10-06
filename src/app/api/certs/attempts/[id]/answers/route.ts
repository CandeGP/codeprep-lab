import { z } from "zod";
import { apiUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { attemptIds, deadline, getOwnAttempt, saveAnswer } from "@/lib/certs/attempts";
import { getQuestion, toReveal } from "@/lib/certs/questions";

const schema = z.object({
  questionId: z.string().min(1),
  selected: z.array(z.number().int().min(0).max(10)).max(6).optional(),
  flagged: z.boolean().optional(),
  timeMs: z.number().int().min(0).max(3_600_000).optional(),
});

/** Guarda la respuesta al instante (permite reanudar). En modo INSTANT devuelve la corrección. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const { id } = await params;
  const attempt = await getOwnAttempt(user.id, id);
  if (!attempt) return Response.json({ error: "Intento no encontrado" }, { status: 404 });
  if (attempt.status !== "IN_PROGRESS") return Response.json({ error: "El examen ya terminó" }, { status: 409 });
  const end = deadline(attempt);
  if (end && Date.now() > end.getTime() + 30_000) {
    return Response.json({ error: "Se acabó el tiempo", expired: true }, { status: 409 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Datos inválidos" }, { status: 400 });
  const { questionId, flagged, timeMs } = parsed.data;
  let { selected } = parsed.data;
  if (!attemptIds(attempt).includes(questionId)) {
    return Response.json({ error: "La pregunta no pertenece a este examen" }, { status: 400 });
  }

  // En modo inmediato la primera respuesta es definitiva (ya se mostró la solución).
  if (attempt.mode === "INSTANT" && selected) {
    const prev = await db.attemptAnswer.findUnique({ where: { attemptId_questionId: { attemptId: id, questionId } } });
    if (prev && prev.selected !== "[]") selected = undefined;
  }

  const result = await saveAnswer(id, questionId, { selected, flagged, timeMs });
  if (attempt.mode === "INSTANT" && result.answered) {
    const q = await getQuestion(questionId);
    return Response.json({ correct: result.correct, reveal: q ? toReveal(q) : null });
  }
  return Response.json({ ok: true });
}
