import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { BookmarkButton } from "@/components/BookmarkButton";

const TYPES = {
  LESSON: { label: "Lecciones", href: (ref: string) => `/learn/${ref}` },
  SECTION: { label: "Secciones", href: (ref: string) => `/learn/${ref}` },
  PROBLEM: { label: "Ejercicios", href: (ref: string) => `/practice/${ref}` },
  PDF_PAGE: { label: "Páginas del libro", href: (ref: string) => `/book?page=${ref}` },
} as const;

export default async function SavedPage() {
  const user = await requireUser();
  const bookmarks = await db.bookmark.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-8">
      <h1 className="text-3xl font-bold">Guardados</h1>
      <p className="text-muted mt-1">Lecciones, secciones, ejercicios y páginas del libro que marcaste con ☆.</p>
      {bookmarks.length === 0 && (
        <div className="card p-6 mt-6 text-sm text-muted">
          Aún no guardas nada. Usa el botón ☆ en lecciones, secciones del índice lateral, ejercicios o páginas del PDF.
        </div>
      )}
      {(Object.keys(TYPES) as (keyof typeof TYPES)[]).map((type) => {
        const items = bookmarks.filter((b) => b.type === type);
        if (!items.length) return null;
        return (
          <section key={type} className="mt-8">
            <h2 className="font-semibold text-lg">{TYPES[type].label}</h2>
            <ul className="card mt-2 divide-y divide-border">
              {items.map((b) => (
                <li key={b.id} className="flex items-center gap-3 px-4 py-3">
                  <Link href={TYPES[type].href(b.ref)} className="flex-1 hover:text-accent">{b.label}</Link>
                  <span className="text-xs text-muted">{b.createdAt.toLocaleDateString("es")}</span>
                  <BookmarkButton small type={type} refId={b.ref} label={b.label} initial />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
