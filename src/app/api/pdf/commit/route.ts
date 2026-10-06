import { del, head } from "@vercel/blob";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiUser } from "@/lib/auth";
import { blobEnabled, blobPrefix } from "@/lib/pdf-storage";

export const runtime = "nodejs";

const schema = z.object({ url: z.string().url(), filename: z.string().min(1) });

/** Registra el PDF que el navegador acaba de subir a Vercel Blob y borra el anterior. */
export async function POST(req: Request) {
  if (!blobEnabled()) return Response.json({ error: "Vercel Blob no está configurado" }, { status: 400 });
  const user = await apiUser();
  if (user instanceof Response) return user;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Datos inválidos" }, { status: 400 });
  const { url, filename } = parsed.data;

  // head() sólo funciona con blobs de nuestro store; además el archivo debe estar en la carpeta del usuario.
  const info = await head(url).catch(() => null);
  if (!info || !info.pathname.startsWith(blobPrefix(user.id))) {
    return Response.json({ error: "Archivo no encontrado" }, { status: 400 });
  }
  if (info.contentType !== "application/pdf") {
    await del(url).catch(() => {});
    return Response.json({ error: "El archivo no es un PDF" }, { status: 400 });
  }

  const previous = await db.pdfFile.findUnique({ where: { userId: user.id }, select: { blobUrl: true } });
  const data = { filename: filename.slice(0, 255), size: info.size, blobUrl: url, uploadedAt: new Date(), lastPage: 1 };
  await db.$transaction([
    db.pdfFile.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data }),
    db.pdfBlob.deleteMany({ where: { userId: user.id } }),
  ]);
  if (previous?.blobUrl && previous.blobUrl !== url) await del(previous.blobUrl).catch(() => {});
  return Response.json({ ok: true });
}
