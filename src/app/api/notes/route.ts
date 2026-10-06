import { z } from "zod";
import { db } from "@/lib/db";
import { apiUser } from "@/lib/auth";

const noteSelect = {
  id: true,
  title: true,
  body: true,
  visibility: true,
  lessonSlug: true,
  pdfPage: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
  user: { select: { username: true } },
} as const;

/**
 * GET /api/notes?scope=mine|shared|all&lessonSlug=...&pdfPage=...
 * Regla de privacidad: las notas PRIVATE solo se devuelven a su autor.
 */
export async function GET(req: Request) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") ?? "all";
  const lessonSlug = url.searchParams.get("lessonSlug") ?? undefined;
  const pdfPageParam = url.searchParams.get("pdfPage");
  const pdfPage = pdfPageParam ? Number(pdfPageParam) : undefined;

  const visibilityFilter =
    scope === "mine"
      ? { userId: user.id }
      : scope === "shared"
        ? { visibility: "SHARED" }
        : { OR: [{ userId: user.id }, { visibility: "SHARED" }] };

  const notes = await db.note.findMany({
    where: { AND: [visibilityFilter, lessonSlug ? { lessonSlug } : {}, pdfPage ? { pdfPage } : {}] },
    select: noteSelect,
    orderBy: { updatedAt: "desc" },
    take: 500,
  });
  return Response.json(notes.map((n) => ({ ...n, mine: n.userId === user.id })));
}

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().max(50_000).default(""),
  visibility: z.enum(["PRIVATE", "SHARED"]).default("PRIVATE"),
  lessonSlug: z.string().max(100).nullish(),
  pdfPage: z.number().int().positive().nullish(),
});

export async function POST(req: Request) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Nota inválida" }, { status: 400 });
  const note = await db.note.create({ data: { ...parsed.data, userId: user.id }, select: noteSelect });
  return Response.json({ ...note, mine: true });
}
