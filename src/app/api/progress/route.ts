import { z } from "zod";
import { db } from "@/lib/db";
import { apiUser } from "@/lib/auth";

const schema = z.object({ lessonSlug: z.string().min(1).max(100), completed: z.boolean() });

export async function POST(req: Request) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Datos inválidos" }, { status: 400 });
  const { lessonSlug, completed } = parsed.data;
  if (completed) {
    await db.progress.upsert({
      where: { userId_lessonSlug: { userId: user.id, lessonSlug } },
      create: { userId: user.id, lessonSlug },
      update: {},
    });
  } else {
    await db.progress.deleteMany({ where: { userId: user.id, lessonSlug } });
  }
  return Response.json({ completed });
}
