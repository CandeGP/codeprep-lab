import { notFound } from "next/navigation";
import { getLesson, getProblems, getQuiz, listLessons } from "@/lib/content";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { LessonView } from "./LessonView";

export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const lesson = await getLesson(slug);
  if (!lesson) notFound();

  const [lessons, quiz, problems, progress, bookmarks] = await Promise.all([
    listLessons(),
    getQuiz(slug),
    getProblems(slug),
    db.progress.findUnique({ where: { userId_lessonSlug: { userId: user.id, lessonSlug: slug } } }),
    db.bookmark.findMany({ where: { userId: user.id }, select: { type: true, ref: true } }),
  ]);
  const idx = lessons.findIndex((l) => l.slug === slug);
  const savedRefs = bookmarks.map((b) => `${b.type}:${b.ref}`);

  return (
    <LessonView
      lesson={{ slug, title: lesson.title, summary: lesson.summary, order: lesson.order, html: lesson.html, headings: lesson.headings }}
      quiz={quiz}
      problems={problems.map((p) => ({ id: p.id, title: p.title, difficulty: p.difficulty }))}
      completed={!!progress}
      savedRefs={savedRefs}
      prev={idx > 0 ? { slug: lessons[idx - 1].slug, title: lessons[idx - 1].title } : null}
      next={idx < lessons.length - 1 ? { slug: lessons[idx + 1].slug, title: lessons[idx + 1].title } : null}
    />
  );
}
