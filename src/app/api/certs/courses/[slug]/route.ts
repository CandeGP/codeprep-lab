import { apiUser } from "@/lib/auth";
import { db } from "@/lib/db";

/** Borra un curso creado con IA (sólo quien lo creó). Los cursos curados no se pueden borrar. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const { slug } = await params;
  const course = await db.course.findUnique({ where: { slug } });
  if (!course) return Response.json({ error: "Curso no encontrado" }, { status: 404 });
  if (course.source !== "AI" || course.createdById !== user.id) {
    return Response.json({ error: "Sólo puedes borrar cursos que tú creaste con IA" }, { status: 403 });
  }
  await db.course.delete({ where: { id: course.id } });
  return Response.json({ ok: true });
}
