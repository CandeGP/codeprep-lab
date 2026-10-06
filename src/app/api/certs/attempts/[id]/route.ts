import { apiUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOwnAttempt } from "@/lib/certs/attempts";

/** Descarta un intento (en curso o terminado) del historial. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const { id } = await params;
  const attempt = await getOwnAttempt(user.id, id);
  if (!attempt) return Response.json({ error: "Intento no encontrado" }, { status: 404 });
  await db.examAttempt.delete({ where: { id } });
  return Response.json({ ok: true });
}
