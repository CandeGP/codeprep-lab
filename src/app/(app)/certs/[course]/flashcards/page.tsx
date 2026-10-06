import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { aiAvailable } from "@/lib/certs/generate";
import { FlashcardSession } from "./FlashcardSession";

const SESSION_NEW = 20;
const SESSION_MAX = 40;

export default async function FlashcardsPage({
  params,
  searchParams,
}: {
  params: Promise<{ course: string }>;
  searchParams: Promise<{ tema?: string; todas?: string }>;
}) {
  const user = await requireUser();
  const { course: slug } = await params;
  const { tema, todas } = await searchParams;
  const course = await db.course.findUnique({ where: { slug } });
  if (!course) notFound();

  const topicFilter = tema ? { topic: { slug: tema } } : {};
  const [topics, cards, studied] = await Promise.all([
    db.topic.findMany({
      where: { courseId: course.id, flashcards: { some: {} } },
      include: { _count: { select: { flashcards: true } } },
      orderBy: { name: "asc" },
    }),
    db.flashcard.findMany({
      where: { courseId: course.id, ...topicFilter },
      include: { topic: { select: { name: true, nameEn: true } } },
    }),
    db.studyCard.findMany({
      where: { userId: user.id, courseId: course.id, itemType: "FLASHCARD" },
      select: { itemId: true, dueAt: true },
    }),
  ]);

  // Sesión: primero las vencidas, luego nuevas (hasta 20). "todas" = repaso libre al azar.
  const now = Date.now();
  const due = new Map(studied.map((s) => [s.itemId, s.dueAt.getTime()]));
  const shuffled = [...cards].sort(() => Math.random() - 0.5);
  const session = todas
    ? shuffled.slice(0, SESSION_MAX)
    : [
        ...shuffled.filter((c) => due.has(c.id) && due.get(c.id)! <= now).sort((a, b) => due.get(a.id)! - due.get(b.id)!),
        ...shuffled.filter((c) => !due.has(c.id)).slice(0, SESSION_NEW),
      ].slice(0, SESSION_MAX);
  const nextDue = [...due.values()].filter((t) => t > now).sort((a, b) => a - b)[0];

  const base = `/certs/${slug}/flashcards`;
  const link = (t?: string, all?: boolean) => {
    const sp = new URLSearchParams();
    if (t) sp.set("tema", t);
    if (all) sp.set("todas", "1");
    const s = sp.toString();
    return s ? `${base}?${s}` : base;
  };

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-8">
      <Link href={`/certs/${slug}`} className="text-sm text-muted hover:text-accent">← {course.code}</Link>
      <h1 className="text-3xl font-bold mt-2">Flashcards</h1>
      <p className="text-muted mt-1">
        Aprende conceptos rápido. Califica qué tan bien lo recordabas y la tarjeta volverá cuando estés por olvidarla.
      </p>

      <div className="flex flex-wrap gap-1.5 mt-4">
        <Link href={link(undefined, !!todas)} className={`chip ${!tema ? "!border-accent !text-accent" : ""}`}>
          Todos los temas{!tema && ` · ${cards.length}`}
        </Link>
        {topics.map((t) => (
          <Link key={t.slug} href={link(t.slug, !!todas)} className={`chip ${tema === t.slug ? "!border-accent !text-accent" : ""}`}>
            {t.name} · {t._count.flashcards}
          </Link>
        ))}
      </div>
      <div className="flex gap-2 mt-3 text-sm">
        <Link href={link(tema)} className={`btn ${!todas ? "!border-accent !text-accent" : ""}`}>Programadas y nuevas</Link>
        <Link href={link(tema, true)} className={`btn ${todas ? "!border-accent !text-accent" : ""}`}>Repaso libre</Link>
      </div>

      <FlashcardSession
        key={`${tema ?? ""}-${todas ?? ""}`}
        cards={session.map((c) => ({
          id: c.id,
          text: { en: { front: c.front, back: c.back }, ...(c.frontEs && c.backEs ? { es: { front: c.frontEs, back: c.backEs } } : {}) },
          topic: c.topic ? (user.lang === "en" && c.topic.nameEn ? c.topic.nameEn : c.topic.name) : null,
          isNew: !due.has(c.id),
        }))}
        initialLang={user.lang}
        nextDueAt={nextDue ? new Date(nextDue).toISOString() : null}
        totalCards={cards.length}
        courseSlug={slug}
        aiEnabled={aiAvailable()}
      />
    </div>
  );
}
