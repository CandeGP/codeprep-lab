import { z } from "zod";
import { db } from "@/lib/db";
import { apiUser } from "@/lib/auth";
import { selectCustom, selectDue, selectFull } from "@/lib/certs/select";
import { attemptIds, getOwnAttempt } from "@/lib/certs/attempts";

const base = { courseSlug: z.string().min(1), mode: z.enum(["INSTANT", "END"]), dryRun: z.boolean().optional() };

const schema = z.discriminatedUnion("kind", [
  z.object({
    ...base,
    kind: z.literal("FULL"),
    count: z.number().int().min(5).max(200),
    /** Simulación exacta: tamaño, tiempo y modo del examen real. */
    exact: z.boolean().optional(),
  }),
  z.object({
    ...base,
    kind: z.literal("CUSTOM"),
    count: z.number().int().min(1).max(200),
    topics: z.array(z.string()).max(50).default([]),
    domains: z.array(z.string()).max(20).default([]),
    difficulty: z.number().int().min(1).max(3).optional(),
    pool: z.enum(["all", "unseen", "wrong", "pending"]).default("all"),
    timed: z.boolean().default(false),
  }),
  z.object({
    ...base,
    kind: z.literal("REVIEW"),
    source: z.enum(["due", "wrong", "flagged"]),
    /** Para "wrong"/"flagged": el intento del que salen las preguntas. */
    fromAttemptId: z.string().optional(),
    count: z.number().int().min(1).max(100).default(20),
  }),
]);

/** Crea un intento de examen (o, con dryRun, sólo cuenta cuántas preguntas hay disponibles). */
export async function POST(req: Request) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Datos inválidos" }, { status: 400 });
  const input = parsed.data;
  const course = await db.course.findUnique({ where: { slug: input.courseSlug }, include: { topics: true } });
  if (!course) return Response.json({ error: "Curso no encontrado" }, { status: 404 });

  const secondsPerQuestion = (course.timeLimitMin * 60) / course.examQuestions;
  let ids: string[];
  let available: number;
  let title: string;
  let timeLimitSec: number | null = null;
  let filters: object = {};

  if (input.kind === "FULL" && input.exact) {
    ({ ids, available } = await selectFull(user.id, course.id, course.examQuestions));
    title = `Simulación exacta ${course.code} · ${ids.length} preguntas`;
    timeLimitSec = course.timeLimitMin * 60;
    input.mode = "END";
    filters = { exact: true };
  } else if (input.kind === "FULL") {
    ({ ids, available } = await selectFull(user.id, course.id, input.count));
    title = `Simulacro ${course.code} · ${ids.length} preguntas`;
    timeLimitSec = Math.round(secondsPerQuestion * ids.length);
  } else if (input.kind === "CUSTOM") {
    ({ ids, available } = await selectCustom(user.id, course.id, input));
    const names = course.topics.filter((t) => input.topics.includes(t.slug)).map((t) => t.name);
    const poolLabel = { all: "", unseen: " · no vistas", wrong: " · falladas", pending: " · pendientes" }[input.pool];
    title = `${names.length ? names.slice(0, 4).join(", ") + (names.length > 4 ? "…" : "") : "Todos los temas"}${poolLabel}`;
    if (input.timed) timeLimitSec = Math.round(secondsPerQuestion * ids.length);
    filters = { topics: input.topics, domains: input.domains, difficulty: input.difficulty, pool: input.pool };
  } else if (input.source === "due") {
    ({ ids, available } = await selectDue(user.id, course.id, input.count));
    title = "Repaso espaciado";
  } else {
    const from = input.fromAttemptId ? await getOwnAttempt(user.id, input.fromAttemptId) : null;
    if (!from || from.courseId !== course.id) return Response.json({ error: "Intento no encontrado" }, { status: 404 });
    const answers = await db.attemptAnswer.findMany({ where: { attemptId: from.id } });
    const by = new Map(answers.map((a) => [a.questionId, a]));
    ids = attemptIds(from).filter((id) => (input.source === "wrong" ? !by.get(id)?.correct : by.get(id)?.flagged));
    available = ids.length;
    title = input.source === "wrong" ? "Repaso de falladas" : "Repaso de marcadas";
  }

  if (input.dryRun) return Response.json({ available });
  if (ids.length === 0) {
    return Response.json({ error: "No hay preguntas que cumplan esos filtros.", available }, { status: 409 });
  }

  const attempt = await db.examAttempt.create({
    data: {
      userId: user.id,
      courseId: course.id,
      kind: input.kind,
      mode: input.mode,
      title,
      filters: JSON.stringify(filters),
      questionIds: JSON.stringify(ids),
      timeLimitSec,
    },
  });
  return Response.json({ id: attempt.id, count: ids.length, requested: input.count, available });
}
