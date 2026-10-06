import { z } from "zod";
import { apiUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { schedule } from "@/lib/srs";

const schema = z.object({
  itemType: z.enum(["FLASHCARD", "QUESTION"]),
  itemId: z.string().min(1),
  /** 1 = otra vez, 3 = difícil, 4 = bien, 5 = fácil */
  quality: z.number().int().min(0).max(5),
});

/** Califica una tarjeta y la reprograma con SM-2. */
export async function POST(req: Request) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Datos inválidos" }, { status: 400 });
  const { itemType, itemId, quality } = parsed.data;
  const item =
    itemType === "FLASHCARD"
      ? await db.flashcard.findUnique({ where: { id: itemId }, select: { courseId: true } })
      : await db.question.findUnique({ where: { id: itemId }, select: { courseId: true } });
  if (!item) return Response.json({ error: "No encontrada" }, { status: 404 });

  const key = { userId_itemType_itemId: { userId: user.id, itemType, itemId } };
  const current = (await db.studyCard.findUnique({ where: key })) ?? { ease: 2.5, interval: 0, repetitions: 0, lapses: 0 };
  const next = schedule(current, quality);
  const card = await db.studyCard.upsert({
    where: key,
    create: { userId: user.id, itemType, itemId, courseId: item.courseId, ...next, lastResult: quality >= 3 },
    update: { ...next, lastResult: quality >= 3 },
  });
  return Response.json({ dueAt: card.dueAt, interval: card.interval });
}
