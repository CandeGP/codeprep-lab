import { z } from "zod";
import { db } from "@/lib/db";
import { apiUser } from "@/lib/auth";

const schema = z.object({
  problemId: z.string().min(1).max(100),
  language: z.enum(["javascript", "python"]),
  code: z.string().max(100_000),
  passed: z.boolean(),
});

export async function POST(req: Request) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Datos inválidos" }, { status: 400 });
  const sub = await db.submission.create({ data: { ...parsed.data, userId: user.id } });
  return Response.json({ id: sub.id });
}
