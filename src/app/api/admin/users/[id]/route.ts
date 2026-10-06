import { z } from "zod";
import { db } from "@/lib/db";
import { apiAdmin, isAdmin } from "@/lib/auth";

const schema = z.object({ action: z.enum(["approve", "reject", "delete"]) });

/**
 * Aprueba, rechaza/bloquea o borra una cuenta.
 * - approve: puede iniciar sesión.
 * - reject: no puede iniciar sesión y se cierran sus sesiones (sirve también para bloquear).
 * - delete: borra la cuenta y todos sus datos (sólo cuentas no aprobadas, para liberar el usuario).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await apiAdmin();
  if (admin instanceof Response) return admin;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Acción inválida" }, { status: 400 });
  const { id } = await params;
  const target = await db.user.findUnique({ where: { id }, select: { id: true, username: true, status: true } });
  if (!target) return Response.json({ error: "Usuario no encontrado" }, { status: 404 });
  if (isAdmin(target)) return Response.json({ error: "No se puede modificar a un administrador" }, { status: 400 });

  const { action } = parsed.data;
  if (action === "approve") {
    await db.user.update({ where: { id }, data: { status: "APPROVED" } });
  } else if (action === "reject") {
    await db.$transaction([
      db.user.update({ where: { id }, data: { status: "REJECTED" } }),
      db.session.deleteMany({ where: { userId: id } }),
    ]);
  } else {
    if (target.status === "APPROVED") {
      return Response.json({ error: "Bloquea la cuenta antes de borrarla" }, { status: 400 });
    }
    await db.user.delete({ where: { id } });
  }
  return Response.json({ ok: true });
}
