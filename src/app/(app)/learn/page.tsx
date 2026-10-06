import Link from "next/link";
import { listLessons, getProblems, getQuiz } from "@/lib/content";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function LearnPage() {
  const user = await requireUser();
  const lessons = await listLessons();
  const done = new Set(
    (await db.progress.findMany({ where: { userId: user.id }, select: { lessonSlug: true } })).map((p) => p.lessonSlug),
  );
  const extras = await Promise.all(
    lessons.map(async (l) => ({ quiz: (await getQuiz(l.slug)).length, problems: (await getProblems(l.slug)).length })),
  );

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
      <h1 className="text-3xl font-bold">Aprender</h1>
      <p className="text-muted mt-1">
        {done.size} de {lessons.length} lecciones completadas.
      </p>
      <div className="h-2 rounded-full bg-surface-2 mt-3 overflow-hidden">
        <div className="h-full bg-accent" style={{ width: `${(done.size / Math.max(1, lessons.length)) * 100}%` }} />
      </div>
      <div className="grid sm:grid-cols-2 gap-4 mt-8">
        {lessons.map((l, i) => (
          <Link key={l.slug} href={`/learn/${l.slug}`} className="card p-5 hover:border-accent transition-colors group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-muted">Lección {String(l.order).padStart(2, "0")}</span>
              {done.has(l.slug) && <span className="text-xs font-semibold text-ok">✓ Completada</span>}
            </div>
            <h2 className="text-lg font-semibold mt-1 group-hover:text-accent">{l.title}</h2>
            <p className="text-sm text-muted mt-1 line-clamp-2">{l.summary}</p>
            <div className="flex gap-2 mt-3 flex-wrap">
              <span className="chip">{extras[i].quiz} preguntas</span>
              <span className="chip">{extras[i].problems} ejercicios</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
