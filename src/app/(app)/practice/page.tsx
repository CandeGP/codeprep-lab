import Link from "next/link";
import { getProblems, listLessons } from "@/lib/content";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DifficultyChip } from "../learn/[slug]/LessonView";

export default async function PracticePage() {
  const user = await requireUser();
  const lessons = await listLessons();
  const groups = await Promise.all(lessons.map(async (l) => ({ lesson: l, problems: await getProblems(l.slug) })));
  const subs = await db.submission.findMany({
    where: { userId: user.id },
    select: { problemId: true, passed: true },
  });
  const solved = new Set(subs.filter((s) => s.passed).map((s) => s.problemId));
  const tried = new Set(subs.map((s) => s.problemId));
  const total = groups.reduce((n, g) => n + g.problems.length, 0);

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
      <h1 className="text-3xl font-bold">Practicar</h1>
      <p className="text-muted mt-1">
        {solved.size} de {total} ejercicios resueltos. Se ejecutan en tu navegador en JavaScript o Python.
      </p>
      <div className="space-y-8 mt-8">
        {groups
          .filter((g) => g.problems.length > 0)
          .map(({ lesson, problems }) => (
            <section key={lesson.slug}>
              <h2 className="font-semibold text-lg">{lesson.title}</h2>
              <div className="card mt-2 divide-y divide-border">
                {problems.map((p) => (
                  <Link key={p.id} href={`/practice/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                    <span className={`w-5 text-center ${solved.has(p.id) ? "text-ok" : tried.has(p.id) ? "text-warn" : "text-muted"}`}>
                      {solved.has(p.id) ? "✓" : tried.has(p.id) ? "…" : "○"}
                    </span>
                    <span className="flex-1">{p.title}</span>
                    <DifficultyChip d={p.difficulty} />
                  </Link>
                ))}
              </div>
            </section>
          ))}
      </div>
    </div>
  );
}
