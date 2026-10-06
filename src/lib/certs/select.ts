import "server-only";
import { db } from "@/lib/db";

export type Pool = "all" | "unseen" | "wrong" | "pending";

export type CustomFilters = {
  topics: string[];
  domains: string[];
  difficulty?: number;
  pool: Pool;
  count: number;
};

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Última vez que el usuario respondió cada pregunta del curso (y si alguna vez la falló). */
async function history(userId: string, courseId: string) {
  const rows = await db.attemptAnswer.findMany({
    where: { attempt: { userId, courseId }, NOT: { selected: "[]" } },
    select: { questionId: true, correct: true, answeredAt: true },
  });
  const map = new Map<string, { lastAt: number; wrong: boolean }>();
  for (const r of rows) {
    const prev = map.get(r.questionId);
    map.set(r.questionId, {
      lastAt: Math.max(prev?.lastAt ?? 0, r.answeredAt.getTime()),
      wrong: (prev?.wrong ?? false) || !r.correct,
    });
  }
  return map;
}

/** Ordena: primero las nunca vistas (al azar), luego las vistas hace más tiempo. */
function prioritize(ids: string[], seen: Map<string, { lastAt: number }>) {
  return shuffle(ids).sort((a, b) => (seen.get(a)?.lastAt ?? 0) - (seen.get(b)?.lastAt ?? 0));
}

/** Reparte `total` según los pesos (método del mayor residuo). */
export function allocate(weights: number[], total: number) {
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((w) => (w / sum) * total);
  const out = raw.map(Math.floor);
  let rest = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (rest-- <= 0) break;
    out[i]++;
  }
  return out;
}

/** Simulacro completo: preguntas repartidas según el peso de cada dominio del examen real. */
export async function selectFull(userId: string, courseId: string, count: number) {
  const [domains, questions, seen] = await Promise.all([
    db.domain.findMany({ where: { courseId }, orderBy: { order: "asc" } }),
    db.question.findMany({ where: { courseId, status: "ACTIVE" }, select: { id: true, domainId: true } }),
    history(userId, courseId),
  ]);
  const quotas = allocate(
    domains.map((d) => d.weight),
    Math.min(count, questions.length),
  );
  const picked: string[] = [];
  const leftovers: string[] = [];
  domains.forEach((d, i) => {
    const pool = prioritize(
      questions.filter((q) => q.domainId === d.id).map((q) => q.id),
      seen,
    );
    picked.push(...pool.slice(0, quotas[i]));
    leftovers.push(...pool.slice(quotas[i]));
  });
  // Si a algún dominio le faltaron preguntas, se completa con las de los demás.
  if (picked.length < count) picked.push(...prioritize(leftovers, seen).slice(0, count - picked.length));
  return { ids: shuffle(picked), available: questions.length };
}

/** Examen personalizado por temas/dominios y con filtros de "pool". */
export async function selectCustom(userId: string, courseId: string, f: CustomFilters) {
  const where = {
    courseId,
    status: "ACTIVE",
    ...(f.domains.length ? { domain: { slug: { in: f.domains } } } : {}),
    ...(f.topics.length ? { topics: { some: { topic: { slug: { in: f.topics } } } } } : {}),
    ...(f.difficulty ? { difficulty: f.difficulty } : {}),
  };
  const [rows, seen, marks] = await Promise.all([
    db.question.findMany({ where, select: { id: true } }),
    history(userId, courseId),
    f.pool === "pending"
      ? db.questionMark.findMany({ where: { userId, courseId }, select: { questionId: true } })
      : Promise.resolve([]),
  ]);
  let ids = rows.map((r) => r.id);
  if (f.pool === "unseen") ids = ids.filter((id) => !seen.has(id));
  if (f.pool === "wrong") ids = ids.filter((id) => seen.get(id)?.wrong);
  if (f.pool === "pending") {
    const pending = new Set(marks.map((m) => m.questionId));
    ids = ids.filter((id) => pending.has(id));
  }
  return { ids: prioritize(ids, seen).slice(0, f.count), available: ids.length };
}

/** Preguntas vencidas en la repetición espaciada de un curso. */
export async function selectDue(userId: string, courseId: string, limit: number) {
  const cards = await db.studyCard.findMany({
    where: { userId, courseId, itemType: "QUESTION", dueAt: { lte: new Date() } },
    orderBy: { dueAt: "asc" },
    take: limit,
    select: { itemId: true },
  });
  const active = await db.question.findMany({
    where: { id: { in: cards.map((c) => c.itemId) }, status: "ACTIVE" },
    select: { id: true },
  });
  const ok = new Set(active.map((a) => a.id));
  const ids = cards.map((c) => c.itemId).filter((id) => ok.has(id));
  return { ids: shuffle(ids), available: ids.length };
}
