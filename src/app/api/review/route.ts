import { z } from "zod";
import { db } from "@/lib/db";
import { apiUser } from "@/lib/auth";
import { getAllQuestions } from "@/lib/content";
import { schedule } from "@/lib/srs";

const schema = z.object({
  questionId: z.string().min(1),
  correct: z.boolean(),
  /** Autoevaluación opcional de 0 a 5; si no viene se deduce de `correct`. */
  quality: z.number().int().min(0).max(5).optional(),
});

/** Registra una respuesta y reprograma la tarjeta. */
export async function POST(req: Request) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Datos inválidos" }, { status: 400 });
  const { questionId, correct } = parsed.data;
  const question = (await getAllQuestions()).find((q) => q.id === questionId);
  if (!question) return Response.json({ error: "Pregunta no encontrada" }, { status: 404 });

  const key = { userId_questionId: { userId: user.id, questionId } };
  const current = (await db.reviewCard.findUnique({ where: key })) ?? {
    ease: 2.5,
    interval: 0,
    repetitions: 0,
    lapses: 0,
  };
  const quality = parsed.data.quality ?? (correct ? 4 : 1);
  const next = schedule(current, quality);
  const lessonSlug = questionId.split(":")[0];
  const card = await db.reviewCard.upsert({
    where: key,
    create: { userId: user.id, questionId, lessonSlug, ...next, lastResult: correct },
    update: { ...next, lastResult: correct },
  });
  return Response.json({ dueAt: card.dueAt, interval: card.interval });
}
