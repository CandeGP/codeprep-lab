"use client";

import { useCallback, useEffect, useState } from "react";
import { Markdown } from "./Markdown";

export type Note = {
  id: string;
  title: string;
  body: string;
  visibility: "PRIVATE" | "SHARED";
  lessonSlug: string | null;
  pdfPage: number | null;
  updatedAt: string;
  mine: boolean;
  user: { username: string };
};

type Props = {
  lessonSlug?: string;
  pdfPage?: number;
  /** Texto con el que se precarga una nota nueva (p. ej. título de sección). */
  draftTitle?: string;
  /** Solo muestra el editor de nota nueva (sin listado). */
  editorOnly?: boolean;
  onSaved?: () => void;
};

export function NotesPanel({ lessonSlug, pdfPage, draftTitle, editorOnly, onSaved }: Props) {
  const [tab, setTab] = useState<"mine" | "shared">("mine");
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Note> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ scope: tab });
    if (lessonSlug) qs.set("lessonSlug", lessonSlug);
    if (pdfPage) qs.set("pdfPage", String(pdfPage));
    const res = await fetch(`/api/notes?${qs}`);
    setNotes(res.ok ? await res.json() : []);
    setLoading(false);
  }, [tab, lessonSlug, pdfPage]);

  useEffect(() => {
    if (!editorOnly) load();
  }, [load, editorOnly]);

  useEffect(() => {
    if (draftTitle !== undefined || editorOnly) setEditing({ title: draftTitle ?? "", body: "", visibility: "PRIVATE" });
  }, [draftTitle, editorOnly]);

  async function save() {
    if (!editing?.title?.trim()) return;
    const payload = { title: editing.title, body: editing.body ?? "", visibility: editing.visibility ?? "PRIVATE" };
    const res = editing.id
      ? await fetch(`/api/notes/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, lessonSlug: lessonSlug ?? null, pdfPage: pdfPage ?? null }),
        });
    if (res.ok) {
      onSaved?.();
      if (editorOnly) {
        setEditing({ title: "", body: "", visibility: "PRIVATE" });
        return;
      }
      setEditing(null);
      if (payload.visibility === "SHARED" && tab === "shared") load();
      else if (tab === "mine") load();
      else setTab("mine");
    }
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar esta nota?")) return;
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className={`flex items-center justify-between gap-2 ${editorOnly ? "hidden" : ""}`}>
        <div className="inline-flex rounded-lg border border-border p-0.5 text-sm">
          {(["mine", "shared"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 rounded-md cursor-pointer ${tab === t ? "bg-accent text-accent-fg font-semibold" : "text-muted"}`}
            >
              {t === "mine" ? "Mis notas" : "Compartidas"}
            </button>
          ))}
        </div>
        {!editing && (
          <button className="btn" onClick={() => setEditing({ title: "", body: "", visibility: "PRIVATE" })}>
            + Nota
          </button>
        )}
      </div>

      {editing && (
        <div className="card p-3 space-y-2">
          <input
            className="input"
            placeholder="Título"
            value={editing.title ?? ""}
            onChange={(e) => setEditing({ ...editing, title: e.target.value })}
            autoFocus
          />
          <textarea
            className="input min-h-32 font-mono text-xs"
            placeholder="Escribe en Markdown: **negritas**, `código`, listas, ```bloques```..."
            value={editing.body ?? ""}
            onChange={(e) => setEditing({ ...editing, body: e.target.value })}
          />
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <label className="flex items-center gap-2 text-sm">
              <select
                className="input !w-auto !py-1"
                value={editing.visibility ?? "PRIVATE"}
                onChange={(e) => setEditing({ ...editing, visibility: e.target.value as Note["visibility"] })}
              >
                <option value="PRIVATE">🔒 Privada (solo tú)</option>
                <option value="SHARED">👥 Compartida (todos los usuarios)</option>
              </select>
            </label>
            <div className="flex gap-2">
              {!editorOnly && <button className="btn" onClick={() => setEditing(null)}>Cancelar</button>}
              <button className="btn-primary !py-1.5" onClick={save}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {editorOnly ? null : loading ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-muted">
          {tab === "mine" ? "Aún no tienes notas aquí." : "Nadie ha compartido notas aquí todavía."}
        </p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-sm">{n.title}</div>
                  <div className="text-xs text-muted">
                    {n.visibility === "SHARED" ? "👥" : "🔒"} {n.mine ? "tú" : n.user.username} ·{" "}
                    {new Date(n.updatedAt).toLocaleString("es", { dateStyle: "short", timeStyle: "short" })}
                    {n.pdfPage ? ` · pág. ${n.pdfPage}` : ""}
                  </div>
                </div>
                {n.mine && (
                  <div className="flex gap-1 shrink-0">
                    <button className="text-xs text-muted hover:text-text cursor-pointer" onClick={() => setEditing(n)}>
                      Editar
                    </button>
                    <button className="text-xs text-bad cursor-pointer" onClick={() => remove(n.id)}>
                      Borrar
                    </button>
                  </div>
                )}
              </div>
              {n.body && (
                <div className="mt-2">
                  <Markdown compact>{n.body}</Markdown>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
