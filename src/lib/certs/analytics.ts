import "server-only";
import { db } from "@/lib/db";
import { pct } from "./shared";

export type Bucket = { slug: string; name: string; total: number; ok: number; pct: number };
export type WeakTopic = Bucket & { lapses: number; weakness: number };

type Item = {
  correct: boolean;
  domain: { slug: string; name: string };
  topics: { slug: string; name: string }[];
};

function add(map: Map<string, Bucket>, slug: string, name: string, correct: boolean) {
  const b = map.get(slug) ?? { slug, name, total: 0, ok: 0, pct: 0 };
  b.total++;
  if (correct) b.ok++;
  b.pct = pct(b.ok, b.total);
  map.set(slug, b);
}

/** Desglose de aciertos por dominio y por tema. */
export function breakdown(items: Item[]) {
  const domains = new Map<string, Bucket>();
  const topics = new Map<string, Bucket>();
  for (const it of items) {
    add(domains, it.domain.slug, it.domain.name, it.correct);
    for (const t of it.topics) add(topics, t.slug, t.name, it.correct);
  }
  return {
    byDomain: [...domains.values()],
    byTopic: [...topics.values()].sort((a, b) => a.pct - b.pct || b.total - a.total),
  };
}

/**
 * "Qué estudiar": combina todas las respuestas del usuario en el curso con los
 * fallos de la repetición espaciada para ordenar los temas del más débil al más fuerte,
 * y estima qué tan listo está para el examen según el peso de cada dominio.
 */
export async function courseInsights(userId: string, courseId: string) {
  const [answers, domains, topics, cards, attempts] = await Promise.all([
    db.attemptAnswer.findMany({
      where: { attempt: { userId, courseId }, NOT: { selected: "[]" } },
      select: { questionId: true, correct: true },
    }),
    db.domain.findMany({ where: { courseId }, orderBy: { order: "asc" } }),
    db.topic.findMany({
      where: { courseId },
      include: { _count: { select: { questions: { where: { question: { status: "ACTIVE" } } } } } },
    }),
    db.studyCard.findMany({
      where: { userId, courseId, itemType: "QUESTION" },
      select: { itemId: true, lapses: true, dueAt: true },
    }),
    db.examAttempt.findMany({
      where: { userId, courseId, status: "FINISHED" },
      orderBy: { finishedAt: "desc" },
      take: 12,
      select: { id: true, title: true, kind: true, mode: true, score: true, finishedAt: true, questionIds: true },
    }),
  ]);

  const qids = [...new Set(answers.map((a) => a.questionId))];
  const questions = await db.question.findMany({
    where: { id: { in: qids } },
    select: { id: true, domainId: true, topics: { select: { topicId: true } } },
  });
  const qBy = new Map(questions.map((q) => [q.id, q]));
  const lapsesBy = new Map(cards.map((c) => [c.itemId, c.lapses]));

  const domainStat = new Map(domains.map((d) => [d.id, { total: 0, ok: 0 }]));
  const topicStat = new Map(topics.map((t) => [t.id, { total: 0, ok: 0, lapses: 0 }]));
  for (const a of answers) {
    const q = qBy.get(a.questionId);
    if (!q) continue;
    const d = domainStat.get(q.domainId);
    if (d) {
      d.total++;
      if (a.correct) d.ok++;
    }
    for (const { topicId } of q.topics) {
      const t = topicStat.get(topicId);
      if (!t) continue;
      t.total++;
      if (a.correct) t.ok++;
    }
  }
  for (const q of questions) {
    const l = lapsesBy.get(q.id) ?? 0;
    for (const { topicId } of q.topics) {
      const t = topicStat.get(topicId);
      if (t) t.lapses += l;
    }
  }

  const byDomain = domains.map((d) => {
    const s = domainStat.get(d.id)!;
    return { slug: d.slug, name: d.name, weight: d.weight, total: s.total, ok: s.ok, pct: pct(s.ok, s.total) };
  });

  const practiced: WeakTopic[] = [];
  const unpracticed: { slug: string; name: string; questions: number }[] = [];
  for (const t of topics) {
    const s = topicStat.get(t.id)!;
    if (s.total === 0) {
      if (t._count.questions > 0) unpracticed.push({ slug: t.slug, name: t.name, questions: t._count.questions });
      continue;
    }
    // Error suavizado (Laplace) + penalización por fallos repetidos en el repaso.
    const errorRate = 1 - (s.ok + 1) / (s.total + 2);
    const weakness = errorRate * (1 + Math.min(1, s.lapses / s.total));
    practiced.push({ slug: t.slug, name: t.name, total: s.total, ok: s.ok, pct: pct(s.ok, s.total), lapses: s.lapses, weakness });
  }
  practiced.sort((a, b) => b.weakness - a.weakness);

  const withData = byDomain.filter((d) => d.total > 0);
  const weightSum = withData.reduce((a, d) => a + d.weight, 0);
  const readiness = weightSum ? Math.round(withData.reduce((a, d) => a + d.pct * d.weight, 0) / weightSum) : null;

  const now = Date.now();
  return {
    answered: answers.length,
    readiness,
    readinessConfident: answers.length >= 40 && withData.length === domains.length,
    byDomain,
    weakTopics: practiced.filter((t) => t.pct < 80).slice(0, 6),
    topics: practiced,
    unpracticed,
    dueCount: cards.filter((c) => c.dueAt.getTime() <= now).length,
    attempts: attempts.map((a) => ({
      id: a.id,
      title: a.title,
      kind: a.kind,
      mode: a.mode,
      score: a.score ?? 0,
      finishedAt: a.finishedAt,
      total: JSON.parse(a.questionIds).length as number,
    })),
  };
}

export type Insights = Awaited<ReturnType<typeof courseInsights>>;
