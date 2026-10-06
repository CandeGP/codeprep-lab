import { z } from "zod";
import { randomBytes } from "node:crypto";
import { apiUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageBank } from "@/lib/certs/permissions";
import { questionInclude, toClient, toReveal } from "@/lib/certs/questions";
import { questionInputSchema, stemHash } from "@/lib/certs/shared";
import { esFields } from "@/lib/certs/questions";

/** Lista paginada del banco de un curso, con filtros. */
export async function GET(req: Request) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const sp = new URL(req.url).searchParams;
  const course = await db.course.findUnique({ where: { slug: sp.get("course") ?? "" } });
  if (!course) return Response.json({ error: "Curso no encontrado" }, { status: 404 });
  const q = sp.get("q")?.trim();
  const topic = sp.get("topic");
  const source = sp.get("source");
  const status = sp.get("status");
  const pendingOnly = sp.get("pending") === "1";
  const offset = Math.max(0, Number(sp.get("offset")) || 0);
  const limit = Math.min(50, Math.max(1, Number(sp.get("limit")) || 20));
  const marks = await db.questionMark.findMany({
    where: { userId: user.id, courseId: course.id },
    select: { questionId: true },
  });
  const pending = new Set(marks.map((m) => m.questionId));
  const where = {
    courseId: course.id,
    ...(q ? { stem: { contains: q } } : {}),
    ...(topic ? { topics: { some: { topic: { slug: topic } } } } : {}),
    ...(source ? { source } : {}),
    ...(status ? { status } : {}),
    ...(pendingOnly ? { id: { in: [...pending] } } : {}),
  };
  const [total, rows] = await Promise.all([
    db.question.count({ where }),
    db.question.findMany({
      where,
      include: questionInclude,
      orderBy: [{ source: "asc" }, { id: "asc" }],
      skip: offset,
      take: limit,
    }),
  ]);
  return Response.json({
    total,
    items: rows.map((r) => ({
      id: r.id,
      q: toClient(r, user.lang),
      reveal: toReveal(r),
      source: r.source,
      status: r.status,
      reports: r.reports,
      difficulty: r.difficulty,
      domainSlug: r.domain.slug,
      topicSlugs: r.topics.map((t) => t.topic.slug),
      pending: pending.has(r.id),
    })),
  });
}

const createSchema = z.object({ courseSlug: z.string().min(1), question: questionInputSchema });

/** Agrega una pregunta escrita a mano. */
export async function POST(req: Request) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  if (!canManageBank(user)) return Response.json({ error: "Sin permiso para editar el banco" }, { status: 403 });
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  }
  const { courseSlug, question: q } = parsed.data;
  const course = await db.course.findUnique({ where: { slug: courseSlug }, include: { domains: true, topics: true } });
  if (!course) return Response.json({ error: "Curso no encontrado" }, { status: 404 });
  const domain = course.domains.find((d) => d.slug === q.domain);
  const topics = course.topics.filter((t) => q.topics.includes(t.slug));
  if (!domain || topics.length === 0) return Response.json({ error: "Dominio o tema inválido" }, { status: 400 });
  const hash = stemHash(q.stem);
  if (await db.question.findUnique({ where: { courseId_stemHash: { courseId: course.id, stemHash: hash } } })) {
    return Response.json({ error: "Ya existe una pregunta con ese enunciado" }, { status: 409 });
  }
  const created = await db.question.create({
    data: {
      id: `${course.slug}-user-${randomBytes(5).toString("hex")}`,
      courseId: course.id,
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
      source: "USER",
      stemHash: hash,
      topics: { create: topics.map((t) => ({ topicId: t.id })) },
    },
  });
  return Response.json({ id: created.id });
}
