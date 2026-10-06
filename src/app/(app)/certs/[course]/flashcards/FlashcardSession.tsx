"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LangToggle, jsonFetch, saveLang } from "@/components/certs/QuestionView";
import { textOf, type Lang } from "@/lib/certs/shared";
import { GeneratorStatus, useGenerator } from "@/components/certs/Generator";

type CardText = { front: string; back: string };
type Card = { id: string; text: { en: CardText; es?: CardText }; topic: string | null; isNew: boolean };

const RATINGS = [
  { q: 1, label: "Otra vez", key: "1", cls: "!border-bad !text-bad" },
  { q: 3, label: "Difícil", key: "2", cls: "!border-warn !text-warn" },
  { q: 4, label: "Bien", key: "3", cls: "!border-ok !text-ok" },
  { q: 5, label: "Fácil", key: "4", cls: "!border-accent !text-accent" },
];

export function FlashcardSession({
  cards,
  nextDueAt,
  totalCards,
  courseSlug,
  aiEnabled,
  initialLang,
}: {
  cards: Card[];
  nextDueAt: string | null;
  totalCards: number;
  courseSlug: string;
  aiEnabled: boolean;
  initialLang: Lang;
}) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [queue, setQueue] = useState(cards);
  const [flipped, setFlipped] = useState(false);
  const [stats, setStats] = useState({ done: 0, again: 0 });
  const gen = useGenerator(courseSlug);
  const card = queue[0];

  async function rate(q: number) {
    if (!card) return;
    setFlipped(false);
    // "Otra vez" la regresa al final de esta misma sesión.
    setQueue((s) => (q < 3 ? [...s.slice(1), s[0]] : s.slice(1)));
    setStats((s) => ({ done: s.done + (q < 3 ? 0 : 1), again: s.again + (q < 3 ? 1 : 0) }));
    jsonFetch("/api/certs/cards", { method: "POST", json: { itemType: "FLASHCARD", itemId: card.id, quality: q } }).catch(() => {});
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!card) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped) {
        const r = RATINGS.find((r) => r.key === e.key);
        if (r) rate(r.q);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (totalCards === 0) {
    return (
      <div className="card p-6 mt-6 text-center">
        <div className="font-semibold">Este curso aún no tiene flashcards.</div>
        {aiEnabled ? (
          <>
            <button className="btn-primary mt-3" disabled={gen.running} onClick={() => gen.run({ kind: "flashcards", target: 30 })}>
              ✦ Generar 30 flashcards con IA
            </button>
            <GeneratorStatus g={gen} label="flashcards" />
          </>
        ) : (
          <p className="text-sm text-muted mt-1">Configura ANTHROPIC_API_KEY para generarlas con IA.</p>
        )}
      </div>
    );
  }

  if (!card) {
    return (
      <div className="card p-6 mt-6 text-center">
        <div className="text-lg font-semibold">{stats.done > 0 ? "¡Sesión terminada! 🎉" : "Nada pendiente por ahora"}</div>
        <p className="text-sm text-muted mt-1">
          {stats.done > 0 && `${stats.done} tarjetas repasadas${stats.again ? ` · ${stats.again} repeticiones` : ""}. `}
          {nextDueAt && `Tu próxima tarjeta vence el ${new Date(nextDueAt).toLocaleString("es")}.`}
        </p>
        <div className="flex justify-center gap-2 mt-4">
          <Link href={`/certs/${courseSlug}/flashcards?todas=1`} className="btn">Repaso libre</Link>
          <Link href={`/certs/${courseSlug}`} className="btn">Volver al curso</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex justify-between text-sm text-muted mb-2">
        <span>{queue.length} restantes</span>
        <span className="flex items-center gap-2">
          {card.isNew && <span className="chip">nueva</span>}
          {card.topic}
          <LangToggle
            lang={lang}
            hasEs={!!card.text.es}
            onChange={(l) => {
              setLang(l);
              saveLang(l);
            }}
          />
        </span>
      </div>
      <button
        onClick={() => setFlipped((f) => !f)}
        className="card w-full min-h-64 p-8 flex flex-col items-center justify-center text-center hover:border-accent transition-colors"
      >
        <div className="text-xl font-semibold leading-snug">{textOf(card.text, lang).front}</div>
        {flipped ? (
          <div className="mt-6 pt-6 border-t border-border w-full text-base leading-relaxed whitespace-pre-line">{textOf(card.text, lang).back}</div>
        ) : (
          <div className="text-xs text-muted mt-6">Toca o presiona espacio para ver la respuesta</div>
        )}
      </button>
      {flipped && (
        <div className="grid grid-cols-4 gap-2 mt-4">
          {RATINGS.map((r) => (
            <button key={r.q} className={`btn ${r.cls}`} onClick={() => rate(r.q)}>
              {r.label} <span className="text-xs text-muted hidden sm:inline">({r.key})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
