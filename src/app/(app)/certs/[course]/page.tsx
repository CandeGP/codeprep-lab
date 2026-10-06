import Link from "next/link";
import { notFound } from "next/navigation";
import { canUseAi, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { courseInsights } from "@/lib/certs/analytics";
import { PctBar } from "@/components/certs/QuestionView";
import { StartExamButton } from "@/components/certs/StartExam";
import { CustomExamCard, DeleteCourseButton, FullExamCard, GenerateBankCard } from "./Launchers";

export default async function CoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ course: string }>;
  searchParams: Promise<{ nuevo?: string; temas?: string }>;
}) {
  const user = await requireUser();
  const { course: slug } = await params;
  const { nuevo, temas } = await searchParams;
  const course = await db.course.findUnique({ where: { slug }, include: { domains: { orderBy: { order: "asc" } } } });
  if (!course) notFound();

  const now = new Date();
  const [topics, totalQuestions, insights, inProgress, pendingCount, flashcards, dueFlashcards] = await Promise.all([
    db.topic.findMany({
      where: { courseId: course.id },
      include: { _count: { select: { questions: { where: { question: { status: "ACTIVE" } } } } } },
      orderBy: { name: "asc" },
    }),
    db.question.count({ where: { courseId: course.id, status: "ACTIVE" } }),
    courseInsights(user.id, course.id),
    db.examAttempt.findMany({
      where: { userId: user.id, courseId: course.id, status: "IN_PROGRESS" },
      orderBy: { startedAt: "desc" },
    }),
    db.questionMark.count({ where: { userId: user.id, courseId: course.id } }),
    db.flashcard.count({ where: { courseId: course.id } }),
    db.studyCard.count({ where: { userId: user.id, courseId: course.id, itemType: "FLASHCARD", dueAt: { lte: now } } }),
  ]);

  const info = {
    slug: course.slug,
    code: course.code,
    examQuestions: course.examQuestions,
    simQuestions: course.simQuestions,
    timeLimitMin: course.timeLimitMin,
    passingScore: course.passingScore,
    totalQuestions,
  };
  const topicList = topics.map((t) => ({ slug: t.slug, name: t.name, questions: t._count.questions }));
  const ai = canUseAi(user);
  const pass = course.passingPct;

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
      <Link href="/certs" className="text-sm text-muted hover:text-accent">← Certificaciones</Link>
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <span className="chip !text-accent !border-accent/40">{course.provider}</span>
        <span className="chip font-mono">{course.code}</span>
        {course.source === "AI" && <span className="chip">✦ generado con IA</span>}
      </div>
      <h1 className="text-3xl font-bold mt-2">{course.title}</h1>
      <p className="text-muted mt-1">{course.description}</p>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted mt-2">
        <span>Examen real: {course.examQuestions} preguntas · {course.timeLimitMin} min · aprobar ≈ {pass}%</span>
        <span>Banco: {totalQuestions} preguntas · {flashcards} flashcards</span>
      </div>
      <div className="flex flex-wrap gap-2 mt-4">
        <Link href={`/certs/${slug}/flashcards`} className="btn">
          🃏 Flashcards{dueFlashcards > 0 && <span className="text-accent font-semibold"> · {dueFlashcards} hoy</span>}
        </Link>
        <Link href={`/certs/${slug}/questions`} className="btn">☰ Banco de preguntas</Link>
        <Link href={`/certs/review?curso=${slug}`} className="btn">↻ Repaso</Link>
        {course.source === "AI" && course.createdById === user.id && <DeleteCourseButton slug={slug} />}
      </div>

      {inProgress.length > 0 && (
        <div className="card p-4 mt-6 border-accent">
          <div className="text-xs font-semibold uppercase tracking-wider text-accent">Tienes exámenes sin terminar</div>
          <ul className="mt-2 divide-y divide-border">
            {inProgress.map((a) => (
              <li key={a.id} className="py-2 flex items-center gap-3 text-sm">
                <span className="flex-1 truncate">{a.title}</span>
                <span className="text-xs text-muted">{a.startedAt.toLocaleString("es")}</span>
                <Link href={`/certs/${slug}/exam/${a.id}`} className="btn">Continuar →</Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {ai && (nuevo || totalQuestions === 0) && (
        <div className="mt-6">
          <GenerateBankCard course={info} topics={topicList} isNew />
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4 mt-6 items-start">
        <FullExamCard course={info} />
        <CustomExamCard
          key={temas ?? ""}
          course={info}
          topics={topicList}
          aiEnabled={ai}
          initialTopics={temas ? temas.split(",") : []}
        />
      </div>

      {/* ---------------- Retroalimentación ---------------- */}
      <section className="mt-10">
        <h2 className="text-xl font-bold">Tu retroalimentación</h2>
        {insights.answered === 0 ? (
          <p className="text-muted mt-1">
            Aún no respondes preguntas de este curso. Haz un simulacro o un examen corto y aquí verás qué dominar primero.
          </p>
        ) : (
          <div className="grid md:grid-cols-3 gap-4 mt-3">
            <div className="card p-5">
              <div className="text-xs text-muted">Preparación estimada</div>
              <div className={`text-4xl font-bold mt-1 ${(insights.readiness ?? 0) >= pass ? "text-ok" : "text-bad"}`}>
                {insights.readiness ?? 0}%
              </div>
              <div className="mt-2">
                <PctBar value={insights.readiness ?? 0} pass={pass} />
              </div>
              <p className="text-xs text-muted mt-2">
                Promedio de aciertos ponderado por el peso de cada dominio (necesitas ≈ {pass}%).
                {!insights.readinessConfident && " Responde al menos 40 preguntas de todos los dominios para que sea confiable."}
              </p>
              <p className="text-xs text-muted mt-2">{insights.answered} respuestas registradas.</p>
            </div>

            <div className="card p-5 md:col-span-2">
              <div className="text-sm font-semibold">Por dominio</div>
              <ul className="mt-3 space-y-3">
                {insights.byDomain.map((d) => (
                  <li key={d.slug}>
                    <div className="flex justify-between text-sm">
                      <span>
                        {d.name} <span className="text-xs text-muted">({d.weight}% del examen)</span>
                      </span>
                      <span className="text-muted">{d.total ? `${d.pct}% · ${d.ok}/${d.total}` : "sin datos"}</span>
                    </div>
                    <div className="mt-1">
                      <PctBar value={d.total ? d.pct : 0} pass={pass} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card p-5 md:col-span-2">
              <div className="text-sm font-semibold">Estudia primero</div>
              <p className="text-xs text-muted">Temas donde más fallas (considera también lo que olvidas en el repaso).</p>
              {insights.weakTopics.length === 0 ? (
                <p className="text-sm text-ok mt-3">¡Vas bien! Ningún tema practicado está por debajo de 80%.</p>
              ) : (
                <ul className="mt-3 divide-y divide-border">
                  {insights.weakTopics.map((t) => (
                    <li key={t.slug} className="py-2 flex items-center gap-3 text-sm">
                      <span className={`w-12 font-mono text-right ${t.pct >= pass ? "text-warn" : "text-bad"}`}>{t.pct}%</span>
                      <span className="flex-1">
                        {t.name} <span className="text-xs text-muted">({t.ok}/{t.total}{t.lapses ? ` · olvidadas ${t.lapses}×` : ""})</span>
                      </span>
                      <StartExamButton
                        payload={{ courseSlug: slug, kind: "CUSTOM", mode: "INSTANT", count: 10, topics: [t.slug], pool: "all" }}
                      >
                        Practicar 10
                      </StartExamButton>
                    </li>
                  ))}
                </ul>
              )}
              {insights.weakTopics.length > 1 && (
                <div className="mt-3">
                  <StartExamButton
                    className="btn-primary"
                    payload={{
                      courseSlug: slug,
                      kind: "CUSTOM",
                      mode: "INSTANT",
                      count: 20,
                      topics: insights.weakTopics.map((t) => t.slug),
                      pool: "all",
                    }}
                  >
                    20 preguntas de mis temas débiles
                  </StartExamButton>
                </div>
              )}
            </div>

            <div className="card p-5 space-y-3">
              <div className="text-sm font-semibold">Pendientes</div>
              <div>
                <div className="text-2xl font-bold">{insights.dueCount}</div>
                <div className="text-xs text-muted">preguntas falladas para repasar hoy</div>
                {insights.dueCount > 0 && (
                  <div className="mt-2">
                    <StartExamButton
                      payload={{ courseSlug: slug, kind: "REVIEW", mode: "INSTANT", source: "due", count: 20 }}
                    >
                      Repasar ahora
                    </StartExamButton>
                  </div>
                )}
              </div>
              <div>
                <div className="text-2xl font-bold">{pendingCount}</div>
                <div className="text-xs text-muted">marcadas como pendientes</div>
                {pendingCount > 0 && (
                  <div className="mt-2 flex gap-2">
                    <StartExamButton
                      payload={{ courseSlug: slug, kind: "CUSTOM", mode: "INSTANT", count: 30, topics: [], pool: "pending" }}
                    >
                      Practicarlas
                    </StartExamButton>
                    <Link className="btn" href={`/certs/${slug}/questions?pendientes=1`}>Ver</Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {insights.unpracticed.length > 0 && insights.answered > 0 && (
          <div className="card p-5 mt-4">
            <div className="text-sm font-semibold">Temas que aún no practicas</div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {insights.unpracticed.map((t) => (
                <Link key={t.slug} href={`/certs/${slug}?temas=${t.slug}#personalizado`} className="chip hover:!border-accent">
                  {t.name} · {t.questions}
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      {insights.attempts.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-bold">Historial</h2>
          <ScoreChart attempts={insights.attempts} pass={pass} />
          <ul className="card mt-3 divide-y divide-border">
            {insights.attempts.map((a) => {
              const score = Math.round(a.score * 100);
              return (
                <li key={a.id}>
                  <Link href={`/certs/${slug}/results/${a.id}`} className="px-4 py-3 flex items-center gap-3 text-sm hover:bg-surface-2">
                    <span className={`w-12 font-bold ${score >= pass ? "text-ok" : "text-bad"}`}>{score}%</span>
                    <span className="flex-1 truncate">{a.title}</span>
                    <span className="chip">{a.mode === "END" ? "examen" : "práctica"}</span>
                    <span className="text-xs text-muted hidden sm:inline">{a.total} preg.</span>
                    <span className="text-xs text-muted hidden sm:inline">{a.finishedAt?.toLocaleDateString("es")}</span>
                    <span className="text-muted">›</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {ai && !nuevo && totalQuestions > 0 && (
        <section className="mt-10">
          <GenerateBankCard course={info} topics={topicList} isNew={false} />
        </section>
      )}
    </div>
  );
}

/** Evolución de los puntajes (del más antiguo al más reciente) con la línea de aprobación. */
function ScoreChart({ attempts, pass }: { attempts: { id: string; score: number }[]; pass: number }) {
  const pts = [...attempts].reverse();
  if (pts.length < 2) return null;
  const W = 600;
  const H = 120;
  const x = (i: number) => 20 + (i * (W - 40)) / (pts.length - 1);
  const y = (v: number) => H - 10 - (v / 100) * (H - 20);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.score * 100)}`).join(" ");
  return (
    <div className="card p-4 mt-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-28" role="img" aria-label="Evolución de puntajes">
        <line x1="20" x2={W - 20} y1={y(pass)} y2={y(pass)} stroke="var(--ok)" strokeDasharray="4 4" strokeWidth="1" />
        <text x={W - 20} y={y(pass) - 4} textAnchor="end" fontSize="10" fill="var(--ok)">aprobar {pass}%</text>
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" />
        {pts.map((p, i) => (
          <circle key={p.id} cx={x(i)} cy={y(p.score * 100)} r="3.5" fill={p.score * 100 >= pass ? "var(--ok)" : "var(--bad)"} />
        ))}
      </svg>
    </div>
  );
}
