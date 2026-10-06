import { apiUser } from "@/lib/auth";
import { finishAttempt, getOwnAttempt } from "@/lib/certs/attempts";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const { id } = await params;
  const attempt = await getOwnAttempt(user.id, id);
  if (!attempt) return Response.json({ error: "Intento no encontrado" }, { status: 404 });
  if (attempt.status === "FINISHED") return Response.json({ finished: true, score: attempt.score });
  const result = await finishAttempt(attempt);
  return Response.json({ finished: true, ...result });
}
