import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { apiUser } from "@/lib/auth";
import { blobEnabled, blobPrefix } from "@/lib/pdf-storage";

export const runtime = "nodejs";

const MAX_BYTES = 200 * 1024 * 1024;

/**
 * Emite el token para que el navegador suba el PDF directo a Vercel Blob (sin pasar por la
 * función, que tiene límite de 4.5 MB). Al terminar, el cliente llama a /api/pdf/commit.
 */
export async function POST(req: Request) {
  if (!blobEnabled()) return Response.json({ error: "Vercel Blob no está configurado" }, { status: 400 });
  const user = await apiUser();
  if (user instanceof Response) return user;
  const body = (await req.json().catch(() => null)) as HandleUploadBody | null;
  if (body?.type !== "blob.generate-client-token") return Response.json({ error: "Petición inválida" }, { status: 400 });
  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(blobPrefix(user.id))) throw new Error("Ruta de subida inválida");
        return { allowedContentTypes: ["application/pdf"], maximumSizeInBytes: MAX_BYTES, addRandomSuffix: true };
      },
    });
    return Response.json(json);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
