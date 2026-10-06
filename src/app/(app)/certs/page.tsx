import Link from "next/link";
import { canUseAi, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { CourseSearch } from "./CourseSearch";

export const metadata = { title: "Certificaciones · CodePrep" };

export default async function CertsPage() {
  const user = await requireUser();
  const now = new Date();
  const [courses, attempts, due, inProgress] = await Promise.all([
    db.course.findMany({
      orderBy: [{ source: "asc" }, { title: "asc" }],
      include: {
        _count: { select: { questions: { where: { status: "ACTIVE" } }, flashcards: true, topics: true } },
      },
    }),
    db.examAttempt.findMany({
      where: { userId: user.id, status: "FINISHED" },
      orderBy: { finishedAt: "desc" },
      select: { courseId: true, score: true },
    }),
    db.studyCard.groupBy({
      by: ["courseId"],
      where: { userId: user.id, dueAt: { lte: now } },
      _count: { _all: true },
    }),
    db.examAttempt.findMany({
      where: { userId: user.id, status: "IN_PROGRESS" },
      orderBy: { startedAt: "desc" },
      take: 5,
      include: { course: { select: { slug: true, code: true } } },
    }),
  ]);

  const dueBy = new Map(due.map((d) => [d.courseId, d._count._all]));
  const items = courses.map((c) => {
    const mine = attempts.filter((a) => a.courseId === c.id);
    return {
      slug: c.slug,
      title: c.title,
      code: c.code,
      provider: c.provider,
      description: c.description,
      source: c.source,
      questions: c._count.questions,
      flashcards: c._count.flashcards,
      topics: c._count.topics,
      attempts: mine.length,
      lastScore: mine[0]?.score != null ? Math.round(mine[0].score * 100) : null,
      passingPct: c.passingPct,
      due: dueBy.get(c.id) ?? 0,
    };
  });

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Certificaciones</h1>
          <p className="text-muted mt-1">Simulacros, exámenes por tema, flashcards y repaso de lo que más te cuesta.</p>
        </div>
        <Link href="/certs/review" className="btn">↻ Área de repaso</Link>
      </div>

      {inProgress.length > 0 && (
        <div className="card p-4 mt-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-accent">Exámenes en curso</div>
          <ul className="mt-2 divide-y divide-border">
            {inProgress.map((a) => (
              <li key={a.id} className="py-2 flex items-center gap-3 text-sm">
                <span className="chip">{a.course.code}</span>
                <span className="flex-1 truncate">{a.title}</span>
                <Link href={`/certs/${a.course.slug}/exam/${a.id}`} className="btn">Continuar →</Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <CourseSearch courses={items} aiEnabled={canUseAi(user)} />
    </div>
  );
}
