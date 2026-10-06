import { apiUser } from "@/lib/auth";
import { db } from "@/lib/db";

/** Reporta una pregunta con error: queda como FLAGGED y deja de salir en exámenes hasta que se revise. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const { id } = await params;
  const q = await db.question.findUnique({ where: { id }, select: { status: true } });
  if (!q) return Response.json({ error: "Pregunta no encontrada" }, { status: 404 });
  await db.question.update({
    where: { id },
    data: { reports: { increment: 1 }, ...(q.status === "ACTIVE" ? { status: "FLAGGED" } : {}) },
  });
  return Response.json({ ok: true });
}
