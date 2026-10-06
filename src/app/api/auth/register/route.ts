import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, hashPassword, initialStatus } from "@/lib/auth";
import { recordLoginEvent } from "@/lib/request-meta";

const schema = z.object({
  username: z.string().trim().min(3).max(32).regex(/^[\w.-]+$/),
  password: z.string().min(6).max(128),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "Usuario de 3 a 32 caracteres (letras, números, . - _) y contraseña de mínimo 6" },
      { status: 400 },
    );
  }
  const { username, password } = parsed.data;
  const existing = await db.user.findUnique({ where: { username } });
  if (existing) return Response.json({ error: "Ese usuario ya existe" }, { status: 409 });
  const status = initialStatus(username);
  const user = await db.user.create({ data: { username, passwordHash: await hashPassword(password), status } });
  await recordLoginEvent(user.id, "REGISTER", req);
  // Las cuentas nuevas esperan a que el admin las apruebe en Configuración.
  if (status !== "APPROVED") return Response.json({ pending: true });
  await createSession(user.id);
  return Response.json({ ok: true });
}
