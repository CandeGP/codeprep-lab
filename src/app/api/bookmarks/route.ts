import { z } from "zod";
import { db } from "@/lib/db";
import { apiUser } from "@/lib/auth";

const schema = z.object({
  type: z.enum(["LESSON", "SECTION", "PROBLEM", "PDF_PAGE"]),
  ref: z.string().min(1).max(300),
  label: z.string().min(1).max(300),
});

export async function GET() {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const bookmarks = await db.bookmark.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  return Response.json(bookmarks);
}

/** Alterna el guardado: si existe lo quita, si no lo crea. */
export async function POST(req: Request) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Datos inválidos" }, { status: 400 });
  const { type, ref, label } = parsed.data;
  const key = { userId_type_ref: { userId: user.id, type, ref } };
  const existing = await db.bookmark.findUnique({ where: key });
  if (existing) {
    await db.bookmark.delete({ where: key });
    return Response.json({ saved: false });
  }
  await db.bookmark.create({ data: { userId: user.id, type, ref, label } });
  return Response.json({ saved: true });
}
