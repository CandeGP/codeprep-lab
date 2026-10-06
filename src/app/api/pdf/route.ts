import { db } from "@/lib/db";
import { apiUser } from "@/lib/auth";
import { blobEnabled, deletePdf, servePdf } from "@/lib/pdf-storage";

export const runtime = "nodejs";

// Cada usuario tiene su propia copia; nunca se comparte entre usuarios.
const MAX_BYTES = 200 * 1024 * 1024;

/** Devuelve el PDF del usuario autenticado (admite Range: el visor lo lee por partes). */
export async function GET(req: Request) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  return servePdf(user.id, req.headers.get("range"));
}

/** Sube (o reemplaza) el PDF del usuario a la base de datos. Con Vercel Blob se usa /api/pdf/upload. */
export async function POST(req: Request) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  if (blobEnabled()) return Response.json({ error: "Usa la subida directa (/api/pdf/upload)" }, { status: 400 });
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
      blobUrl: null,
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

/** Elimina el PDF del usuario. */
export async function DELETE() {
  const user = await apiUser();
  if (user instanceof Response) return user;
  await deletePdf(user.id);
  return Response.json({ ok: true });
}
