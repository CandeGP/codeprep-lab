import { z } from "zod";
import { apiUser } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  questionId: z.string().min(1),
  note: z.string().trim().max(1000).optional(),
});

/** Marca una pregunta como "pendiente" (para estudiarla después). */
export async function POST(req: Request) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Datos inválidos" }, { status: 400 });
  const { questionId, note } = parsed.data;
  const q = await db.question.findUnique({ where: { id: questionId }, select: { courseId: true } });
  if (!q) return Response.json({ error: "Pregunta no encontrada" }, { status: 404 });
  await db.questionMark.upsert({
    where: { userId_questionId: { userId: user.id, questionId } },
    create: { userId: user.id, questionId, courseId: q.courseId, kind: "PENDING", note: note || null },
    update: note !== undefined ? { note: note || null } : {},
  });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const questionId = new URL(req.url).searchParams.get("questionId");
  if (!questionId) return Response.json({ error: "Falta questionId" }, { status: 400 });
  await db.questionMark.deleteMany({ where: { userId: user.id, questionId } });
  return Response.json({ ok: true });
}
