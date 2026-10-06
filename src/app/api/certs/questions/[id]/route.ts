import { z } from "zod";
import { apiUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageBank } from "@/lib/certs/permissions";
import { questionInputSchema, stemHash } from "@/lib/certs/shared";
import { esFields } from "@/lib/certs/questions";

const schema = z.object({
  status: z.enum(["ACTIVE", "FLAGGED", "HIDDEN"]).optional(),
  question: questionInputSchema.optional(),
});

/** Edita el contenido o el estado (activa / reportada / oculta) de una pregunta. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  if (!canManageBank(user)) return Response.json({ error: "Sin permiso para editar el banco" }, { status: 403 });
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  }
  const current = await db.question.findUnique({
    where: { id },
    include: { course: { include: { domains: true, topics: true } } },
  });
  if (!current) return Response.json({ error: "Pregunta no encontrada" }, { status: 404 });
  const { status, question: q } = parsed.data;

  if (q) {
    const domain = current.course.domains.find((d) => d.slug === q.domain);
    const topics = current.course.topics.filter((t) => q.topics.includes(t.slug));
    if (!domain || topics.length === 0) return Response.json({ error: "Dominio o tema inválido" }, { status: 400 });
    const hash = stemHash(q.stem);
    const clash = await db.question.findUnique({
      where: { courseId_stemHash: { courseId: current.courseId, stemHash: hash } },
    });
    if (clash && clash.id !== id) return Response.json({ error: "Ya existe una pregunta con ese enunciado" }, { status: 409 });
    await db.$transaction([
      db.question.update({
        where: { id },
        data: {
          domainId: domain.id,
          type: q.correct.length > 1 ? "MULTI" : "SINGLE",
          stem: q.stem,
          options: JSON.stringify(q.options),
          correct: JSON.stringify(q.correct),
          explanation: q.explanation,
          optionNotes: JSON.stringify(q.notes ?? []),
          ...esFields(q),
          sources: JSON.stringify(q.sources),
          difficulty: q.difficulty,
          stemHash: hash,
        },
      }),
      db.questionTopic.deleteMany({ where: { questionId: id } }),
      db.questionTopic.createMany({ data: topics.map((t) => ({ questionId: id, topicId: t.id })) }),
    ]);
  }
  if (status) {
    await db.question.update({ where: { id }, data: { status, ...(status === "ACTIVE" ? { reports: 0 } : {}) } });
  }
  return Response.json({ ok: true });
}

/** Borra una pregunta generada o escrita a mano (las curadas se ocultan, porque el seed las restauraría). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  if (!canManageBank(user)) return Response.json({ error: "Sin permiso para editar el banco" }, { status: 403 });
  const { id } = await params;
  const q = await db.question.findUnique({ where: { id }, select: { source: true } });
  if (!q) return Response.json({ error: "Pregunta no encontrada" }, { status: 404 });
  if (q.source === "CURATED") {
    await db.question.update({ where: { id }, data: { status: "HIDDEN" } });
    return Response.json({ ok: true, hidden: true });
  }
  await db.$transaction([
    db.questionMark.deleteMany({ where: { questionId: id } }),
    db.studyCard.deleteMany({ where: { itemType: "QUESTION", itemId: id } }),
    db.question.delete({ where: { id } }),
  ]);
  return Response.json({ ok: true });
}
