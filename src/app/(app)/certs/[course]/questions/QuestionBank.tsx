"use client";

import { useCallback, useEffect, useState } from "react";
import { LangToggle, QuestionView, jsonFetch, saveLang } from "@/components/certs/QuestionView";
import { GeneratorStatus, useGenerator } from "@/components/certs/Generator";
import { textOf, type ClientQuestion, type Lang, type Reveal } from "@/lib/certs/shared";

type Opt = { slug: string; name: string };
type Item = {
    id: string;
    q: ClientQuestion;
    reveal: Reveal;
    source: string;
    status: string;
    reports: number;
    difficulty: number;
    domainSlug: string;
    topicSlugs: string[];
    pending: boolean;
  };

const PAGE = 20;
const SOURCE_LABEL: Record<string, string> = { CURATED: "curada", AI: "IA", USER: "manual" };
const STATUS_LABEL: Record<string, string> = { ACTIVE: "activa", FLAGGED: "reportada", HIDDEN: "oculta" };

export function QuestionBank({
  courseSlug,
  domains,
  topics,
  canManage,
  aiEnabled,
  initialPending,
  initialLang,
}: {
  courseSlug: string;
  domains: Opt[];
  topics: Opt[];
  canManage: boolean;
  aiEnabled: boolean;
  initialPending: boolean;
  initialLang: Lang;
}) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [q, setQ] = useState("");
  const [topic, setTopic] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("");
  const [pendingOnly, setPendingOnly] = useState(initialPending);
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<{ total: number; items: Item[] } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const gen = useGenerator(courseSlug);

  const load = useCallback(async () => {
    const sp = new URLSearchParams({ course: courseSlug, offset: String(offset), limit: String(PAGE) });
    if (q.trim()) sp.set("q", q.trim());
    if (topic) sp.set("topic", topic);
    if (source) sp.set("source", source);
    if (status) sp.set("status", status);
    if (pendingOnly) sp.set("pending", "1");
    try {
      setData(await jsonFetch(`/api/certs/questions?${sp}`));
    } catch (err) {
      setError((err as Error).message);
    }
  }, [courseSlug, offset, q, topic, source, status, pendingOnly]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load, gen.running]);

  useEffect(() => setOffset(0), [q, topic, source, status, pendingOnly]);

  async function act(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const togglePending = (it: Item) =>
    act(() =>
      it.pending
        ? jsonFetch(`/api/certs/marks?questionId=${encodeURIComponent(it.id)}`, { method: "DELETE" })
        : jsonFetch("/api/certs/marks", { method: "POST", json: { questionId: it.id } }),
    );
  const setItemStatus = (it: Item, s: string) =>
    act(() => jsonFetch(`/api/certs/questions/${encodeURIComponent(it.id)}`, { method: "PATCH", json: { status: s } }));
  const remove = (it: Item) =>
    confirm(it.source === "CURATED" ? "Las curadas se ocultan en vez de borrarse. ¿Ocultar?" : "¿Borrar esta pregunta?") &&
    act(() => jsonFetch(`/api/certs/questions/${encodeURIComponent(it.id)}`, { method: "DELETE" }));
  const report = (it: Item) =>
    confirm("¿Reportar esta pregunta como incorrecta o confusa?") &&
    act(() => jsonFetch(`/api/certs/questions/${encodeURIComponent(it.id)}/report`, { method: "POST" }));

  const pages = data ? Math.ceil(data.total / PAGE) : 0;
  const topicName = topics.find((t) => t.slug === topic)?.name;

  return (
    <div className="mt-6">
      <div className="card p-4 grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
        <input className="input lg:col-span-2" placeholder="Buscar en el enunciado…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" value={topic} onChange={(e) => setTopic(e.target.value)}>
          <option value="">Todos los temas</option>
          {topics.map((t) => (
            <option key={t.slug} value={t.slug}>{t.name}</option>
          ))}
        </select>
        <select className="input" value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">Cualquier origen</option>
          <option value="CURATED">Curadas</option>
          <option value="AI">Generadas con IA</option>
          <option value="USER">Manuales</option>
        </select>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Cualquier estado</option>
          <option value="ACTIVE">Activas</option>
          <option value="FLAGGED">Reportadas</option>
          <option value="HIDDEN">Ocultas</option>
        </select>
        <label className="flex items-center gap-2 text-sm lg:col-span-5">
          <input type="checkbox" checked={pendingOnly} onChange={(e) => setPendingOnly(e.target.checked)} />
          Sólo mis pendientes
          <span className="flex-1" />
          <LangToggle
            lang={lang}
            onChange={(l) => {
              setLang(l);
              saveLang(l);
            }}
          />
          {aiEnabled && (
            <button
              className="btn"
              disabled={gen.running}
              onClick={() => gen.run({ kind: "questions", target: 10, topics: topic ? [topic] : [] })}
            >
              ✦ Generar 10 {topicName ? `de ${topicName}` : "con IA"}
            </button>
          )}
          {canManage && (
            <button className="btn-primary" onClick={() => setEditing("new")}>
              + Agregar pregunta
            </button>
          )}
        </label>
      </div>
      <GeneratorStatus g={gen} label="preguntas" />
      {error && <p className="text-sm text-bad mt-3">{error}</p>}

      {editing && (
        <QuestionEditor
          courseSlug={courseSlug}
          domains={domains}
          topics={topics}
          item={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}

      <div className="text-sm text-muted mt-4">{data ? `${data.total} preguntas` : "Cargando…"}</div>
      <ul className="mt-2 space-y-2">
        {data?.items.map((it) => {
          const isOpen = open === it.id;
          return (
            <li key={it.id} className={`card ${it.status !== "ACTIVE" ? "opacity-70" : ""}`}>
              <button className="w-full text-left px-4 py-3 flex items-start gap-3" onClick={() => setOpen(isOpen ? null : it.id)}>
                <span className={`flex-1 text-sm ${isOpen ? "" : "line-clamp-2"}`}>{textOf(it.q.text, lang).stem}</span>
                {it.pending && <span className="text-accent text-xs">★</span>}
                <span className="chip">{SOURCE_LABEL[it.source] ?? it.source}</span>
                {it.status !== "ACTIVE" && (
                  <span className="chip !text-warn !border-warn/40">
                    {STATUS_LABEL[it.status]}
                    {it.reports ? ` ×${it.reports}` : ""}
                  </span>
                )}
                <span className="text-muted">{isOpen ? "▾" : "▸"}</span>
              </button>
              {isOpen && (
                <div className="px-4 pb-4 border-t border-border pt-4">
                  <QuestionView q={it.q} selected={[]} reveal={it.reveal} lang={lang} hideStem />
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button className={`btn ${it.pending ? "!border-accent !text-accent" : ""}`} onClick={() => togglePending(it)}>
                      ★ {it.pending ? "Pendiente" : "Marcar pendiente"}
                    </button>
                    {canManage ? (
                      <>
                        <button className="btn" onClick={() => setEditing(it)}>Editar</button>
                        {it.status === "ACTIVE" ? (
                          <button className="btn" onClick={() => setItemStatus(it, "HIDDEN")}>Ocultar</button>
                        ) : (
                          <button className="btn" onClick={() => setItemStatus(it, "ACTIVE")}>Reactivar</button>
                        )}
                        <button className="btn !text-bad" onClick={() => remove(it)}>Borrar</button>
                      </>
                    ) : (
                      <button className="btn" onClick={() => report(it)} disabled={it.status === "FLAGGED"}>
                        ⚠ Reportar error
                      </button>
                    )}
                    <span className="text-xs text-muted self-center ml-auto font-mono">{it.id}</span>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4 text-sm">
          <button className="btn" disabled={offset === 0} onClick={() => setOffset(offset - PAGE)}>
            ← Anterior
          </button>
          <span className="text-muted">
            Página {offset / PAGE + 1} de {pages}
          </span>
          <button className="btn" disabled={offset + PAGE >= (data?.total ?? 0)} onClick={() => setOffset(offset + PAGE)}>
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}

function QuestionEditor({
  courseSlug,
  domains,
  topics,
  item,
  onClose,
  onSaved,
}: {
  courseSlug: string;
  domains: Opt[];
  topics: Opt[];
  item: Item | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const en = item?.q.text.en;
  const es = item?.q.text.es;
  const enNotes = item?.reveal.text.en.optionNotes ?? [];
  const [stem, setStem] = useState(en?.stem ?? "");
  const [options, setOptions] = useState<string[]>(en?.options ?? ["", "", "", ""]);
  const [notes, setNotes] = useState<string[]>(enNotes.length ? enNotes : (en?.options ?? ["", "", "", ""]).map(() => ""));
  const [correct, setCorrect] = useState<number[]>(item?.reveal.correct ?? [0]);
  const [explanation, setExplanation] = useState(item?.reveal.text.en.explanation ?? "");
  const [stemEs, setStemEs] = useState(es?.stem ?? "");
  const [optionsEs, setOptionsEs] = useState<string[]>(es?.options ?? (en?.options ?? ["", "", "", ""]).map(() => ""));
  const [explanationEs, setExplanationEs] = useState(item?.reveal.text.es?.explanation ?? "");
  const [sources, setSources] = useState((item?.reveal.sources ?? []).join("\n"));
  const [domain, setDomain] = useState(item?.domainSlug ?? domains[0]?.slug ?? "");
  const [sel, setSel] = useState<string[]>(item?.topicSlugs ?? []);
  const [difficulty, setDifficulty] = useState(item?.difficulty ?? 2);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function setOpt(i: number, v: string) {
    setOptions((o) => o.map((x, j) => (j === i ? v : x)));
  }
  function addOpt() {
    if (options.length >= 6) return;
    setOptions((o) => [...o, ""]);
    setOptionsEs((o) => [...o, ""]);
    setNotes((n) => [...n, ""]);
  }
  function removeOpt(i: number) {
    if (options.length <= 3) return;
    setOptions((o) => o.filter((_, j) => j !== i));
    setOptionsEs((o) => o.filter((_, j) => j !== i));
    setNotes((n) => n.filter((_, j) => j !== i));
    setCorrect((c) => c.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x)));
  }

  async function save() {
    setBusy(true);
    setError(null);
    const question = {
      domain,
      topics: sel,
      stem: stem.trim(),
      options: options.map((o) => o.trim()),
      correct: [...correct].sort(),
      explanation: explanation.trim(),
      notes: notes.some((n) => n.trim()) ? notes.map((n) => n.trim()) : undefined,
      difficulty,
      sources: sources.split(/\s+/).map((u) => u.trim()).filter(Boolean),
      // La traducción sólo se guarda si está completa.
      es:
        stemEs.trim() && explanationEs.trim() && optionsEs.every((o) => o.trim())
          ? {
              stem: stemEs.trim(),
              options: optionsEs.map((o) => o.trim()),
              explanation: explanationEs.trim(),
              notes:
                item?.reveal.text.es?.optionNotes.length === options.length ? item.reveal.text.es.optionNotes : undefined,
            }
          : undefined,
    };
    try {
      if (item) {
        await jsonFetch(`/api/certs/questions/${encodeURIComponent(item.id)}`, { method: "PATCH", json: { question } });
      } else {
        await jsonFetch("/api/certs/questions", { method: "POST", json: { courseSlug, question } });
      }
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="card p-5 mt-4 border-accent space-y-3">
      <div className="font-semibold">{item ? "Editar pregunta" : "Nueva pregunta"}</div>
      <textarea className="input min-h-24" placeholder="Question stem in English (for multiple answers end with “(Choose two.)”)" value={stem} onChange={(e) => setStem(e.target.value)} />
      <div className="space-y-2">
        {options.map((o, i) => (
          <div key={i} className="flex gap-2 items-start">
            <label className="pt-2" title="Correcta">
              <input
                type="checkbox"
                checked={correct.includes(i)}
                onChange={() => setCorrect((c) => (c.includes(i) ? c.filter((x) => x !== i) : [...c, i]))}
              />
            </label>
            <div className="flex-1 space-y-1">
              <input className="input" placeholder={`Opción ${"ABCDEF"[i]}`} value={o} onChange={(e) => setOpt(i, e.target.value)} />
              <input
                className="input !text-xs"
                placeholder="Nota: por qué es correcta/incorrecta (opcional)"
                value={notes[i] ?? ""}
                onChange={(e) => setNotes((n) => n.map((x, j) => (j === i ? e.target.value : x)))}
              />
            </div>
            <button className="btn" onClick={() => removeOpt(i)} disabled={options.length <= 3} title="Quitar opción">
              ✕
            </button>
          </div>
        ))}
        {options.length < 6 && (
          <button className="btn" onClick={addOpt}>
            + Opción
          </button>
        )}
      </div>
      <textarea className="input min-h-20" placeholder="Explanation (English)" value={explanation} onChange={(e) => setExplanation(e.target.value)} />
      <textarea
        className="input min-h-16 !text-xs font-mono"
        placeholder="Fuentes: URLs de docs.aws.amazon.com, una por línea"
        value={sources}
        onChange={(e) => setSources(e.target.value)}
      />
      <details className="rounded-lg border border-border p-3" open={!!es}>
        <summary className="text-sm font-semibold cursor-pointer">Traducción al español (opcional)</summary>
        <div className="space-y-2 mt-3">
          <textarea className="input min-h-20" placeholder="Enunciado en español" value={stemEs} onChange={(e) => setStemEs(e.target.value)} />
          {optionsEs.map((o, i) => (
            <input
              key={i}
              className="input"
              placeholder={`Opción ${"ABCDEF"[i]} en español`}
              value={o}
              onChange={(e) => setOptionsEs((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
            />
          ))}
          <textarea className="input min-h-16" placeholder="Explicación en español" value={explanationEs} onChange={(e) => setExplanationEs(e.target.value)} />
        </div>
      </details>
      <div className="grid sm:grid-cols-2 gap-2">
        <select className="input" value={domain} onChange={(e) => setDomain(e.target.value)}>
          {domains.map((d) => (
            <option key={d.slug} value={d.slug}>{d.name}</option>
          ))}
        </select>
        <select className="input" value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))}>
          <option value={1}>Fácil</option>
          <option value={2}>Media</option>
          <option value={3}>Difícil</option>
        </select>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {topics.map((t) => (
          <button
            key={t.slug}
            type="button"
            onClick={() => setSel((s) => (s.includes(t.slug) ? s.filter((x) => x !== t.slug) : [...s, t.slug]))}
            className={`rounded-full border px-2.5 py-1 text-xs ${
              sel.includes(t.slug) ? "border-accent bg-accent text-accent-fg" : "border-border hover:border-accent"
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-bad">{error}</p>}
      <div className="flex gap-2">
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn-primary" onClick={save} disabled={busy}>
          {busy ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}
