import { z } from "zod";
import { apiUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  MAX_BATCH,
  aiAvailable,
  aiErrorMessage,
  generateFlashcardBatch,
  generateQuestionBatch,
} from "@/lib/certs/generate";

export const runtime = "nodejs";
export const maxDuration = 300;

const schema = z.object({
  kind: z.enum(["questions", "flashcards"]).default("questions"),
  topics: z.array(z.string()).max(50).default([]),
  /** Total que se quiere generar (el cliente pide lote por lote). */
  target: z.number().int().min(1).max(200),
  batch: z.number().int().min(1).max(MAX_BATCH).default(MAX_BATCH),
  difficulty: z.number().int().min(1).max(3).optional(),
  jobId: z.string().optional(),
});

/**
 * Genera UN lote (≤10) y lo guarda. El cliente llama en bucle hasta completar `target`,
 * así ninguna petición es larga y el progreso se ve en pantalla.
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  if (!aiAvailable()) {
    return Response.json({ error: "Falta configurar ANTHROPIC_API_KEY en .env para generar con IA." }, { status: 503 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Datos inválidos" }, { status: 400 });
  const input = parsed.data;
  const { slug } = await params;
  const course = await db.course.findUnique({ where: { slug }, include: { domains: true, topics: true } });
  if (!course) return Response.json({ error: "Curso no encontrado" }, { status: 404 });

  let job = input.jobId ? await db.generationJob.findUnique({ where: { id: input.jobId } }) : null;
  if (job && (job.userId !== user.id || job.courseId !== course.id)) job = null;
  job ??= await db.generationJob.create({
    data: { courseId: course.id, userId: user.id, topics: JSON.stringify(input.topics), target: input.target },
  });

  const count = Math.min(input.batch, Math.max(1, job.target - job.done));
  try {
    const saved =
      input.kind === "questions"
        ? await generateQuestionBatch(course, { topics: input.topics, count, difficulty: input.difficulty })
        : await generateFlashcardBatch(course, input.topics, count);
    const done = job.done + saved;
    job = await db.generationJob.update({
      where: { id: job.id },
      data: { done, status: done >= job.target ? "DONE" : "RUNNING", error: null },
    });
    return Response.json({ jobId: job.id, saved, done: job.done, target: job.target, finished: job.status === "DONE" });
  } catch (err) {
    const message = aiErrorMessage(err);
    await db.generationJob.update({ where: { id: job.id }, data: { status: "ERROR", error: message } });
    return Response.json({ error: message, jobId: job.id, done: job.done, target: job.target }, { status: 502 });
  }
}
