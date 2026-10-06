"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Heading, QuizQuestion } from "@/lib/content";
import { BookmarkButton } from "@/components/BookmarkButton";
import { NotesPanel } from "@/components/NotesPanel";
import { ChatPanel } from "@/components/ChatPanel";
import { useAiEnabled } from "@/components/AiContext";
import { QuizCard } from "@/components/Quiz";

type Props = {
  lesson: { slug: string; title: string; summary: string; order: number; html: string; headings: Heading[] };
  quiz: QuizQuestion[];
  problems: { id: string; title: string; difficulty: string }[];
  completed: boolean;
  savedRefs: string[];
  prev: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
};

type Panel = "notes" | "ai" | null;

export function LessonView({ lesson, quiz, problems, completed: initialCompleted, savedRefs, prev, next }: Props) {
  const ai = useAiEnabled();
  const [completed, setCompleted] = useState(initialCompleted);
  const [panel, setPanel] = useState<Panel>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [selection, setSelection] = useState<{ text: string; x: number; y: number } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string | undefined>();
  const contentRef = useRef<HTMLDivElement>(null);
  const saved = new Set(savedRefs);

  // Resalta en el índice la sección visible.
  useEffect(() => {
    const els = lesson.headings.map((h) => document.getElementById(h.id)).filter(Boolean) as HTMLElement[];
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "0px 0px -70% 0px" },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [lesson.headings]);

  // Scroll al hash (#seccion) al llegar desde Guardados/Índice.
  useEffect(() => {
    if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
  }, []);

  // Menú flotante al seleccionar texto dentro de la lección.
  function onMouseUp() {
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? "";
    if (!sel || text.length < 3 || !contentRef.current?.contains(sel.anchorNode)) {
      setSelection(null);
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setSelection({ text: text.slice(0, 2000), x: rect.left + rect.width / 2, y: rect.top });
  }

  async function toggleComplete() {
    const res = await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonSlug: lesson.slug, completed: !completed }),
    });
    if (res.ok) setCompleted(!completed);
  }

  return (
    <div className="flex">
      {/* Índice de la lección */}
      <aside className="hidden xl:block w-60 shrink-0 sticky top-0 h-screen overflow-y-auto border-r border-border px-4 py-8">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">En esta lección</div>
        <ul className="space-y-1 text-sm">
          {lesson.headings.map((h) => (
            <li key={h.id} className={`flex items-start gap-1.5 ${h.depth === 3 ? "pl-3" : ""}`}>
              <a
                href={`#${h.id}`}
                className={`flex-1 py-0.5 ${activeId === h.id ? "text-accent font-medium" : "text-muted hover:text-text"}`}
              >
                {h.text}
              </a>
              <BookmarkButton
                small
                type="SECTION"
                refId={`${lesson.slug}#${h.id}`}
                label={`${lesson.title} › ${h.text}`}
                initial={saved.has(`SECTION:${lesson.slug}#${h.id}`)}
              />
            </li>
          ))}
          {quiz.length > 0 && (
            <li><a href="#quiz" className="text-muted hover:text-text">Autoevaluación</a></li>
          )}
          {problems.length > 0 && (
            <li><a href="#ejercicios" className="text-muted hover:text-text">Ejercicios</a></li>
          )}
        </ul>
      </aside>

      {/* Contenido */}
      <article className="flex-1 min-w-0 px-4 md:px-10 py-8" onMouseUp={onMouseUp}>
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Link href="/learn" className="hover:text-text">Aprender</Link>
            <span>/</span>
            <span>Lección {lesson.order}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mt-2 tracking-tight">{lesson.title}</h1>
          <p className="text-muted mt-2">{lesson.summary}</p>
          <div className="flex flex-wrap gap-2 mt-4">
            <BookmarkButton type="LESSON" refId={lesson.slug} label={lesson.title} initial={saved.has(`LESSON:${lesson.slug}`)} />
            <button className="btn" onClick={() => setPanel(panel === "notes" ? null : "notes")}>✎ Notas</button>
            {ai && <button className="btn" onClick={() => setPanel(panel === "ai" ? null : "ai")}>✦ Preguntar a la IA</button>}
            <button className={`btn ${completed ? "!border-ok text-ok" : ""}`} onClick={toggleComplete}>
              {completed ? "✓ Completada" : "Marcar como completada"}
            </button>
          </div>
          <p className="text-xs text-muted mt-3">
            Tip: selecciona cualquier texto para {ai ? "preguntarle a la IA o " : ""}crear una nota sobre él.
          </p>

          <div ref={contentRef} className="prose-lesson mt-6" dangerouslySetInnerHTML={{ __html: lesson.html }} />

          {quiz.length > 0 && (
            <section id="quiz" className="mt-14 scroll-mt-20">
              <h2 className="text-2xl font-bold">Autoevaluación</h2>
              <p className="text-sm text-muted mt-1">Tus respuestas alimentan la sección de Repasar (repetición espaciada).</p>
              <div className="space-y-3 mt-4">
                {quiz.map((q, i) => (
                  <QuizCard key={q.id} q={q} index={i} />
                ))}
              </div>
            </section>
          )}

          {problems.length > 0 && (
            <section id="ejercicios" className="mt-14 scroll-mt-20">
              <h2 className="text-2xl font-bold">Ejercicios de código</h2>
              <div className="grid sm:grid-cols-2 gap-3 mt-4">
                {problems.map((p) => (
                  <Link key={p.id} href={`/practice/${p.id}`} className="card p-4 hover:border-accent">
                    <div className="font-semibold">{p.title}</div>
                    <DifficultyChip d={p.difficulty} />
                  </Link>
                ))}
              </div>
            </section>
          )}

          <nav className="flex justify-between gap-4 mt-14 pt-6 border-t border-border text-sm">
            {prev ? (
              <Link href={`/learn/${prev.slug}`} className="hover:text-accent">← {prev.title}</Link>
            ) : <span />}
            {next ? (
              <Link href={`/learn/${next.slug}`} className="hover:text-accent text-right">{next.title} →</Link>
            ) : <span />}
          </nav>
        </div>
      </article>

      {/* Panel lateral: notas / IA */}
      {panel && (
        <aside className="fixed inset-0 z-40 md:inset-auto md:right-0 md:top-0 md:h-screen md:w-[26rem] bg-bg md:border-l border-border flex flex-col">
          <div className="flex items-center justify-between px-4 h-14 border-b border-border">
            <div className="inline-flex rounded-lg border border-border p-0.5 text-sm">
              <button onClick={() => setPanel("notes")} className={`px-3 py-1 rounded-md cursor-pointer ${panel === "notes" ? "bg-surface-2 font-semibold" : "text-muted"}`}>Notas</button>
              {ai && <button onClick={() => setPanel("ai")} className={`px-3 py-1 rounded-md cursor-pointer ${panel === "ai" ? "bg-surface-2 font-semibold" : "text-muted"}`}>IA</button>}
            </div>
            <button className="btn" onClick={() => setPanel(null)}>✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {panel === "notes" || !ai ? (
              <NotesPanel lessonSlug={lesson.slug} draftTitle={noteDraft} />
            ) : (
              <ChatPanel
                lessonSlug={lesson.slug}
                focus={focus}
                onClearFocus={() => setFocus(null)}
                tall
                suggestions={["Resúmeme esta lección en 5 puntos", "Dame un ejercicio para practicar", "¿Qué suelen preguntar en entrevistas sobre esto?"]}
              />
            )}
          </div>
        </aside>
      )}

      {selection && (
        <div
          className="fixed z-50 -translate-x-1/2 -translate-y-full flex gap-1 rounded-lg border border-border bg-surface shadow-lg p-1"
          style={{ left: selection.x, top: selection.y - 6 }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {ai && (
            <button
              className="btn !border-0 !text-xs"
              onClick={() => {
                setFocus(selection.text);
                setPanel("ai");
                setSelection(null);
              }}
            >
              ✦ Preguntar a la IA
            </button>
          )}
          <button
            className="btn !border-0 !text-xs"
            onClick={() => {
              setNoteDraft(`Sobre: "${selection.text.slice(0, 80)}${selection.text.length > 80 ? "…" : ""}"`);
              setPanel("notes");
              setSelection(null);
            }}
          >
            ✎ Crear nota
          </button>
        </div>
      )}
    </div>
  );
}

export function DifficultyChip({ d }: { d: string }) {
  const color = d === "fácil" ? "text-ok" : d === "media" ? "text-warn" : "text-bad";
  return <span className={`text-xs font-semibold ${color}`}>{d}</span>;
}
