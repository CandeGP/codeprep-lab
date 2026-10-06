import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLesson, getProblems, listLessons } from "@/lib/content";
import { IndexBrowser, type IndexLesson, type SearchItem } from "./IndexBrowser";

export default async function IndexPage() {
  const user = await requireUser();
  const metas = await listLessons();
  const lessons: IndexLesson[] = [];
  const items: SearchItem[] = [];

  for (const meta of metas) {
    const lesson = await getLesson(meta.slug);
    const problems = await getProblems(meta.slug);
    if (!lesson) continue;
    lessons.push({
      slug: meta.slug,
      order: meta.order,
      title: meta.title,
      headings: lesson.headings.filter((h) => h.depth === 2),
      problems: problems.map((p) => ({ id: p.id, title: p.title })),
    });
    items.push({ kind: "Lección", title: meta.title, text: `${meta.summary} ${meta.tags.join(" ")}`, href: `/learn/${meta.slug}` });
    // Texto de cada sección para búsqueda de contenido
    const sections = lesson.markdown.split(/\n(?=##\s)/);
    for (const h of lesson.headings) {
      const body = sections.find((s) => s.replace(/^#+\s+/, "").startsWith(h.text)) ?? "";
      items.push({
        kind: "Sección",
        title: `${meta.title} › ${h.text}`,
        text: body.replace(/```[\s\S]*?```/g, " ").slice(0, 1500),
        href: `/learn/${meta.slug}#${h.id}`,
      });
    }
    for (const p of problems) {
      items.push({ kind: "Ejercicio", title: p.title, text: p.description.slice(0, 600), href: `/practice/${p.id}` });
    }
  }

  const notes = await db.note.findMany({
    where: { OR: [{ userId: user.id }, { visibility: "SHARED" }] },
    select: { title: true, body: true, lessonSlug: true, pdfPage: true, visibility: true },
    take: 1000,
  });
  for (const n of notes) {
    items.push({
      kind: n.visibility === "SHARED" ? "Nota compartida" : "Mi nota",
      title: n.title,
      text: n.body.slice(0, 1500),
      href: n.lessonSlug ? `/learn/${n.lessonSlug}` : n.pdfPage ? `/book?page=${n.pdfPage}` : "/notes",
    });
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
      <h1 className="text-3xl font-bold">Índice</h1>
      <p className="text-muted mt-1">Ve directo a cualquier lección, sección o ejercicio, o busca en todo el contenido y tus notas.</p>
      <IndexBrowser lessons={lessons} items={items} />
    </div>
  );
}
