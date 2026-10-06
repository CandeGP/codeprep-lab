import { z } from "zod";
import { apiUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { aiAvailable, aiErrorMessage, generateOutline, saveCourse } from "@/lib/certs/generate";

/** Catálogo de cursos con el número de preguntas activas. */
export async function GET() {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const courses = await db.course.findMany({
    orderBy: { title: "asc" },
    include: { _count: { select: { questions: { where: { status: "ACTIVE" } } } } },
  });
  return Response.json(
    courses.map((c) => ({ slug: c.slug, title: c.title, code: c.code, provider: c.provider, questions: c._count.questions })),
  );
}

const schema = z.object({ query: z.string().trim().min(2).max(120) });

/** Crea un curso nuevo a partir de su nombre: la IA arma dominios, pesos y temas. */
export async function POST(req: Request) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  if (!aiAvailable()) {
    return Response.json({ error: "Falta configurar ANTHROPIC_API_KEY en .env para crear cursos con IA." }, { status: 503 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Escribe el nombre del curso o examen" }, { status: 400 });
  try {
    const outline = await generateOutline(parsed.data.query);
    const course = await saveCourse(outline, user.id);
    return Response.json({ slug: course.slug, title: course.title });
  } catch (err) {
    return Response.json({ error: aiErrorMessage(err) }, { status: 502 });
  }
}
