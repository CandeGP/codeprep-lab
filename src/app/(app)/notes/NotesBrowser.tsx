"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Markdown } from "@/components/Markdown";
import { NotesPanel, type Note } from "@/components/NotesPanel";

export function NotesBrowser({ lessons }: { lessons: { slug: string; title: string }[] }) {
  const [scope, setScope] = useState<"mine" | "shared">("mine");
  const [lesson, setLesson] = useState("");
  const [query, setQuery] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [creating, setCreating] = useState(false);
  const [reload, setReload] = useState(0);
  const titles = useMemo(() => new Map(lessons.map((l) => [l.slug, l.title])), [lessons]);

  useEffect(() => {
    const qs = new URLSearchParams({ scope });
    if (lesson) qs.set("lessonSlug", lesson);
    fetch(`/api/notes?${qs}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setNotes);
  }, [scope, lesson, reload]);

  const q = query.toLowerCase();
  const filtered = notes.filter((n) => !q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q));

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="inline-flex rounded-lg border border-border p-0.5 text-sm">
          {(["mine", "shared"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setScope(t)}
              className={`px-3 py-1 rounded-md cursor-pointer ${scope === t ? "bg-accent text-accent-fg font-semibold" : "text-muted"}`}
            >
              {t === "mine" ? "Mis notas" : "Compartidas"}
            </button>
          ))}
        </div>
        <select className="input !w-auto !py-1.5" value={lesson} onChange={(e) => setLesson(e.target.value)}>
          <option value="">Todas las lecciones</option>
          {lessons.map((l) => (
            <option key={l.slug} value={l.slug}>{l.title}</option>
          ))}
        </select>
        <input className="input !w-56" placeholder="Buscar en notas…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className="btn ml-auto" onClick={() => setCreating(!creating)}>{creating ? "Cerrar" : "+ Nota general"}</button>
      </div>

      {creating && (
        <div className="card p-4">
          <p className="text-sm text-muted mb-2">Nota general (no ligada a una lección). Para notas de una lección, ábrela y usa el panel de notas.</p>
          <NotesPanel editorOnly onSaved={() => setReload((r) => r + 1)} />
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-muted">No hay notas que coincidan.</p>
      ) : (
        <div className="grid gap-3">
          {filtered.map((n) => (
            <article key={n.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{n.title}</h3>
                  <div className="text-xs text-muted mt-0.5">
                    {n.visibility === "SHARED" ? "👥 Compartida" : "🔒 Privada"} · {n.mine ? "tú" : n.user.username} ·{" "}
                    {new Date(n.updatedAt).toLocaleString("es", { dateStyle: "short", timeStyle: "short" })}
                    {n.lessonSlug && (
                      <>
                        {" · "}
                        <Link href={`/learn/${n.lessonSlug}`} className="text-accent">{titles.get(n.lessonSlug) ?? n.lessonSlug}</Link>
                      </>
                    )}
                    {n.pdfPage && (
                      <>
                        {" · "}
                        <Link href={`/book?page=${n.pdfPage}`} className="text-accent">Libro pág. {n.pdfPage}</Link>
                      </>
                    )}
                  </div>
                </div>
              </div>
              {n.body && (
                <div className="mt-2">
                  <Markdown compact>{n.body}</Markdown>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
