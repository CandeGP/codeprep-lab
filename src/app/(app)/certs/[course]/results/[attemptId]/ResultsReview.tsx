"use client";

import { useState } from "react";
import { LangToggle, QuestionView, jsonFetch, saveLang } from "@/components/certs/QuestionView";
import { formatDuration, textOf, type ClientQuestion, type Lang, type Reveal } from "@/lib/certs/shared";

export type ReviewItem = {
  n: number;
  q: ClientQuestion;
  reveal: Reveal;
  selected: number[];
  correct: boolean;
  answered: boolean;
  flagged: boolean;
  pending: boolean;
  timeMs: number;
};

type Filter = "wrong" | "flagged" | "pending" | "all" | "right";

export function ResultsReview({ items, initialLang }: { items: ReviewItem[]; initialLang: Lang }) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [filter, setFilter] = useState<Filter>(items.some((i) => !i.correct) ? "wrong" : "all");
  const [pending, setPending] = useState(() => new Set(items.filter((i) => i.pending).map((i) => i.q.id)));
  const [open, setOpen] = useState<Set<string>>(new Set());

  const counts = {
    wrong: items.filter((i) => !i.correct).length,
    flagged: items.filter((i) => i.flagged).length,
    pending: items.filter((i) => pending.has(i.q.id)).length,
    all: items.length,
    right: items.filter((i) => i.correct).length,
  };
  const list = items.filter((i) =>
    filter === "wrong"
      ? !i.correct
      : filter === "flagged"
        ? i.flagged
        : filter === "pending"
          ? pending.has(i.q.id)
          : filter === "right"
            ? i.correct
            : true,
  );

  async function togglePending(id: string) {
    const on = !pending.has(id);
    setPending((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
    await (on
      ? jsonFetch("/api/certs/marks", { method: "POST", json: { questionId: id } })
      : jsonFetch(`/api/certs/marks?questionId=${encodeURIComponent(id)}`, { method: "DELETE" }));
  }

  const tabs: [Filter, string][] = [
    ["wrong", "Falladas"],
    ["flagged", "Marcadas"],
    ["pending", "Pendientes"],
    ["right", "Correctas"],
    ["all", "Todas"],
  ];

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        {tabs.map(([f, label]) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`btn ${filter === f ? "!border-accent !bg-accent/10 !text-accent" : ""}`}
          >
            {label} <span className="text-muted">{counts[f]}</span>
          </button>
        ))}
        <div className="flex-1" />
        <LangToggle
          lang={lang}
          hasEs={items.some((i) => i.q.text.es)}
          onChange={(l) => {
            setLang(l);
            saveLang(l);
          }}
        />
        <button className="btn" onClick={() => setOpen(new Set(list.map((i) => i.q.id)))}>
          Expandir todas
        </button>
      </div>

      {list.length === 0 && <p className="text-sm text-muted mt-4">No hay preguntas en esta vista.</p>}

      <ul className="mt-4 space-y-3">
        {list.map((it) => {
          const isOpen = open.has(it.q.id);
          return (
            <li key={it.q.id} className={`card ${it.correct ? "" : "border-bad/40"}`}>
              <button
                className="w-full text-left px-4 py-3 flex items-start gap-3"
                onClick={() =>
                  setOpen((s) => {
                    const n = new Set(s);
                    if (isOpen) n.delete(it.q.id);
                    else n.add(it.q.id);
                    return n;
                  })
                }
              >
                <span className={`font-bold ${it.correct ? "text-ok" : "text-bad"}`}>{it.correct ? "✓" : "✗"}</span>
                <span className="text-muted text-sm">{it.n}.</span>
                <span className={`flex-1 text-sm line-clamp-2 ${isOpen ? "text-muted" : ""}`}>
                  {isOpen ? it.q.topics.join(" · ") : textOf(it.q.text, lang).stem}
                </span>
                {it.flagged && <span className="text-warn text-xs">⚑</span>}
                {!it.answered && <span className="chip">sin responder</span>}
                <span className="text-xs text-muted">{it.timeMs ? formatDuration(it.timeMs) : ""}</span>
                <span className="text-muted">{isOpen ? "▾" : "▸"}</span>
              </button>
              {isOpen && (
                <div className="px-4 pb-4 border-t border-border pt-4">
                  <p className="text-[1.02rem] leading-relaxed whitespace-pre-line mb-3">{textOf(it.q.text, lang).stem}</p>
                  <QuestionView q={it.q} selected={it.selected} reveal={it.reveal} lang={lang} hideStem />
                  <div className="mt-3 flex gap-2">
                    <button
                      className={`btn ${pending.has(it.q.id) ? "!border-accent !text-accent" : ""}`}
                      onClick={() => togglePending(it.q.id)}
                    >
                      ★ {pending.has(it.q.id) ? "Pendiente" : "Marcar pendiente"}
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
