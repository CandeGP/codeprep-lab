import { notFound } from "next/navigation";
import { getProblem, getLesson, renderMarkdown } from "@/lib/content";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProblemWorkspace } from "./ProblemWorkspace";

export default async function ProblemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const problem = await getProblem(id);
  if (!problem) notFound();

  const [lesson, lastSub, bookmark, descriptionHtml, solutionHtml] = await Promise.all([
    getLesson(problem.lessonSlug),
    db.submission.findFirst({ where: { userId: user.id, problemId: id }, orderBy: { createdAt: "desc" } }),
    db.bookmark.findUnique({ where: { userId_type_ref: { userId: user.id, type: "PROBLEM", ref: id } } }),
    renderMarkdown(problem.description),
    renderMarkdown(problem.solution.explanation),
  ]);

  return (
    <ProblemWorkspace
      problem={problem}
      lessonTitle={lesson?.title ?? ""}
      descriptionHtml={descriptionHtml}
      solutionHtml={solutionHtml}
      saved={!!bookmark}
      lastSubmission={lastSub ? { language: lastSub.language as "javascript" | "python", code: lastSub.code } : null}
    />
  );
}
