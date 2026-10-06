import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { aiAvailable } from "@/lib/certs/generate";
import { canManageBank } from "@/lib/certs/permissions";
import { QuestionBank } from "./QuestionBank";

export default async function QuestionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ course: string }>;
  searchParams: Promise<{ pendientes?: string }>;
}) {
  const user = await requireUser();
  const { course: slug } = await params;
  const { pendientes } = await searchParams;
  const course = await db.course.findUnique({
    where: { slug },
    include: { domains: { orderBy: { order: "asc" } }, topics: { orderBy: { name: "asc" } } },
  });
  if (!course) notFound();

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
      <Link href={`/certs/${slug}`} className="text-sm text-muted hover:text-accent">← {course.code}</Link>
      <h1 className="text-3xl font-bold mt-2">Banco de preguntas</h1>
      <p className="text-muted mt-1">
        Busca, revisa respuestas, marca pendientes{canManageBank(user) ? ", edita o agrega preguntas" : ""}.
      </p>
      <QuestionBank
        courseSlug={slug}
        domains={course.domains.map((d) => ({ slug: d.slug, name: d.name }))}
        topics={course.topics.map((t) => ({ slug: t.slug, name: t.name }))}
        canManage={canManageBank(user)}
        aiEnabled={aiAvailable()}
        initialPending={pendientes === "1"}
        initialLang={user.lang}
      />
    </div>
  );
}
