import { listLessons } from "@/lib/content";
import { NotesBrowser } from "./NotesBrowser";

export default async function NotesPage() {
  const lessons = await listLessons();
  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
      <h1 className="text-3xl font-bold">Notas</h1>
      <p className="text-muted mt-1">
        Tus notas privadas (🔒) solo las ves tú. Las compartidas (👥) las ve cualquier usuario de la plataforma.
      </p>
      <NotesBrowser lessons={lessons.map((l) => ({ slug: l.slug, title: l.title }))} />
    </div>
  );
}
