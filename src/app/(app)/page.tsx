import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAllProblems, listLessons } from "@/lib/content";

export default async function HomePage() {
  const user = await requireUser();
  const [lessons, problems, progress, dueCount, solved, notesCount, pdf, lastAttempt, certDue] = await Promise.all([
    listLessons(),
    getAllProblems(),
    db.progress.findMany({ where: { userId: user.id } }),
    db.reviewCard.count({ where: { userId: user.id, dueAt: { lte: new Date() } } }),
    db.submission.findMany({ where: { userId: user.id, passed: true }, distinct: ["problemId"], select: { problemId: true } }),
    db.note.count({ where: { userId: user.id } }),
    db.pdfFile.findUnique({ where: { userId: user.id } }),
    db.examAttempt.findFirst({
      where: { userId: user.id },
      orderBy: { startedAt: "desc" },
      include: { course: { select: { slug: true, code: true, passingPct: true } } },
    }),
    db.studyCard.count({ where: { userId: user.id, dueAt: { lte: new Date() } } }),
  ]);
  const done = new Set(progress.map((p) => p.lessonSlug));
  const nextLesson = lessons.find((l) => !done.has(l.slug)) ?? lessons[0];

  const stats = [
    { label: "Lecciones completadas", value: `${done.size}/${lessons.length}` },
    { label: "Ejercicios resueltos", value: `${solved.length}/${problems.length}` },
    { label: "Tarjetas para repasar hoy", value: dueCount },
    { label: "Notas escritas", value: notesCount },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
      <h1 className="text-3xl font-bold">Hola, {user.username} 👋</h1>
      <p className="text-muted mt-1">Un poco cada día rinde más que un maratón el fin de semana.</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs text-muted mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4 mt-6">
        {nextLesson && (
          <Link href={`/learn/${nextLesson.slug}`} className="card p-5 hover:border-accent">
            <div className="text-xs font-semibold uppercase tracking-wider text-accent">Continuar aprendiendo</div>
            <div className="text-lg font-semibold mt-1">{nextLesson.title}</div>
            <p className="text-sm text-muted mt-1 line-clamp-2">{nextLesson.summary}</p>
          </Link>
        )}
        <Link href="/review" className="card p-5 hover:border-accent">
          <div className="text-xs font-semibold uppercase tracking-wider text-accent">Repaso del día</div>
          <div className="text-lg font-semibold mt-1">
            {dueCount > 0 ? `${dueCount} tarjeta${dueCount === 1 ? "" : "s"} pendiente${dueCount === 1 ? "" : "s"}` : "Todo al día"}
          </div>
          <p className="text-sm text-muted mt-1">
            {dueCount > 0 ? "Repasa ahora para fijar lo aprendido." : "Responde quizzes en las lecciones para generar tarjetas."}
          </p>
        </Link>
        <Link
          href={
            lastAttempt
              ? lastAttempt.status === "FINISHED"
                ? `/certs/${lastAttempt.course.slug}`
                : `/certs/${lastAttempt.course.slug}/exam/${lastAttempt.id}`
              : "/certs"
          }
          className="card p-5 hover:border-accent"
        >
          <div className="text-xs font-semibold uppercase tracking-wider text-accent">Certificaciones</div>
          {lastAttempt ? (
            <>
              <div className="text-lg font-semibold mt-1">
                {lastAttempt.status === "FINISHED"
                  ? `Último ${lastAttempt.course.code}: ${Math.round((lastAttempt.score ?? 0) * 100)}%`
                  : `Continuar: ${lastAttempt.title}`}
              </div>
              <p className="text-sm text-muted mt-1">
                {certDue > 0 ? `${certDue} tarjeta${certDue === 1 ? "" : "s"} de repaso para hoy.` : "Repaso de certificaciones al día."}
              </p>
            </>
          ) : (
            <>
              <div className="text-lg font-semibold mt-1">Simulacros de AWS y más</div>
              <p className="text-sm text-muted mt-1">Exámenes de práctica, flashcards y repaso de lo que más te cuesta.</p>
            </>
          )}
        </Link>
        <Link href="/practice" className="card p-5 hover:border-accent">
          <div className="text-xs font-semibold uppercase tracking-wider text-accent">Practicar</div>
          <div className="text-lg font-semibold mt-1">Resuelve un ejercicio</div>
          <p className="text-sm text-muted mt-1">Editor con pruebas automáticas en JavaScript y Python.</p>
        </Link>
        <Link href="/book" className="card p-5 hover:border-accent">
          <div className="text-xs font-semibold uppercase tracking-wider text-accent">Mi libro</div>
          <div className="text-lg font-semibold mt-1">{pdf ? `Seguir en la página ${pdf.lastPage}` : "Carga tu PDF"}</div>
          <p className="text-sm text-muted mt-1">
            {pdf ? pdf.filename : "Lee tu copia en pantalla y toma notas por página."}
          </p>
        </Link>
      </div>
    </div>
  );
}
