import { z } from "zod";
import { db } from "@/lib/db";
import { apiUser } from "@/lib/auth";

const updateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  body: z.string().max(50_000).optional(),
  visibility: z.enum(["PRIVATE", "SHARED"]).optional(),
});

/** Solo el autor puede editar o borrar su nota. */
async function ownNote(id: string, userId: string) {
  const note = await db.note.findUnique({ where: { id }, select: { userId: true } });
  return note?.userId === userId;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const { id } = await params;
  if (!(await ownNote(id, user.id))) return Response.json({ error: "No encontrada" }, { status: 404 });
  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Datos inválidos" }, { status: 400 });
  const note = await db.note.update({ where: { id }, data: parsed.data });
  return Response.json(note);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const { id } = await params;
  if (!(await ownNote(id, user.id))) return Response.json({ error: "No encontrada" }, { status: 404 });
  await db.note.delete({ where: { id } });
  return Response.json({ ok: true });
}
