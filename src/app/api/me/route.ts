import { z } from "zod";
import { apiUser } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({ lang: z.enum(["en", "es"]) });

/** Preferencias del usuario (por ahora, el idioma de las preguntas de certificación). */
export async function PATCH(req: Request) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Datos inválidos" }, { status: 400 });
  await db.user.update({ where: { id: user.id }, data: { lang: parsed.data.lang } });
  return Response.json({ ok: true });
}
