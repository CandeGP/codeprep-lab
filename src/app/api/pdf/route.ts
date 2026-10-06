import fs from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { apiUser } from "@/lib/auth";

export const runtime = "nodejs";

// Cada usuario tiene su propia copia local; nunca se comparte entre usuarios.
const DIR = path.join(process.cwd(), "storage", "pdf");
const MAX_BYTES = 200 * 1024 * 1024;
const fileFor = (userId: string) => path.join(DIR, `${userId}.pdf`);

/** Devuelve el PDF del usuario autenticado. */
export async function GET() {
  const user = await apiUser();
  if (user instanceof Response) return user;
  try {
    const data = await fs.readFile(fileFor(user.id));
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": "application/pdf", "Cache-Control": "private, no-store" },
    });
  } catch {
    return Response.json({ error: "No has cargado un PDF" }, { status: 404 });
  }
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
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(fileFor(user.id), bytes);
  await db.pdfFile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, filename: file.name.slice(0, 255), size: file.size },
    update: { filename: file.name.slice(0, 255), size: file.size, uploadedAt: new Date(), lastPage: 1 },
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

/** Elimina la copia local del PDF. */
export async function DELETE() {
  const user = await apiUser();
  if (user instanceof Response) return user;
  await fs.rm(fileFor(user.id), { force: true });
  await db.pdfFile.deleteMany({ where: { userId: user.id } });
  return Response.json({ ok: true });
}
