import "server-only";
import { del, get } from "@vercel/blob";
import { db } from "@/lib/db";

/**
 * Los PDFs se guardan en Vercel Blob (privado) si hay BLOB_READ_WRITE_TOKEN, o en la tabla
 * PdfBlob si no (desarrollo local y Docker). En Vercel una función no puede recibir ni devolver
 * más de 4.5 MB, así que el navegador sube directo a Blob y lee el PDF por rangos.
 */
export const blobEnabled = () => !!process.env.BLOB_READ_WRITE_TOKEN;

/** Tamaño máximo de un rango servido por /api/pdf (por debajo del límite de 4.5 MB de Vercel). */
export const MAX_RANGE_BYTES = 4 * 1024 * 1024;

/** Carpeta de cada usuario en Blob: sólo se aceptan subidas y lecturas dentro de ella. */
export const blobPrefix = (userId: string) => `pdf/${userId}/`;

type Range = { start: number; end: number }; // ambos inclusive

/** Interpreta "bytes=a-b" / "bytes=a-" / "bytes=-n" contra el tamaño del archivo. */
export function parseRange(header: string | null, size: number): Range | null | "invalid" {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "")) return "invalid";
  let start: number;
  let end: number;
  if (m[1] === "") {
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start > end || start >= size) return "invalid";
  return { start, end };
}

const headers = (extra: Record<string, string>) => ({
  "Content-Type": "application/pdf",
  "Cache-Control": "private, no-store",
  "Accept-Ranges": "bytes",
  "X-Content-Type-Options": "nosniff",
  ...extra,
});

/** Devuelve el PDF del usuario (o un rango) como Response. */
export async function servePdf(userId: string, rangeHeader: string | null): Promise<Response> {
  const file = await db.pdfFile.findUnique({ where: { userId }, select: { size: true, blobUrl: true } });
  if (!file) return Response.json({ error: "No has cargado un PDF" }, { status: 404 });

  const range = parseRange(rangeHeader, file.size);
  if (range === "invalid") {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${file.size}` } });
  }

  if (!file.blobUrl) {
    const blob = await db.pdfBlob.findUnique({ where: { userId } });
    if (!blob) return Response.json({ error: "No has cargado un PDF" }, { status: 404 });
    if (!range) return new Response(new Uint8Array(blob.data), { headers: headers({}) });
    return new Response(new Uint8Array(blob.data.subarray(range.start, range.end + 1)), {
      status: 206,
      headers: headers({ "Content-Range": `bytes ${range.start}-${range.end}/${file.size}` }),
    });
  }

  // En Blob siempre se sirve por rangos acotados para no pasar el límite de respuesta de Vercel.
  const start = range?.start ?? 0;
  const end = Math.min(range?.end ?? file.size - 1, start + MAX_RANGE_BYTES - 1);
  const result = await get(file.blobUrl, { access: "private", headers: { Range: `bytes=${start}-${end}` } });
  if (!result || result.statusCode !== 200) return Response.json({ error: "No se encontró el PDF" }, { status: 404 });
  const body = result.headers.get("content-range") ? result.stream : sliceStream(result.stream, start, end);
  return new Response(body, {
    status: 206,
    headers: headers({ "Content-Range": `bytes ${start}-${end}/${file.size}`, "Content-Length": String(end - start + 1) }),
  });
}

/** Por si el almacenamiento ignora el Range: recorta el stream completo a [start, end]. */
function sliceStream(stream: ReadableStream<Uint8Array>, start: number, end: number) {
  let offset = 0;
  const reader = stream.getReader();
  return new ReadableStream<Uint8Array>({
    // Lee hasta encolar algo: si pull vuelve sin encolar, el stream no lo vuelve a llamar.
    async pull(controller) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return controller.close();
        const from = Math.max(start - offset, 0);
        const to = Math.min(end + 1 - offset, value.length);
        offset += value.length;
        if (to > from) controller.enqueue(value.subarray(from, to));
        if (offset > end) {
          controller.close();
          await reader.cancel();
          return;
        }
        if (to > from) return;
      }
    },
    cancel: () => reader.cancel(),
  });
}

/** Borra el PDF del usuario (fila, bytes en la base y archivo en Blob). */
export async function deletePdf(userId: string) {
  const file = await db.pdfFile.findUnique({ where: { userId }, select: { blobUrl: true } });
  if (file?.blobUrl) await del(file.blobUrl).catch(() => {});
  await db.pdfFile.deleteMany({ where: { userId } });
}
