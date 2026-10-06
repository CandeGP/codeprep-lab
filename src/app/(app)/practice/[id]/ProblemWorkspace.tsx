"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { Problem } from "@/lib/content";
import { runCode, type Language, type RunOutput } from "@/lib/runner";
import { BookmarkButton } from "@/components/BookmarkButton";
import { ChatPanel } from "@/components/ChatPanel";
import { DifficultyChip } from "../../learn/[slug]/LessonView";

const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="h-full grid place-items-center text-sm text-muted">Cargando editor…</div>,
});

type Props = {
  problem: Problem;
  lessonTitle: string;
  descriptionHtml: string;
  solutionHtml: string;
  saved: boolean;
  lastSubmission: { language: Language; code: string } | null;
};

type Tab = "description" | "hints" | "solution" | "ai";

const draftKey = (id: string, lang: Language) => `draft:${id}:${lang}`;

function readDraft(id: string, lang: Language): string | null {
  try {
    return localStorage.getItem(draftKey(id, lang));
  } catch {
    return null;
  }
}

export function ProblemWorkspace({ problem, lessonTitle, descriptionHtml, solutionHtml, saved, lastSubmission }: Props) {
  const [language, setLanguage] = useState<Language>(lastSubmission?.language ?? "javascript");
  const [code, setCode] = useState<string>(lastSubmission?.code ?? problem.starter[language]);
  const [tab, setTab] = useState<Tab>("description");
  const [hintsShown, setHintsShown] = useState(0);
  const [output, setOutput] = useState<RunOutput | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [dark, setDark] = useState(false);

  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);

  // Recupera el borrador local al cambiar de lenguaje.
  useEffect(() => {
    const draft = readDraft(problem.id, language);
    if (draft) setCode(draft);
    else if (lastSubmission?.language === language) setCode(lastSubmission.code);
    else setCode(problem.starter[language]);
    setOutput(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, problem.id]);

  function onChange(v: string | undefined) {
    setCode(v ?? "");
    try {
      localStorage.setItem(draftKey(problem.id, language), v ?? "");
    } catch {}
  }

  async function run() {
    setStatus("Ejecutando…");
    setOutput(null);
    const result = await runCode(
      language,
      {
        code,
        functionName: problem.functionName,
        tests: problem.tests,
        argAdapters: problem.argAdapters ?? [],
        returnAdapter: problem.returnAdapter ?? null,
        unordered: problem.unordered ?? false,
      },
      setStatus,
    );
    setStatus(null);
    setOutput(result);
    const passed = result.type === "done" && result.results.every((r) => r.passed);
    fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problemId: problem.id, language, code, passed }),
    });
  }

  function reset() {
    if (!confirm("¿Restablecer el código inicial? Se perderá tu borrador.")) return;
    setCode(problem.starter[language]);
    try {
      localStorage.removeItem(draftKey(problem.id, language));
    } catch {}
  }

  const passedCount = output?.type === "done" ? output.results.filter((r) => r.passed).length : 0;

  return (
    <div className="lg:h-screen flex flex-col lg:flex-row">
      {/* Enunciado */}
      <section className="lg:w-[44%] lg:h-full flex flex-col border-r border-border min-w-0">
        <div className="px-5 pt-5">
          <div className="text-sm text-muted">
            <Link href="/practice" className="hover:text-text">Practicar</Link> /{" "}
            <Link href={`/learn/${problem.lessonSlug}`} className="hover:text-text">{lessonTitle}</Link>
          </div>
          <div className="flex items-center justify-between gap-3 mt-2">
            <h1 className="text-2xl font-bold">{problem.title}</h1>
            <BookmarkButton type="PROBLEM" refId={problem.id} label={problem.title} initial={saved} small />
          </div>
          <DifficultyChip d={problem.difficulty} />
          <div className="flex gap-1 mt-4 border-b border-border text-sm">
            {(
              [
                ["description", "Enunciado"],
                ["hints", `Pistas (${problem.hints.length})`],
                ["solution", "Solución"],
                ["ai", "Tutor IA"],
              ] as [Tab, string][]
            ).map(([t, label]) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-2 -mb-px border-b-2 cursor-pointer ${tab === t ? "border-accent font-semibold" : "border-transparent text-muted"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === "description" && <div className="prose-lesson" dangerouslySetInnerHTML={{ __html: descriptionHtml }} />}
          {tab === "hints" && (
            <div className="space-y-3">
              {problem.hints.slice(0, hintsShown).map((h, i) => (
                <div key={i} className="card p-3 text-sm">
                  <span className="font-semibold">Pista {i + 1}:</span> {h}
                </div>
              ))}
              {hintsShown < problem.hints.length ? (
                <button className="btn" onClick={() => setHintsShown(hintsShown + 1)}>Mostrar pista {hintsShown + 1}</button>
              ) : (
                <p className="text-sm text-muted">No hay más pistas. ¡Tú puedes!</p>
              )}
            </div>
          )}
          {tab === "solution" && <SolutionTab problem={problem} solutionHtml={solutionHtml} language={language} />}
          {tab === "ai" && (
            <ChatPanel
              lessonSlug={problem.lessonSlug}
              focus={`Problema "${problem.title}". Mi código actual (${language}):\n${code}`}
              suggestions={["¿Voy por buen camino?", "Dame una pista sin darme la solución", "¿Cuál es la complejidad de mi código?"]}
            />
          )}
        </div>
      </section>

      {/* Editor + resultados */}
      <section className="flex-1 flex flex-col min-w-0 lg:h-full">
        <div className="flex items-center justify-between gap-2 px-4 h-14 border-b border-border">
          <select className="input !w-auto !py-1" value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
          </select>
          <div className="flex gap-2">
            <button className="btn" onClick={reset}>Restablecer</button>
            <button className="btn-primary" onClick={run} disabled={!!status}>
              {status ?? "▶ Ejecutar pruebas"}
            </button>
          </div>
        </div>
        <div className="h-[50vh] lg:h-auto lg:flex-1 min-h-0">
          <Editor
            language={language}
            value={code}
            onChange={onChange}
            theme={dark ? "vs-dark" : "light"}
            options={{ fontSize: 14, minimap: { enabled: false }, scrollBeyondLastLine: false, tabSize: language === "python" ? 4 : 2, automaticLayout: true }}
          />
        </div>
        <div className="lg:h-[38%] overflow-y-auto border-t border-border p-4 text-sm">
          {!output && !status && <p className="text-muted">Ejecuta tu código para ver los resultados de las pruebas.</p>}
          {status && <p className="text-muted">{status}</p>}
          {output?.type === "error" && (
            <pre className="whitespace-pre-wrap text-bad font-mono text-xs">{output.error}</pre>
          )}
          {output?.type === "done" && (
            <div className="space-y-2">
              <div className={`font-semibold ${passedCount === output.results.length ? "text-ok" : "text-bad"}`}>
                {passedCount === output.results.length ? "✓ ¡Todas las pruebas pasaron!" : `${passedCount}/${output.results.length} pruebas pasaron`}
              </div>
              {output.results.map((r) => (
                <details key={r.index} className="card px-3 py-2" open={!r.passed}>
                  <summary className="cursor-pointer">
                    <span className={r.passed ? "text-ok" : "text-bad"}>{r.passed ? "✓" : "✗"}</span> Prueba {r.index + 1}
                    {r.ms !== undefined && <span className="text-muted text-xs"> · {r.ms} ms</span>}
                  </summary>
                  <div className="font-mono text-xs mt-2 space-y-1 break-all">
                    <div><span className="text-muted">Entrada: </span>{r.input.map((a) => JSON.stringify(a)).join(", ")}</div>
                    <div><span className="text-muted">Esperado: </span>{JSON.stringify(r.expected)}</div>
                    {r.error ? (
                      <div className="text-bad">Error: {r.error}</div>
                    ) : (
                      <div><span className="text-muted">Obtenido: </span>{JSON.stringify(r.actual)}</div>
                    )}
                  </div>
                </details>
              ))}
            </div>
          )}
          {output && output.logs.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-semibold text-muted">Consola</div>
              <pre className="font-mono text-xs bg-surface-2 rounded-lg p-2 mt-1 whitespace-pre-wrap">{output.logs.join("\n")}</pre>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function SolutionTab({ problem, solutionHtml, language }: { problem: Problem; solutionHtml: string; language: Language }) {
  const [revealed, setRevealed] = useState(false);
  if (!revealed) {
    return (
      <div className="card p-5 text-center space-y-3">
        <p className="text-sm text-muted">Intenta resolverlo primero; ver la solución demasiado pronto reduce lo que aprendes.</p>
        <button className="btn" onClick={() => setRevealed(true)}>Mostrar solución</button>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="prose-lesson" dangerouslySetInnerHTML={{ __html: solutionHtml }} />
      <pre className="font-mono text-xs bg-surface-2 border border-border rounded-lg p-3 overflow-x-auto">
        {problem.solution[language]}
      </pre>
    </div>
  );
}
