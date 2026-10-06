/**
 * Tipos y utilidades de Certificaciones que sirven tanto en el servidor
 * como en el cliente y en los scripts (sin dependencias de Node/Next).
 */
import { z } from "zod";

export type ExamMode = "INSTANT" | "END";
export type ExamKind = "FULL" | "CUSTOM" | "REVIEW";
export type Lang = "en" | "es";

export type QuestionText = { stem: string; options: string[] };
export type RevealText = { explanation: string; optionNotes: string[] };

/**
 * Pregunta tal como se envía al cliente durante el examen (sin respuesta en modo END).
 * El inglés siempre está; el español cuando existe la traducción.
 */
export type ClientQuestion = {
  id: string;
  type: "SINGLE" | "MULTI";
  text: { en: QuestionText; es?: QuestionText };
  /** Cuántas respuestas hay que elegir (1 en SINGLE). */
  pick: number;
  domain: string;
  topics: string[];
};

/** Revelado de una pregunta: respuesta correcta, explicaciones y fuentes oficiales. */
export type Reveal = {
  correct: number[];
  sources: string[];
  text: { en: RevealText; es?: RevealText };
};

export function textOf<T>(t: { en: T; es?: T }, lang: Lang): T {
  return (lang === "es" && t.es) || t.en;
}

export type AnswerState = { selected: number[]; flagged: boolean; correct?: boolean };

// ---------- esquemas del contenido (archivos JSON y respuestas de la IA) ----------

const slug = z.string().regex(/^[a-z0-9-]+$/);

export const courseFileSchema = z.object({
  slug,
  title: z.string().min(3),
  provider: z.string().min(1),
  code: z.string().min(1),
  description: z.string().default(""),
  examQuestions: z.number().int().min(5).max(200),
  simQuestions: z.number().int().min(5).max(200),
  timeLimitMin: z.number().int().min(5).max(400),
  passingPct: z.number().int().min(1).max(100),
  passingScore: z.number().int().min(100).max(1000).default(700),
  domains: z
    .array(z.object({ slug, name: z.string().min(2), nameEn: z.string().optional(), weight: z.number().int().min(1).max(100) }))
    .min(1),
  topics: z.array(z.object({ slug, name: z.string().min(1), nameEn: z.string().optional() })).min(1),
});
export type CourseFile = z.infer<typeof courseFileSchema>;

const stemField = z.string().min(15).max(2500);
const optionsField = z.array(z.string().min(1).max(600)).min(3).max(6);
const explanationField = z.string().min(10).max(3000);
const notesField = z.array(z.string().max(900)).optional();

/** Traducción al español de una pregunta (mismo orden de opciones que el inglés). */
export const questionEsSchema = z.object({
  stem: stemField,
  options: optionsField,
  explanation: explanationField,
  notes: notesField,
});

export const questionInputSchema = z
  .object({
    domain: z.string().min(1),
    topics: z.array(z.string().min(1)).min(1).max(5),
    /** Contenido principal en inglés. */
    stem: stemField,
    options: optionsField,
    correct: z.array(z.number().int().min(0)).min(1).max(3),
    explanation: explanationField,
    notes: notesField,
    difficulty: z.number().int().min(1).max(3).default(2),
    /** URLs de documentación oficial que respaldan la respuesta. */
    sources: z.array(z.string().url().max(500)).max(6).default([]),
    es: questionEsSchema.optional(),
  })
  .superRefine((q, ctx) => {
    if (new Set(q.correct).size !== q.correct.length) ctx.addIssue({ code: "custom", message: "índices correctos repetidos" });
    if (q.correct.some((i) => i >= q.options.length)) ctx.addIssue({ code: "custom", message: "índice correcto fuera de rango" });
    if (q.correct.length >= q.options.length) ctx.addIssue({ code: "custom", message: "todas las opciones son correctas" });
    if (new Set(q.options.map(normalize)).size !== q.options.length) ctx.addIssue({ code: "custom", message: "opciones duplicadas" });
    if (q.notes && q.notes.length !== q.options.length) ctx.addIssue({ code: "custom", message: "notes debe tener una nota por opción" });
    if (q.es && q.es.options.length !== q.options.length) ctx.addIssue({ code: "custom", message: "es.options debe tener las mismas opciones" });
    if (q.es?.notes && q.es.notes.length !== q.options.length) ctx.addIssue({ code: "custom", message: "es.notes debe tener una nota por opción" });
  });
export type QuestionInput = z.infer<typeof questionInputSchema>;

export const questionFileSchema = questionInputSchema.and(z.object({ id: slug }));

export const flashcardFileSchema = z.object({
  id: slug,
  topic: z.string().optional(),
  front: z.string().min(2).max(500),
  back: z.string().min(2).max(2000),
  es: z.object({ front: z.string().min(2).max(500), back: z.string().min(2).max(2000) }).optional(),
});

/**
 * Aproximación del puntaje escalado de AWS (100-1000). AWS no publica su fórmula:
 * se interpola linealmente para que el porcentaje de aprobación caiga en el puntaje de aprobación.
 */
export function scaledScore(pctCorrect: number, passingPct: number, passingScore: number) {
  const p = Math.max(0, Math.min(100, pctCorrect));
  const raw = p >= passingPct
    ? passingScore + ((p - passingPct) / Math.max(1, 100 - passingPct)) * (1000 - passingScore)
    : 100 + (p / passingPct) * (passingScore - 100);
  return Math.round(raw);
}

// ---------- helpers ----------

export function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Hash FNV-1a del enunciado normalizado: sirve para detectar preguntas duplicadas. */
export function stemHash(stem: string) {
  const s = normalize(stem);
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

export function parseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export function sameSet(a: number[], b: number[]) {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

export function pct(ok: number, total: number) {
  return total === 0 ? 0 : Math.round((ok / total) * 100);
}

export function formatDuration(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}
