"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { LangToggle, QuestionView, jsonFetch, saveLang } from "@/components/certs/QuestionView";
import { formatDuration, textOf, type AnswerState, type ClientQuestion, type Lang, type Reveal } from "@/lib/certs/shared";

const CHUNK = 10;

type Props = {
  attemptId: string;
  courseSlug: string;
  courseCode: string;
  title: string;
  mode: "INSTANT" | "END";
  ids: string[];
  initialAnswers: Record<string, AnswerState>;
  initialPending: string[];
  deadline: string | null;
  serverNow: number;
  lang: Lang;
  /** Simulación exacta: 65 preguntas, tiempo real y pantalla de revisión final. */
  exact: boolean;
};

export function ExamRunner(p: Props) {
  const router = useRouter();
  const total = p.ids.length;
  const instant = p.mode === "INSTANT";

  const [questions, setQuestions] = useState<Record<string, ClientQuestion>>({});
  const [reveals, setReveals] = useState<Record<string, Reveal>>({});
  const [answers, setAnswers] = useState<Record<string, AnswerState>>(p.initialAnswers);
  const [pending, setPending] = useState(() => new Set(p.initialPending));
  const [index, setIndex] = useState(() => {
    const first = p.ids.findIndex((id) => !p.initialAnswers[id]?.selected.length);
    return first === -1 ? 0 : first;
  });
  const [draft, setDraft] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [reported, setReported] = useState<Set<string>>(new Set());
  const [lang, setLang] = useState<Lang>(p.lang);
  const [reviewFilter, setReviewFilter] = useState<"all" | "unanswered" | "flagged">("all");

  const requested = useRef(new Set<number>());
  const inflight = useRef(new Set<Promise<unknown>>());
  const saveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const shownAt = useRef(Date.now());

  const qid = p.ids[index];
  const q = questions[qid];
  const answer = answers[qid];
  const reveal = instant ? reveals[qid] : undefined;

  // ---------- carga por bloques de 10 ----------
  const loadChunk = useCallback(
    async (offset: number) => {
      if (offset >= total || requested.current.has(offset)) return;
      requested.current.add(offset);
      try {
        const r = await jsonFetch<{ questions: ClientQuestion[]; reveals: Record<string, Reveal> }>(
          `/api/certs/attempts/${p.attemptId}/questions?offset=${offset}&limit=${CHUNK}`,
        );
        setQuestions((s) => ({ ...s, ...Object.fromEntries(r.questions.map((x) => [x.id, x])) }));
        setReveals((s) => ({ ...s, ...r.reveals }));
      } catch (err) {
        requested.current.delete(offset);
        setError((err as Error).message);
      }
    },
    [p.attemptId, total],
  );

  useEffect(() => {
    const chunk = Math.floor(index / CHUNK) * CHUNK;
    loadChunk(chunk);
    if (index % CHUNK >= CHUNK - 4) loadChunk(chunk + CHUNK);
    shownAt.current = Date.now();
    setDraft([]);
  }, [index, loadChunk]);

  // En la pantalla de revisión se muestran todos los enunciados: carga los bloques que falten.
  useEffect(() => {
    if (!confirming || instant) return;
    for (let o = 0; o < total; o += CHUNK) loadChunk(o);
  }, [confirming, instant, total, loadChunk]);

  // ---------- guardado ----------
  function track<T>(promise: Promise<T>) {
    inflight.current.add(promise);
    setSaving((n) => n + 1);
    promise
      .catch((err) => setError((err as Error).message))
      .finally(() => {
        inflight.current.delete(promise);
        setSaving((n) => n - 1);
      });
    return promise;
  }

  function put(body: Record<string, unknown>) {
    return track(jsonFetch<{ correct?: boolean; reveal?: Reveal }>(`/api/certs/attempts/${p.attemptId}/answers`, { method: "PUT", json: body }));
  }

  function elapsed() {
    const ms = Date.now() - shownAt.current;
    shownAt.current = Date.now();
    return Math.min(ms, 3_600_000);
  }

  function nextSelection(cur: number[], i: number, pick: number) {
    if (pick <= 1) return [i];
    if (cur.includes(i)) return cur.filter((x) => x !== i);
    return cur.length >= pick ? [...cur.slice(1), i] : [...cur, i];
  }

  function select(i: number) {
    if (!q || i >= q.text.en.options.length) return;
    if (instant) {
      if (reveal) return;
      setDraft((d) => nextSelection(d, i, q.pick));
      return;
    }
    const next = nextSelection(answer?.selected ?? [], i, q.pick);
    setAnswers((s) => ({ ...s, [qid]: { ...(s[qid] ?? { flagged: false }), selected: next } }));
    // Guardado con debounce por pregunta (evita una petición por cada clic).
    const timers = saveTimers.current;
    clearTimeout(timers.get(qid));
    const id = qid;
    timers.set(
      qid,
      setTimeout(() => {
        timers.delete(id);
        put({ questionId: id, selected: next, timeMs: elapsed() });
      }, 350),
    );
  }

  async function submitInstant() {
    if (!q || reveal || draft.length !== q.pick) return;
    const selected = draft;
    const r = await put({ questionId: qid, selected, timeMs: elapsed() }).catch(() => null);
    if (!r) return;
    setAnswers((s) => ({ ...s, [qid]: { ...(s[qid] ?? { flagged: false }), selected, correct: r.correct } }));
    if (r.reveal) setReveals((s) => ({ ...s, [qid]: r.reveal! }));
  }

  function toggleFlag() {
    const flagged = !answer?.flagged;
    setAnswers((s) => ({ ...s, [qid]: { ...(s[qid] ?? { selected: [] }), flagged } }));
    put({ questionId: qid, flagged });
  }

  function togglePending() {
    const on = !pending.has(qid);
    setPending((s) => {
      const n = new Set(s);
      if (on) n.add(qid);
      else n.delete(qid);
      return n;
    });
    track(
      on
        ? jsonFetch("/api/certs/marks", { method: "POST", json: { questionId: qid } })
        : jsonFetch(`/api/certs/marks?questionId=${encodeURIComponent(qid)}`, { method: "DELETE" }),
    );
  }

  async function report() {
    if (reported.has(qid)) return;
    if (!confirm("¿Reportar esta pregunta como incorrecta o confusa? Dejará de salir hasta que se revise.")) return;
    await track(jsonFetch(`/api/certs/questions/${encodeURIComponent(qid)}/report`, { method: "POST" }));
    setReported((s) => new Set(s).add(qid));
  }

  const finish = useCallback(async () => {
    setFinishing(true);
    // Envía los guardados pendientes antes de cerrar.
    for (const [id, t] of saveTimers.current) {
      clearTimeout(t);
      saveTimers.current.delete(id);
      const sel = answers[id]?.selected;
      if (sel) put({ questionId: id, selected: sel });
    }
    await Promise.allSettled([...inflight.current]);
    try {
      await jsonFetch(`/api/certs/attempts/${p.attemptId}/finish`, { method: "POST" });
      router.push(`/certs/${p.courseSlug}/results/${p.attemptId}`);
    } catch (err) {
      setError((err as Error).message);
      setFinishing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, p.attemptId, p.courseSlug, router]);

  // ---------- temporizador ----------
  const skew = useRef(p.serverNow - Date.now());
  const [remaining, setRemaining] = useState<number | null>(null);
  const finishRef = useRef(finish);
  finishRef.current = finish;
  useEffect(() => {
    if (!p.deadline) return;
    const end = new Date(p.deadline).getTime();
    let fired = false;
    const tick = () => {
      const left = end - (Date.now() + skew.current);
      setRemaining(left);
      if (left <= 0 && !fired) {
        fired = true;
        finishRef.current();
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [p.deadline]);

  // ---------- navegación ----------
  const go = useCallback((i: number) => setIndex(Math.max(0, Math.min(total - 1, i))), [total]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (confirming || finishing) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const k = e.key.toLowerCase();
      if (k === "arrowright") go(index + 1);
      else if (k === "arrowleft") go(index - 1);
      else if (/^[1-6]$/.test(k)) select(Number(k) - 1);
      else if (/^[a-f]$/.test(k) && k !== "f") select(k.charCodeAt(0) - 97);
      else if (k === "f") toggleFlag();
      else if (k === "enter") {
        if (instant && !reveal) submitInstant();
        else go(index + 1);
      } else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---------- métricas ----------
  const answeredCount = p.ids.filter((id) => answers[id]?.selected.length).length;
  const flaggedCount = p.ids.filter((id) => answers[id]?.flagged).length;
  const okCount = p.ids.filter((id) => answers[id]?.correct).length;
  const selectedNow = instant ? (reveal ? (answer?.selected ?? []) : draft) : (answer?.selected ?? []);
  const lowTime = remaining !== null && remaining < 5 * 60 * 1000;

  return (
    <div className="min-h-screen">
      {/* Barra superior */}
      <div className="sticky top-14 md:top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 md:px-8 h-14 flex items-center gap-3">
          <Link href={`/certs/${p.courseSlug}`} className="text-muted hover:text-accent text-sm" title="Salir (tu avance queda guardado)">
            ←
          </Link>
          <span className="chip font-mono hidden sm:inline-flex">{p.courseCode}</span>
          <span className="font-semibold truncate flex-1 text-sm">{p.title}</span>
          <LangToggle
            lang={lang}
            hasEs={!q || !!q.text.es}
            onChange={(l) => {
              setLang(l);
              saveLang(l);
            }}
          />
          <span className="text-xs text-muted hidden sm:inline">{saving > 0 ? "Guardando…" : "Guardado ✓"}</span>
          {instant && (
            <span className="text-sm">
              <span className="text-ok font-semibold">{okCount}</span>
              <span className="text-muted">/{answeredCount}</span>
            </span>
          )}
          {remaining !== null && (
            <span className={`font-mono text-sm px-2 py-1 rounded ${lowTime ? "bg-bad/15 text-bad" : "bg-surface-2"}`}>
              ⏱ {formatDuration(remaining)}
            </span>
          )}
          <button className="btn-primary !py-1.5" onClick={() => setConfirming(true)} disabled={finishing}>
            Terminar
          </button>
        </div>
        <div className="h-1 bg-surface-2">
          <div className="h-full bg-accent transition-all" style={{ width: `${(answeredCount / total) * 100}%` }} />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 grid lg:grid-cols-[1fr_260px] gap-6">
        <div>
          <div className="flex items-center justify-between text-sm text-muted mb-3">
            <span>
              Pregunta <b className="text-text">{index + 1}</b> de {total}
            </span>
            <span className="text-xs">{instant ? "Modo práctica" : "Modo examen"}</span>
          </div>

          <div className="card p-5 md:p-6">
            {q ? (
              <QuestionView q={q} selected={selectedNow} reveal={reveal} onToggle={select} disabled={finishing} lang={lang} />
            ) : (
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-surface-2 rounded w-1/3" />
                <div className="h-5 bg-surface-2 rounded" />
                <div className="h-5 bg-surface-2 rounded w-5/6" />
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-11 bg-surface-2 rounded" />
                ))}
              </div>
            )}
            {instant && reveal && answer?.correct !== undefined && (
              <div className={`mt-4 font-semibold ${answer.correct ? "text-ok" : "text-bad"}`}>
                {answer.correct ? "✓ ¡Correcto!" : "✗ Incorrecto"}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-4">
            <button className="btn" onClick={() => go(index - 1)} disabled={index === 0}>
              ← Anterior
            </button>
            {instant && !reveal ? (
              <button className="btn-primary" onClick={submitInstant} disabled={!q || draft.length !== q.pick}>
                {q && q.pick > 1 && draft.length !== q.pick ? `Elige ${q.pick}` : "Responder"}
              </button>
            ) : index < total - 1 ? (
              <button className="btn-primary" onClick={() => go(index + 1)}>
                Siguiente →
              </button>
            ) : (
              <button className="btn-primary" onClick={() => setConfirming(true)}>
                Terminar examen
              </button>
            )}
            {instant && !reveal && index < total - 1 && (
              <button className="btn" onClick={() => go(index + 1)}>
                Saltar
              </button>
            )}
            <div className="flex-1" />
            <button
              className={`btn ${answer?.flagged ? "!border-warn !text-warn" : ""}`}
              onClick={toggleFlag}
              title="Marcar para revisar antes de terminar (F)"
            >
              ⚑ {answer?.flagged ? "Marcada" : "Revisar después"}
            </button>
            <button
              className={`btn ${pending.has(qid) ? "!border-accent !text-accent" : ""}`}
              onClick={togglePending}
              title="Guardar como pendiente para estudiarla después"
            >
              ★ {pending.has(qid) ? "Pendiente" : "Marcar pendiente"}
            </button>
            <button className="btn !text-muted" onClick={report} disabled={reported.has(qid)} title="Reportar error">
              {reported.has(qid) ? "Reportada" : "⚠"}
            </button>
          </div>
          <p className="text-xs text-muted mt-3 hidden md:block">
            Atajos: 1-6 o A-E elegir · Enter {instant ? "responder / siguiente" : "siguiente"} · ←/→ navegar · F revisar después
          </p>
          {error && (
            <p className="text-sm text-bad mt-3">
              {error}{" "}
              <button className="underline" onClick={() => setError(null)}>
                ocultar
              </button>
            </p>
          )}
        </div>

        {/* Navegador de preguntas */}
        <aside className="card p-4 h-fit lg:sticky lg:top-20">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>
              {answeredCount}/{total} respondidas
            </span>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} />
              ⚑ {flaggedCount}
            </label>
          </div>
          <div className="grid grid-cols-8 lg:grid-cols-6 gap-1.5 mt-3">
            {p.ids.map((id, i) => {
              const a = answers[id];
              if (onlyFlagged && !a?.flagged) return null;
              const done = !!a?.selected.length;
              const color =
                instant && done && a?.correct !== undefined
                  ? a.correct
                    ? "bg-ok/20 border-ok text-ok"
                    : "bg-bad/15 border-bad text-bad"
                  : done
                    ? "bg-accent/15 border-accent/50"
                    : "border-border";
              return (
                <button
                  key={id}
                  onClick={() => go(i)}
                  className={`relative h-8 rounded border text-xs font-medium ${color} ${
                    i === index ? "ring-2 ring-accent ring-offset-1 ring-offset-surface" : ""
                  }`}
                >
                  {i + 1}
                  {a?.flagged && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-warn" />}
                </button>
              );
            })}
          </div>
          <div className="text-[11px] text-muted mt-3 space-y-0.5">
            <div>
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-accent/30 mr-1" />
              respondida
            </div>
            <div>
              <span className="inline-block w-2 h-2 rounded-full bg-warn mr-1" />
              para revisar
            </div>
          </div>
        </aside>
      </div>

      {confirming && !instant && (
        <div className="fixed inset-0 z-50 bg-bg overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold flex-1">{p.exact ? "Revisión del examen" : "Revisión antes de entregar"}</h2>
              {remaining !== null && (
                <span className={`font-mono text-sm px-2 py-1 rounded ${lowTime ? "bg-bad/15 text-bad" : "bg-surface-2"}`}>
                  ⏱ {formatDuration(remaining)}
                </span>
              )}
            </div>
            <p className="text-sm text-muted mt-1">
              {answeredCount} de {total} respondidas · {total - answeredCount} sin responder · {flaggedCount} marcadas para revisar.
              Selecciona una pregunta para volver a ella.
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              {(
                [
                  ["all", `Todas (${total})`],
                  ["unanswered", `Sin responder (${total - answeredCount})`],
                  ["flagged", `Marcadas (${flaggedCount})`],
                ] as const
              ).map(([f, label]) => (
                <button
                  key={f}
                  className={`btn ${reviewFilter === f ? "!border-accent !bg-accent/10 !text-accent" : ""}`}
                  onClick={() => setReviewFilter(f)}
                >
                  {label}
                </button>
              ))}
            </div>
            <ul className="card mt-4 divide-y divide-border">
              {p.ids.map((id, i) => {
                const a = answers[id];
                const done = !!a?.selected.length;
                if (reviewFilter === "unanswered" && done) return null;
                if (reviewFilter === "flagged" && !a?.flagged) return null;
                const stem = questions[id] ? textOf(questions[id].text, lang).stem : "…";
                return (
                  <li key={id}>
                    <button
                      className="w-full text-left px-4 py-2.5 flex items-center gap-3 text-sm hover:bg-surface-2"
                      onClick={() => {
                        setConfirming(false);
                        go(i);
                      }}
                    >
                      <span className="w-8 text-muted font-mono">{i + 1}</span>
                      <span className="flex-1 truncate">{stem}</span>
                      {a?.flagged && <span className="text-warn text-xs">⚑ revisar</span>}
                      <span className={`chip ${done ? "" : "!text-warn !border-warn/40"}`}>{done ? "respondida" : "sin responder"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap gap-2 mt-6">
              <button className="btn" onClick={() => setConfirming(false)}>
                ← Volver al examen
              </button>
              <div className="flex-1" />
              <button
                className="btn-primary"
                disabled={finishing}
                onClick={() => {
                  const missing = total - answeredCount;
                  if (missing > 0 && !confirm(`Tienes ${missing} pregunta(s) sin responder, que contarán como incorrectas. ¿Entregar de todas formas?`)) return;
                  finish();
                }}
              >
                {finishing ? "Calificando…" : "Entregar examen"}
              </button>
            </div>
          </div>
        </div>
      )}
      {confirming && instant && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setConfirming(false)}>
          <div className="card p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="text-lg font-semibold">¿Terminar el examen?</div>
            <ul className="text-sm text-muted mt-2 space-y-1">
              <li>
                Respondidas: {answeredCount} de {total}
              </li>
              {total - answeredCount > 0 && (
                <li className="text-warn">Sin responder: {total - answeredCount} (cuentan como incorrectas)</li>
              )}
              {flaggedCount > 0 && <li className="text-warn">Marcadas para revisar: {flaggedCount}</li>}
            </ul>
            <div className="flex gap-2 mt-5">
              <button className="btn flex-1" onClick={() => setConfirming(false)}>
                Seguir
              </button>
              <button className="btn-primary flex-1" onClick={finish} disabled={finishing}>
                {finishing ? "Calificando…" : "Terminar"}
              </button>
            </div>
          </div>
        </div>
      )}
      {finishing && !confirming && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center text-white">Calificando…</div>
      )}
    </div>
  );
}
