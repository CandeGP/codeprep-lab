import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { courseInsights } from "@/lib/certs/analytics";
import { StartExamButton } from "@/components/certs/StartExam";

export const metadata = { title: "Repaso · Certificaciones" };

export default async function CertReviewPage({ searchParams }: { searchParams: Promise<{ curso?: string }> }) {
  const user = await requireUser();
  const { curso } = await searchParams;
  const now = new Date();

  // Cursos en los que el usuario tiene actividad (o sólo el elegido).
  const [studied, marked] = await Promise.all([
    db.studyCard.findMany({ where: { userId: user.id }, distinct: ["courseId"], select: { courseId: true } }),
    db.questionMark.findMany({ where: { userId: user.id }, distinct: ["courseId"], select: { courseId: true } }),
  ]);
  const activeIds = [...studied, ...marked].map((c) => c.courseId);
  const active = await db.course.findMany({
    where: curso ? { slug: curso } : { OR: [{ attempts: { some: { userId: user.id } } }, { id: { in: activeIds } }] },
    orderBy: { title: "asc" },
  });

  const sections = await Promise.all(
    active.map(async (c) => {
      const [insights, dueFlash, pending, hardest] = await Promise.all([
        courseInsights(user.id, c.id),
        db.studyCard.count({ where: { userId: user.id, courseId: c.id, itemType: "FLASHCARD", dueAt: { lte: now } } }),
        db.questionMark.count({ where: { userId: user.id, courseId: c.id } }),
        db.studyCard.findMany({
          where: { userId: user.id, courseId: c.id, itemType: "QUESTION", lapses: { gt: 0 } },
          orderBy: [{ lapses: "desc" }, { updatedAt: "desc" }],
          take: 6,
        }),
      ]);
      const stems = await db.question.findMany({
        where: { id: { in: hardest.map((h) => h.itemId) } },
        select: { id: true, stem: true },
      });
      const stemBy = new Map(stems.map((s) => [s.id, s.stem]));
      return {
        course: c,
        insights,
        dueFlash,
        pending,
        hardest: hardest.filter((h) => stemBy.has(h.itemId)).map((h) => ({ id: h.itemId, lapses: h.lapses, stem: stemBy.get(h.itemId)! })),
      };
    }),
  );

  const totalDue = sections.reduce((a, s) => a + s.insights.dueCount + s.dueFlash, 0);

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
      <Link href="/certs" className="text-sm text-muted hover:text-accent">← Certificaciones</Link>
      <h1 className="text-3xl font-bold mt-2">Área de repaso</h1>
      <p className="text-muted mt-1">
        Lo que fallaste vuelve con repetición espaciada; lo que dominas aparece cada vez menos.{" "}
        {totalDue > 0 ? <b className="text-text">Hoy tienes {totalDue} tarjetas pendientes.</b> : "Hoy estás al día."}
      </p>

      {sections.length === 0 && (
        <div className="card p-6 mt-6 text-center">
          <div className="font-semibold">Aún no hay nada que repasar</div>
          <p className="text-sm text-muted mt-1">Haz un examen o estudia flashcards y aquí aparecerá lo que más te cuesta.</p>
          <Link href="/certs" className="btn mt-4">Elegir un curso</Link>
        </div>
      )}

      <div className="space-y-6 mt-6">
        {sections.map(({ course, insights, dueFlash, pending, hardest }) => (
          <section key={course.id} className="card p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip font-mono">{course.code}</span>
              <Link href={`/certs/${course.slug}`} className="font-semibold hover:text-accent flex-1">{course.title}</Link>
              {insights.readiness !== null && (
                <span className={`text-sm font-semibold ${insights.readiness >= course.passingPct ? "text-ok" : "text-bad"}`}>
                  Preparación {insights.readiness}%
                </span>
              )}
            </div>

            <div className="grid sm:grid-cols-3 gap-3 mt-4">
              <div className="rounded-lg bg-surface-2 p-4">
                <div className="text-2xl font-bold">{insights.dueCount}</div>
                <div className="text-xs text-muted">preguntas falladas para hoy</div>
                {insights.dueCount > 0 && (
                  <div className="mt-2">
                    <StartExamButton
                      className="btn-primary"
                      payload={{ courseSlug: course.slug, kind: "REVIEW", mode: "INSTANT", source: "due", count: 20 }}
                    >
                      Repasar {Math.min(20, insights.dueCount)}
                    </StartExamButton>
                  </div>
                )}
              </div>
              <div className="rounded-lg bg-surface-2 p-4">
                <div className="text-2xl font-bold">{dueFlash}</div>
                <div className="text-xs text-muted">flashcards para hoy</div>
                <Link href={`/certs/${course.slug}/flashcards`} className="btn mt-2">Estudiar flashcards</Link>
              </div>
              <div className="rounded-lg bg-surface-2 p-4">
                <div className="text-2xl font-bold">{pending}</div>
                <div className="text-xs text-muted">preguntas marcadas como pendientes</div>
                {pending > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <StartExamButton
                      payload={{ courseSlug: course.slug, kind: "CUSTOM", mode: "INSTANT", count: 30, topics: [], pool: "pending" }}
                    >
                      Practicar
                    </StartExamButton>
                    <Link href={`/certs/${course.slug}/questions?pendientes=1`} className="btn">Ver</Link>
                  </div>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mt-5">
              <div>
                <div className="text-sm font-semibold">Temas donde más batallas</div>
                {insights.weakTopics.length === 0 ? (
                  <p className="text-sm text-muted mt-2">
                    {insights.answered ? "Ningún tema por debajo de 80%. 👏" : "Sin datos todavía."}
                  </p>
                ) : (
                  <ul className="mt-2 divide-y divide-border">
                    {insights.weakTopics.map((t) => (
                      <li key={t.slug} className="py-2 flex items-center gap-2 text-sm">
                        <span className="w-10 text-right font-mono text-bad">{t.pct}%</span>
                        <span className="flex-1">{t.name}</span>
                        <StartExamButton
                          payload={{ courseSlug: course.slug, kind: "CUSTOM", mode: "INSTANT", count: 10, topics: [t.slug], pool: "all" }}
                        >
                          10 preguntas
                        </StartExamButton>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <div className="text-sm font-semibold">Preguntas que más olvidas</div>
                {hardest.length === 0 ? (
                  <p className="text-sm text-muted mt-2">Todavía ninguna. 👌</p>
                ) : (
                  <>
                    <ul className="mt-2 divide-y divide-border">
                      {hardest.map((h) => (
                        <li key={h.id} className="py-2 flex gap-2 text-sm">
                          <span className="text-bad font-mono text-xs mt-0.5">×{h.lapses}</span>
                          <span className="flex-1 line-clamp-2">{h.stem}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2">
                      <StartExamButton
                        payload={{ courseSlug: course.slug, kind: "CUSTOM", mode: "INSTANT", count: 20, topics: [], pool: "wrong" }}
                      >
                        Practicar las que he fallado
                      </StartExamButton>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
