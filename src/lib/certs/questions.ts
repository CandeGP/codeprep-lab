import "server-only";
import { db } from "@/lib/db";
import { parseJson, type ClientQuestion, type Lang, type QuestionInput, type Reveal } from "./shared";

export const questionInclude = {
  domain: { select: { slug: true, name: true, nameEn: true } },
  topics: { select: { topic: { select: { slug: true, name: true, nameEn: true } } } },
} as const;

export type FullQuestion = NonNullable<Awaited<ReturnType<typeof getQuestion>>>;

export function getQuestion(id: string) {
  return db.question.findUnique({ where: { id }, include: questionInclude });
}

/** Carga preguntas por id conservando el orden recibido. */
export async function loadQuestions(ids: string[]) {
  const rows = await db.question.findMany({ where: { id: { in: ids } }, include: questionInclude });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((q): q is FullQuestion => !!q);
}

export function correctOf(q: { correct: string }) {
  return parseJson<number[]>(q.correct, []);
}

/** Nombre de dominio/tema según el idioma (los nombres base están en español). */
export function labelOf(x: { name: string; nameEn: string | null }, lang: Lang) {
  return lang === "en" && x.nameEn ? x.nameEn : x.name;
}

export function toClient(q: FullQuestion, lang: Lang = "en"): ClientQuestion {
  const options = parseJson<string[]>(q.options, []);
  const optionsEs = parseJson<string[] | null>(q.optionsEs, null);
  return {
    id: q.id,
    type: q.type === "MULTI" ? "MULTI" : "SINGLE",
    text: {
      en: { stem: q.stem, options },
      ...(q.stemEs && optionsEs?.length === options.length ? { es: { stem: q.stemEs, options: optionsEs } } : {}),
    },
    pick: correctOf(q).length,
    domain: labelOf(q.domain, lang),
    topics: q.topics.map((t) => labelOf(t.topic, lang)),
  };
}

export function toReveal(q: FullQuestion): Reveal {
  return {
    correct: correctOf(q),
    sources: parseJson<string[]>(q.sources, []),
    text: {
      en: { explanation: q.explanation, optionNotes: parseJson<string[]>(q.optionNotes, []) },
      ...(q.explanationEs
        ? { es: { explanation: q.explanationEs, optionNotes: parseJson<string[]>(q.optionNotesEs, []) } }
        : {}),
    },
  };
}

/** Columnas de la traducción al español a partir del contenido validado. */
export function esFields(q: Pick<QuestionInput, "es">) {
  return {
    stemEs: q.es?.stem ?? null,
    optionsEs: q.es ? JSON.stringify(q.es.options) : null,
    explanationEs: q.es?.explanation ?? null,
    optionNotesEs: q.es?.notes ? JSON.stringify(q.es.notes) : null,
  };
}
