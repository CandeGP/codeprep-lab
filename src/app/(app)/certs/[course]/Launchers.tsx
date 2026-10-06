"use client";

import { useEffect, useState } from "react";
import { jsonFetch } from "@/components/certs/QuestionView";
import { GeneratorStatus, useGenerator } from "@/components/certs/Generator";
import { ModePicker, useStartExam } from "@/components/certs/StartExam";

type Topic = { slug: string; name: string; questions: number };
type CourseInfo = {
  slug: string;
  code: string;
  examQuestions: number;
  simQuestions: number;
  timeLimitMin: number;
  passingScore: number;
  totalQuestions: number;
};

/** Simulacro completo, cronometrado y repartido por dominios como el examen real. */
export function FullExamCard({ course }: { course: CourseInfo }) {
  const sizes = [...new Set([course.simQuestions, course.examQuestions])].sort((a, b) => a - b);
  const [count, setCount] = useState(sizes[0]);
  const [mode, setMode] = useState<"INSTANT" | "END">("END");
  const { start, busy, error } = useStartExam();
  const minutes = Math.round((course.timeLimitMin * count) / course.examQuestions);
  const short = course.totalQuestions < count;

  return (
    <div className="card p-5">
      <div className="rounded-lg border border-accent/40 bg-accent/5 p-4 mb-5">
        <div className="text-xs font-semibold uppercase tracking-wider text-accent">Simulación exacta</div>
        <p className="text-sm mt-1">
          Como el examen real: <b>{course.examQuestions} preguntas</b>, <b>{course.timeLimitMin} minutos</b>, sin
          retroalimentación, pantalla de revisión antes de entregar y calificación aproximada de 100 a 1000 (aprobar{" "}
          {course.passingScore}).
        </p>
        <button
          className="btn-primary w-full mt-3"
          disabled={busy || course.totalQuestions === 0}
          onClick={() => start({ courseSlug: course.slug, kind: "FULL", mode: "END", count: course.examQuestions, exact: true })}
        >
          {busy ? "Preparando…" : "Iniciar simulación exacta"}
        </button>
      </div>
      <div className="text-xs font-semibold uppercase tracking-wider text-accent">Simulacro flexible</div>
      <div className="text-lg font-semibold mt-1">Examen completo {course.code}</div>
      <p className="text-sm text-muted mt-1">
        Preguntas repartidas según el peso de cada dominio, priorizando las que no has visto. {minutes} minutos.
      </p>
      <div className="flex gap-2 mt-4">
        {sizes.map((n) => (
          <button
            key={n}
            className={`btn flex-1 ${count === n ? "!border-accent !bg-accent/10 !text-accent" : ""}`}
            onClick={() => setCount(n)}
          >
            {n} preguntas
          </button>
        ))}
      </div>
      <div className="mt-3">
        <ModePicker value={mode} onChange={setMode} />
      </div>
      {short && (
        <p className="text-xs text-warn mt-3">
          El banco tiene {course.totalQuestions} preguntas; el simulacro usará todas las disponibles. Genera más abajo.
        </p>
      )}
      <button
        className="btn-primary w-full mt-4"
        disabled={busy || course.totalQuestions === 0}
        onClick={() => start({ courseSlug: course.slug, kind: "FULL", mode, count })}
      >
        {busy ? "Preparando…" : "Comenzar simulacro"}
      </button>
      {error && <p className="text-sm text-bad mt-2">{error}</p>}
    </div>
  );
}

/** Examen corto a la medida: temas, cantidad, modo y filtros. */
export function CustomExamCard({
  course,
  topics,
  aiEnabled,
  initialTopics = [],
}: {
  course: CourseInfo;
  topics: Topic[];
  aiEnabled: boolean;
  initialTopics?: string[];
}) {
  const [selected, setSelected] = useState<string[]>(initialTopics);
  const [count, setCount] = useState(10);
  const [mode, setMode] = useState<"INSTANT" | "END">("INSTANT");
  const [pool, setPool] = useState<"all" | "unseen" | "wrong" | "pending">("all");
  const [difficulty, setDifficulty] = useState<number | undefined>();
  const [timed, setTimed] = useState(false);
  const [available, setAvailable] = useState<number | null>(null);
  const { start, busy, error } = useStartExam();
  const gen = useGenerator(course.slug);

  const payload = {
    courseSlug: course.slug,
    kind: "CUSTOM" as const,
    mode,
    count,
    topics: selected,
    pool,
    difficulty,
    timed,
  };

  // Cuántas preguntas cumplen los filtros (consulta ligera al servidor).
  const key = JSON.stringify([selected, pool, difficulty, gen.running]);
  useEffect(() => {
    if (gen.running) return;
    const t = setTimeout(async () => {
      try {
        const r = await jsonFetch<{ available: number }>("/api/certs/attempts", {
          method: "POST",
          json: { ...payload, dryRun: true },
        });
        setAvailable(r.available);
      } catch {
        setAvailable(null);
      }
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const toggle = (slug: string) =>
    setSelected((s) => (s.includes(slug) ? s.filter((x) => x !== slug) : [...s, slug]));
  const missing = available !== null ? Math.max(0, count - available) : 0;

  return (
    <div className="card p-5" id="personalizado">
      <div className="text-xs font-semibold uppercase tracking-wider text-accent">Examen personalizado</div>
      <div className="text-lg font-semibold mt-1">Elige temas y cantidad</div>
      <p className="text-sm text-muted mt-1">Ej.: 10 de S3, o 20 de VPC + EC2 + IAM. Sin temas = todos.</p>

      <div className="flex flex-wrap gap-1.5 mt-4">
        {topics.map((t) => {
          const on = selected.includes(t.slug);
          return (
            <button
              key={t.slug}
              type="button"
              onClick={() => toggle(t.slug)}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                on ? "border-accent bg-accent text-accent-fg" : "border-border hover:border-accent"
              }`}
            >
              {t.name} <span className={on ? "opacity-80" : "text-muted"}>{t.questions}</span>
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <button className="text-xs text-muted underline mt-2" onClick={() => setSelected([])}>
          Quitar selección
        </button>
      )}

      <div className="grid sm:grid-cols-3 gap-3 mt-4">
        <label className="text-xs text-muted">
          Preguntas
          <select className="input mt-1" value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {[5, 10, 15, 20, 25, 30, 40, 50, 65].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted">
          Cuáles
          <select className="input mt-1" value={pool} onChange={(e) => setPool(e.target.value as typeof pool)}>
            <option value="all">Todas (primero no vistas)</option>
            <option value="unseen">Sólo no vistas</option>
            <option value="wrong">Sólo las que fallé</option>
            <option value="pending">Sólo mis pendientes</option>
          </select>
        </label>
        <label className="text-xs text-muted">
          Dificultad
          <select
            className="input mt-1"
            value={difficulty ?? ""}
            onChange={(e) => setDifficulty(e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">Cualquiera</option>
            <option value="1">Fácil</option>
            <option value="2">Media</option>
            <option value="3">Difícil</option>
          </select>
        </label>
      </div>

      <div className="mt-3">
        <ModePicker value={mode} onChange={setMode} />
      </div>
      <label className="flex items-center gap-2 text-sm mt-3">
        <input type="checkbox" checked={timed} onChange={(e) => setTimed(e.target.checked)} />
        Con tiempo (mismo ritmo que el examen real)
      </label>

      <div className="text-xs text-muted mt-3">
        {available === null ? "Calculando…" : `${available} pregunta${available === 1 ? "" : "s"} disponible${available === 1 ? "" : "s"} con estos filtros.`}
      </div>
      {missing > 0 && pool === "all" && (
        <div className="rounded-lg border border-warn/40 bg-warn/10 p-3 mt-2 text-sm">
          Faltan {missing} pregunta{missing === 1 ? "" : "s"} para llegar a {count}.
          {aiEnabled ? (
            <button
              className="btn ml-2"
              disabled={gen.running}
              onClick={() => gen.run({ kind: "questions", target: missing, topics: selected, difficulty })}
            >
              ✦ Generar {missing} con IA
            </button>
          ) : (
            " Se usarán las disponibles."
          )}
        </div>
      )}
      <GeneratorStatus g={gen} label="preguntas" />

      <button
        className="btn-primary w-full mt-4"
        disabled={busy || gen.running || available === 0}
        onClick={() => start(payload)}
      >
        {busy ? "Preparando…" : `Comenzar ${Math.min(count, available ?? count)} preguntas`}
      </button>
      {error && <p className="text-sm text-bad mt-2">{error}</p>}
    </div>
  );
}

/** Ampliar el banco del curso con IA (preguntas o flashcards). */
export function GenerateBankCard({
  course,
  topics,
  isNew,
}: {
  course: CourseInfo;
  topics: Topic[];
  isNew: boolean;
}) {
  const [kind, setKind] = useState<"questions" | "flashcards">("questions");
  const [target, setTarget] = useState(isNew ? 30 : 10);
  const [selected, setSelected] = useState<string[]>([]);
  const gen = useGenerator(course.slug);
  const toggle = (slug: string) =>
    setSelected((s) => (s.includes(slug) ? s.filter((x) => x !== slug) : [...s, slug]));

  return (
    <div className={`card p-5 ${isNew ? "border-accent" : ""}`}>
      <div className="text-xs font-semibold uppercase tracking-wider text-accent">✦ Generar con IA</div>
      <div className="text-lg font-semibold mt-1">
        {isNew ? "Crea el banco inicial de este curso" : "Amplía el banco de preguntas"}
      </div>
      <p className="text-sm text-muted mt-1">
        Se generan en lotes de 10, evitando repetir las que ya existen, y quedan guardadas para todos.
      </p>
      <div className="flex gap-2 mt-3">
        <button
          className={`btn flex-1 ${kind === "questions" ? "!border-accent !bg-accent/10 !text-accent" : ""}`}
          onClick={() => setKind("questions")}
        >
          Preguntas
        </button>
        <button
          className={`btn flex-1 ${kind === "flashcards" ? "!border-accent !bg-accent/10 !text-accent" : ""}`}
          onClick={() => setKind("flashcards")}
        >
          Flashcards
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-3">
        {topics.map((t) => (
          <button
            key={t.slug}
            type="button"
            onClick={() => toggle(t.slug)}
            className={`rounded-full border px-2.5 py-1 text-xs ${
              selected.includes(t.slug) ? "border-accent bg-accent text-accent-fg" : "border-border hover:border-accent"
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-3">
        <select className="input !w-auto" value={target} onChange={(e) => setTarget(Number(e.target.value))}>
          {[10, 20, 30, 50, 100].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <button
          className="btn-primary flex-1"
          disabled={gen.running}
          onClick={() => gen.run({ kind, target, topics: selected })}
        >
          {gen.running ? "Generando…" : `Generar ${target} ${kind === "questions" ? "preguntas" : "flashcards"}`}
        </button>
      </div>
      <p className="text-xs text-muted mt-2">{selected.length ? `${selected.length} tema(s) seleccionados` : "Sin temas = reparte entre todos los temas."}</p>
      <GeneratorStatus g={gen} label={kind === "questions" ? "preguntas" : "flashcards"} />
    </div>
  );
}

/** Borra un curso creado con IA (sólo lo ve quien lo creó). */
export function DeleteCourseButton({ slug }: { slug: string }) {
  const [busy, setBusy] = useState(false);
  async function remove() {
    if (!confirm("¿Borrar este curso con todas sus preguntas, flashcards e intentos?")) return;
    setBusy(true);
    try {
      await jsonFetch(`/api/certs/courses/${slug}`, { method: "DELETE" });
      window.location.href = "/certs";
    } catch (err) {
      alert((err as Error).message);
      setBusy(false);
    }
  }
  return (
    <button className="btn !text-bad" onClick={remove} disabled={busy}>
      Borrar curso
    </button>
  );
}
