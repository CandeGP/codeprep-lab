"use client";

import Link from "next/link";
import Fuse from "fuse.js";
import { useMemo, useState } from "react";

export type IndexLesson = {
  slug: string;
  order: number;
  title: string;
  headings: { id: string; text: string }[];
  problems: { id: string; title: string }[];
};

export type SearchItem = { kind: string; title: string; text: string; href: string };

export function IndexBrowser({ lessons, items }: { lessons: IndexLesson[]; items: SearchItem[] }) {
  const [query, setQuery] = useState("");
  const fuse = useMemo(
    () =>
      new Fuse(items, {
        keys: [
          { name: "title", weight: 3 },
          { name: "text", weight: 1 },
        ],
        threshold: 0.35,
        ignoreLocation: true,
        minMatchCharLength: 2,
      }),
    [items],
  );
  const results = query.trim().length >= 2 ? fuse.search(query.trim()).slice(0, 30) : [];

  return (
    <div className="mt-6">
      <input
        className="input !py-3 !text-base"
        placeholder="Buscar: hash, recursión, BFS, pila, mis notas…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />

      {query.trim().length >= 2 ? (
        <div className="mt-4">
          {results.length === 0 ? (
            <p className="text-sm text-muted">Sin resultados.</p>
          ) : (
            <ul className="card divide-y divide-border">
              {results.map(({ item }, i) => (
                <li key={i}>
                  <Link href={item.href} className="block px-4 py-3 hover:bg-surface-2">
                    <div className="flex items-center gap-2">
                      <span className="chip">{item.kind}</span>
                      <span className="font-medium">{item.title}</span>
                    </div>
                    {item.text && <p className="text-xs text-muted mt-1 line-clamp-2">{item.text}</p>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <ol className="mt-6 space-y-3">
          {lessons.map((l) => (
            <li key={l.slug} className="card p-4">
              <Link href={`/learn/${l.slug}`} className="font-semibold hover:text-accent">
                <span className="font-mono text-muted text-sm mr-2">{String(l.order).padStart(2, "0")}</span>
                {l.title}
              </Link>
              <ul className="mt-2 ml-8 grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                {l.headings.map((h) => (
                  <li key={h.id}>
                    <Link href={`/learn/${l.slug}#${h.id}`} className="text-muted hover:text-text">{h.text}</Link>
                  </li>
                ))}
              </ul>
              {l.problems.length > 0 && (
                <div className="mt-3 ml-8 flex flex-wrap gap-2">
                  {l.problems.map((p) => (
                    <Link key={p.id} href={`/practice/${p.id}`} className="chip hover:border-accent hover:text-text">
                      {"</>"} {p.title}
                    </Link>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
