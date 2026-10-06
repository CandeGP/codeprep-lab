import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { recordLoginEvent } from "@/lib/request-meta";

const schema = z.object({ username: z.string().trim(), password: z.string() });

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Datos inválidos" }, { status: 400 });
  const user = await db.user.findUnique({ where: { username: parsed.data.username } });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return Response.json({ error: "Usuario o contraseña incorrectos" }, { status: 401 });
  }
  await createSession(user.id);
  await recordLoginEvent(user.id, "LOGIN", req);
  return Response.json({ ok: true });
}
