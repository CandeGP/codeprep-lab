import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAllQuestions, listLessons } from "@/lib/content";
import { ReviewSession } from "./ReviewSession";

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ lesson?: string }> }) {
  const user = await requireUser();
  const { lesson } = await searchParams;
  const [questions, lessons, cards] = await Promise.all([
    getAllQuestions(),
    listLessons(),
    db.reviewCard.findMany({ where: { userId: user.id } }),
  ]);
  const now = new Date();
  const byId = new Map(questions.map((q) => [q.id, q]));
  const due = cards
    .filter((c) => c.dueAt <= now && byId.has(c.questionId))
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
    .map((c) => byId.get(c.questionId)!);

  const weak = cards
    .filter((c) => c.lapses > 0 && byId.has(c.questionId))
    .sort((a, b) => b.lapses - a.lapses)
    .slice(0, 10)
    .map((c) => ({ question: byId.get(c.questionId)!.question, lapses: c.lapses, lessonSlug: c.lessonSlug }));

  const lessonQuestions = lesson ? questions.filter((q) => q.id.startsWith(`${lesson}:`)) : [];
  const nextDue = cards.filter((c) => c.dueAt > now).sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())[0];

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-8">
      <h1 className="text-3xl font-bold">Repasar</h1>
      <p className="text-muted mt-1">
        Repetición espaciada: las preguntas que fallas vuelven pronto; las que dominas, cada vez más espaciadas.
      </p>
      <ReviewSession
        due={due}
        lessonQuestions={lessonQuestions}
        lessons={lessons.map((l) => ({ slug: l.slug, title: l.title }))}
        selectedLesson={lesson ?? null}
        weak={weak}
        nextDueAt={nextDue?.dueAt.toISOString() ?? null}
      />
    </div>
  );
}
