import { db } from "@/lib/db";
import { apiUser } from "@/lib/auth";

export const runtime = "nodejs";

// Cada usuario tiene su propia copia en la base de datos; nunca se comparte entre usuarios.
const MAX_BYTES = 200 * 1024 * 1024;

/** Devuelve el PDF del usuario autenticado. */
export async function GET() {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const blob = await db.pdfBlob.findUnique({ where: { userId: user.id } });
  if (!blob) return Response.json({ error: "No has cargado un PDF" }, { status: 404 });
  return new Response(new Uint8Array(blob.data), {
    headers: { "Content-Type": "application/pdf", "Cache-Control": "private, no-store" },
  });
}

/** Sube (o reemplaza) el PDF del usuario. */
export async function POST(req: Request) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Falta el archivo" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "El archivo supera 200 MB" }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  // Firma "%PDF"
  if (!(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) {
    return Response.json({ error: "El archivo no es un PDF válido" }, { status: 400 });
  }
  const filename = file.name.slice(0, 255);
  await db.pdfFile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, filename, size: file.size, blob: { create: { data: bytes } } },
    update: {
      filename,
      size: file.size,
      uploadedAt: new Date(),
      lastPage: 1,
      blob: { upsert: { create: { data: bytes }, update: { data: bytes } } },
    },
  });
  return Response.json({ ok: true });
}

/** Guarda la última página leída. */
export async function PATCH(req: Request) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const body = await req.json().catch(() => null);
  const page = Number(body?.lastPage);
  if (!Number.isInteger(page) || page < 1) return Response.json({ error: "Página inválida" }, { status: 400 });
  await db.pdfFile.updateMany({ where: { userId: user.id }, data: { lastPage: page } });
  return Response.json({ ok: true });
}

/** Elimina el PDF del usuario (los bytes se borran en cascada). */
export async function DELETE() {
  const user = await apiUser();
  if (user instanceof Response) return user;
  await db.pdfFile.deleteMany({ where: { userId: user.id } });
  return Response.json({ ok: true });
}
