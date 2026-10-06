"use client";

import Fuse from "fuse.js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { jsonFetch } from "@/components/certs/QuestionView";

type Item = {
  slug: string;
  title: string;
  code: string;
  provider: string;
  description: string;
  source: string;
  questions: number;
  flashcards: number;
  topics: number;
  attempts: number;
  lastScore: number | null;
  passingPct: number;
  due: number;
};

export function CourseSearch({ courses, aiEnabled }: { courses: Item[]; aiEnabled: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fuse = useMemo(
    () => new Fuse(courses, { keys: ["title", "code", "provider", "description"], threshold: 0.35, ignoreLocation: true }),
    [courses],
  );
  const results = query.trim() ? fuse.search(query.trim()).map((r) => r.item) : courses;

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const { slug } = await jsonFetch<{ slug: string }>("/api/certs/courses", { method: "POST", json: { query } });
      router.push(`/certs/${slug}?nuevo=1`);
    } catch (err) {
      setError((err as Error).message);
      setCreating(false);
    }
  }

  return (
    <div className="mt-6">
      <input
        className="input !py-3 !text-base"
        placeholder="Busca un curso o examen: cloud practitioner, SAA-C03, AZ-900, CKA…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />

      <div className="grid md:grid-cols-2 gap-4 mt-4">
        {results.map((c) => (
          <Link key={c.slug} href={`/certs/${c.slug}`} className="card p-5 hover:border-accent flex flex-col">
            <div className="flex items-center gap-2">
              <span className="chip !text-accent !border-accent/40">{c.provider}</span>
              <span className="chip font-mono">{c.code}</span>
              {c.source === "AI" && <span className="chip">✦ generado con IA</span>}
              {c.due > 0 && (
                <span className="ml-auto rounded-full bg-accent text-accent-fg text-[10px] font-bold px-2 py-0.5">
                  {c.due} por repasar
                </span>
              )}
            </div>
            <div className="text-lg font-semibold mt-2">{c.title}</div>
            <p className="text-sm text-muted mt-1 line-clamp-2 flex-1">{c.description}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted mt-3">
              <span>{c.questions} preguntas</span>
              <span>{c.flashcards} flashcards</span>
              <span>{c.topics} temas</span>
              {c.attempts > 0 && (
                <span>
                  Último:{" "}
                  <b className={c.lastScore! >= c.passingPct ? "text-ok" : "text-bad"}>{c.lastScore}%</b> · {c.attempts} intento
                  {c.attempts === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>

      {query.trim().length >= 2 && (
        <div className="card p-5 mt-4 border-dashed">
          <div className="font-semibold">¿No está el curso que buscas?</div>
          {aiEnabled && (
            <p className="text-sm text-muted mt-1">
              La IA arma la estructura oficial del examen (dominios, pesos y temas) de <b>“{query.trim()}”</b> y después
              puedes generar preguntas y flashcards en lotes de 10.
            </p>
          )}
          {aiEnabled ? (
            <button className="btn-primary mt-3" onClick={create} disabled={creating}>
              {creating ? "Creando curso… (puede tardar un minuto)" : "✦ Crear curso con IA"}
            </button>
          ) : (
            <p className="text-sm text-muted mt-3">Pídele al administrador que lo cree.</p>
          )}
          {error && <p className="text-sm text-bad mt-2">{error}</p>}
        </div>
      )}
    </div>
  );
}
