import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { esFields } from "./questions";
import { courseFileSchema, questionInputSchema, stemHash, type CourseFile } from "./shared";

/** Máximo de preguntas por llamada: lotes pequeños = peticiones cortas y fáciles de reintentar. */
export const MAX_BATCH = 10;
/** Con investigación en la documentación cada pregunta tarda más: lotes más chicos. */
const MAX_BATCH_WITH_DOCS = 5;

/** Servidor MCP oficial de AWS con la documentación (gratuito, sin cuenta de AWS). */
const AWS_DOCS_MCP = { type: "url" as const, url: "https://knowledge-mcp.global.api.aws", name: "aws-knowledge" };

export function aiAvailable() {
  return !!process.env.ANTHROPIC_API_KEY;
}

export function aiErrorMessage(err: unknown) {
  if (err instanceof Anthropic.AuthenticationError) return "API key inválida. Revisa ANTHROPIC_API_KEY en .env.";
  if (err instanceof Anthropic.RateLimitError) return "Límite de uso de la IA alcanzado; intenta en un momento.";
  if (err instanceof Anthropic.APIError) return `Error de la API (${err.status ?? "?"}): ${err.message}`;
  if (err instanceof Error) return err.message;
  return "Error inesperado al consultar la IA.";
}

/** Los cursos de AWS se generan consultando la documentación oficial por MCP. */
function usesAwsDocs(course: { provider: string }) {
  return /\baws\b|amazon/i.test(course.provider);
}

const EXAM_WRITER = `You write original practice questions for professional IT certification exams (AWS, Azure, Google Cloud, Kubernetes, security, etc.) that match the real exam's difficulty.

Difficulty rubric (this matters most):
- Scenario-based stems of 2-5 sentences describing a company, its current setup, and 2-3 competing requirements (e.g. "MOST cost-effective", "LEAST operational overhead", "highly available", "without code changes", compliance or latency constraints).
- All options must be technically plausible AWS/vendor solutions that a partially prepared candidate could pick; the correct one is the ONLY option that satisfies every stated requirement. Distractors should fail on one specific requirement (cost, ops overhead, availability, security, a service limit).
- Never let the correct option repeat distinctive words from the stem, and never make it the longest or most detailed option by default.
- Mix difficulty: roughly 20% level 1, 50% level 2, 30% level 3. About 1 in 5 questions is multiple response; its stem ends with "(Choose two.)" or "(Choose three.)" and "correct" has exactly that many indices.
- Questions are ORIGINAL. Never reproduce real exam questions or brain-dump content.
- Facts must be accurate and current. When documentation tools are available, verify the key facts with them before writing and put the exact documentation URLs you relied on in "sources" (1-3 per question). Never invent URLs.

Output format:
- Main fields (stem, options, explanation, notes) in English. "es" is a faithful Latin American Spanish translation with the SAME option order; keep AWS service and feature names in English.
- "correct" uses 0-based indices into "options"; vary the position of the correct answer.
- "explanation": why the correct answer meets every requirement (2-4 sentences). "notes": one short note per option, in order, saying why it is correct or which requirement it fails.
- Use only the domain and topic slugs you are given.`;

const client = () => new Anthropic();

/**
 * Pide una respuesta con formato JSON estructurado. Con `docs`, Claude puede consultar la
 * documentación oficial de AWS mediante el conector MCP (se ejecuta del lado de Anthropic).
 */
async function askStructured<T extends z.ZodType>(schema: T, system: string, prompt: string, docs = false) {
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: prompt }];
  // El servidor corta el bucle de herramientas cada cierto número de pasos (pause_turn): se reanuda.
  for (let turn = 0; turn < 4; turn++) {
    const stream = client().beta.messages.stream({
      model: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
      max_tokens: 64000,
      system,
      messages,
      output_config: { effort: "medium", format: betaZodOutputFormat(schema) },
      betas: ["server-side-fallback-2026-07-01", ...(docs ? ["mcp-client-2025-11-20"] : [])],
      fallbacks: "default",
      ...(docs ? { mcp_servers: [AWS_DOCS_MCP], tools: [{ type: "mcp_toolset" as const, mcp_server_name: AWS_DOCS_MCP.name }] } : {}),
    });
    const response = await stream.finalMessage();
    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content as Anthropic.Beta.BetaContentBlockParam[] });
      continue;
    }
    if (response.stop_reason === "refusal") throw new Error("La IA no pudo generar este contenido.");
    if (response.stop_reason === "max_tokens") throw new Error("La respuesta de la IA se cortó; intenta con menos preguntas.");
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    try {
      const parsed = schema.safeParse(JSON.parse(text));
      if (parsed.success) return parsed.data as z.infer<T>;
    } catch {
      // cae al error de abajo
    }
    throw new Error("La IA devolvió un formato inválido; intenta de nuevo.");
  }
  throw new Error("La IA tardó demasiado consultando la documentación; intenta con menos preguntas.");
}

// ---------------- esquema de un curso nuevo ----------------

const outlineSchema = z.object({
  found: z.boolean(),
  title: z.string(),
  provider: z.string(),
  code: z.string(),
  description: z.string(),
  examQuestions: z.number().int(),
  timeLimitMin: z.number().int(),
  passingPct: z.number().int(),
  passingScore: z.number().int(),
  domains: z.array(z.object({ slug: z.string(), name: z.string(), nameEn: z.string(), weight: z.number().int() })),
  topics: z.array(z.object({ slug: z.string(), name: z.string(), nameEn: z.string() })),
});

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Pide a la IA la estructura (dominios con pesos y temas) del examen de certificación buscado. */
export async function generateOutline(query: string): Promise<CourseFile> {
  const aws = /\baws\b|amazon|clf|saa|soa|dva|dop|sap|scs|ans|mla|aif|dea/i.test(query);
  const out = await askStructured(
    outlineSchema,
    "You are an expert in IT certification programs. Use the official exam guide data. When documentation tools are available, look up the official AWS exam guide before answering.",
    `A student wants to prepare for this exam or course: "${query}".

Return the structure of the matching certification exam according to its latest official exam guide:
- found=false if it is not a real, identifiable technical certification or course.
- title (official name), provider (e.g. AWS, Microsoft, Google Cloud, CNCF), code (e.g. AZ-900) and a 1-2 sentence description in Spanish.
- examQuestions (number of questions on the real exam), timeLimitMin (minutes), passingPct (approximate % of correct answers needed) and passingScore (scaled passing score on a 100-1000 scale, e.g. 700 or 720; use 700 if the exam uses another scale).
- domains: the official domains with their weight in % (integers adding up to 100), a short kebab-case slug, the Spanish name in "name" and the official English name in "nameEn".
- topics: 12-25 concrete services/topics tested, with kebab-case slug, Spanish "name" and English "nameEn".`,
    aws,
  );
  if (!out.found) throw new Error("No encontré una certificación con ese nombre. Prueba con el nombre oficial o el código del examen.");

  // Normaliza pesos para que sumen 100 exactamente.
  const domains = out.domains.filter((d) => d.weight > 0).slice(0, 10);
  const sum = domains.reduce((a, d) => a + d.weight, 0) || 1;
  const weights = domains.map((d) => Math.max(1, Math.round((d.weight / sum) * 100)));
  weights[weights.indexOf(Math.max(...weights))] += 100 - weights.reduce((a, b) => a + b, 0);

  const code = out.code.trim() || out.title;
  const parsed = courseFileSchema.safeParse({
    slug: slugify(`${out.provider}-${code}`),
    title: out.title,
    provider: out.provider,
    code,
    description: out.description,
    examQuestions: Math.min(200, Math.max(10, out.examQuestions)),
    simQuestions: Math.min(200, Math.max(10, out.examQuestions)),
    timeLimitMin: Math.min(400, Math.max(10, out.timeLimitMin)),
    passingPct: Math.min(100, Math.max(1, out.passingPct)),
    passingScore: Math.min(1000, Math.max(100, out.passingScore || 700)),
    domains: domains.map((d, i) => ({
      slug: slugify(d.slug || d.name) || `d${i + 1}`,
      name: d.name,
      nameEn: d.nameEn || undefined,
      weight: weights[i],
    })),
    topics: out.topics.slice(0, 30).map((t, i) => ({
      slug: slugify(t.slug || t.name) || `t${i + 1}`,
      name: t.name,
      nameEn: t.nameEn || undefined,
    })),
  });
  if (!parsed.success) throw new Error("La IA devolvió una estructura de curso inválida; intenta de nuevo.");
  return parsed.data;
}

/** Guarda un curso generado por IA (dominios y temas). */
export async function saveCourse(outline: CourseFile, userId: string) {
  const { domains, topics, ...meta } = outline;
  const existing = await db.course.findUnique({ where: { slug: outline.slug } });
  if (existing) return existing;
  return db.course.create({
    data: {
      ...meta,
      source: "AI",
      createdById: userId,
      domains: { create: domains.map((d, order) => ({ ...d, order })) },
      topics: { create: [...new Map(topics.map((t) => [t.slug, t])).values()] },
    },
  });
}

// ---------------- lotes de preguntas ----------------

type CourseWithMeta = {
  id: string;
  slug: string;
  title: string;
  code: string;
  provider: string;
  domains: { id: string; slug: string; name: string; nameEn: string | null; weight: number }[];
  topics: { id: string; slug: string; name: string; nameEn: string | null }[];
};

const label = (x: { name: string; nameEn: string | null }) => x.nameEn || x.name;

/**
 * Genera y guarda un lote de preguntas (hasta 10, o 5 si consulta la documentación).
 * Devuelve cuántas se guardaron (las inválidas o duplicadas se descartan).
 */
export async function generateQuestionBatch(
  course: CourseWithMeta,
  opts: { topics: string[]; count: number; difficulty?: number },
) {
  const docs = usesAwsDocs(course);
  const count = Math.min(docs ? MAX_BATCH_WITH_DOCS : MAX_BATCH, Math.max(1, opts.count));
  const topics = opts.topics.length ? course.topics.filter((t) => opts.topics.includes(t.slug)) : course.topics;
  const topicSlugs = topics.map((t) => t.slug);

  // Enunciados existentes de esos temas, para que la IA no repita preguntas.
  const existing = await db.question.findMany({
    where: { courseId: course.id, ...(opts.topics.length ? { topics: { some: { topic: { slug: { in: topicSlugs } } } } } : {}) },
    select: { stem: true },
    orderBy: { createdAt: "desc" },
    take: 80,
  });

  const langBlock = { stem: z.string(), options: z.array(z.string()), explanation: z.string(), notes: z.array(z.string()) };
  const schema = z.object({
    questions: z.array(
      z.object({
        domain: z.enum(course.domains.map((d) => d.slug) as [string, ...string[]]),
        topics: z.array(z.enum(course.topics.map((t) => t.slug) as [string, ...string[]])),
        ...langBlock,
        correct: z.array(z.number().int()),
        difficulty: z.number().int(),
        sources: z.array(z.string()),
        es: z.object(langBlock),
      }),
    ),
  });

  const prompt = `Exam: ${course.title} (${course.code}).

Domains (slug: name, weight %):
${course.domains.map((d) => `- ${d.slug}: ${label(d)} (${d.weight}%)`).join("\n")}

Topics the questions must focus on (slug: name):
${topics.map((t) => `- ${t.slug}: ${label(t)}`).join("\n")}

Write exactly ${count} new questions${opts.difficulty ? ` of difficulty ${opts.difficulty}` : ""}. Each question must include at least one of the listed topics in "topics" (it may add other course topics).${
    docs ? "\nBefore writing, research the relevant features, limits and best practices with the AWS documentation tools." : ""
  }${
    existing.length
      ? `\n\nThese questions already exist; do NOT repeat them or write near-duplicates:\n${existing.map((e) => `- ${e.stem.slice(0, 160)}`).join("\n")}`
      : ""
  }`;

  const out = await askStructured(schema, EXAM_WRITER, prompt, docs);
  const domainId = new Map(course.domains.map((d) => [d.slug, d.id]));
  const topicId = new Map(course.topics.map((t) => [t.slug, t.id]));
  let saved = 0;
  for (const raw of out.questions.slice(0, count)) {
    const parsed = questionInputSchema.safeParse({
      ...raw,
      topics: [...new Set(raw.topics)].slice(0, 5),
      // Sólo URLs oficiales de AWS como fuente.
      sources: raw.sources.filter((u) => /^https:\/\/(docs\.)?aws\.amazon\.com\//.test(u)).slice(0, 6),
    });
    if (!parsed.success) continue;
    const q = parsed.data;
    const hash = stemHash(q.stem);
    const dup = await db.question.findUnique({ where: { courseId_stemHash: { courseId: course.id, stemHash: hash } } });
    if (dup) continue;
    await db.question.create({
      data: {
        id: `${course.slug}-ai-${randomBytes(5).toString("hex")}`,
        courseId: course.id,
        domainId: domainId.get(q.domain)!,
        type: q.correct.length > 1 ? "MULTI" : "SINGLE",
        stem: q.stem,
        options: JSON.stringify(q.options),
        correct: JSON.stringify(q.correct),
        explanation: q.explanation,
        optionNotes: JSON.stringify(q.notes?.length === q.options.length ? q.notes : []),
        ...esFields(q),
        sources: JSON.stringify(q.sources),
        difficulty: q.difficulty,
        source: "AI",
        stemHash: hash,
        topics: { create: q.topics.map((t) => ({ topicId: topicId.get(t)! })) },
      },
    });
    saved++;
  }
  return saved;
}

/** Genera y guarda un lote de flashcards (inglés + español) para los temas indicados. */
export async function generateFlashcardBatch(course: CourseWithMeta, topicSlugs: string[], count: number) {
  const topics = topicSlugs.length ? course.topics.filter((t) => topicSlugs.includes(t.slug)) : course.topics;
  const existing = await db.flashcard.findMany({ where: { courseId: course.id }, select: { front: true }, take: 150 });
  const schema = z.object({
    cards: z.array(
      z.object({
        topic: z.enum(course.topics.map((t) => t.slug) as [string, ...string[]]),
        front: z.string(),
        back: z.string(),
        frontEs: z.string(),
        backEs: z.string(),
      }),
    ),
  });
  const out = await askStructured(
    schema,
    "You are an expert certification tutor. Write flashcards: the front is a short question or concept, the back a precise 1-3 sentence answer with the key fact for the exam. Write front/back in English and frontEs/backEs as a Latin American Spanish translation (keep service names in English). When documentation tools are available, verify facts with them.",
    `Exam: ${course.title} (${course.code}).
Write ${Math.min(MAX_BATCH, count)} flashcards about these topics (slug: name):
${topics.map((t) => `- ${t.slug}: ${label(t)}`).join("\n")}
${existing.length ? `\nDo not repeat these:\n${existing.map((e) => `- ${e.front}`).join("\n")}` : ""}`,
    usesAwsDocs(course),
  );
  const topicId = new Map(course.topics.map((t) => [t.slug, t.id]));
  const rows = out.cards
    .filter((c) => c.front.trim().length > 1 && c.back.trim().length > 1)
    .slice(0, MAX_BATCH)
    .map((c) => ({
      id: `${course.slug}-fc-${randomBytes(5).toString("hex")}`,
      courseId: course.id,
      topicId: topicId.get(c.topic) ?? null,
      front: c.front.trim(),
      back: c.back.trim(),
      frontEs: c.frontEs.trim() || null,
      backEs: c.backEs.trim() || null,
      source: "AI",
    }));
  if (rows.length) await db.flashcard.createMany({ data: rows });
  return rows.length;
}
