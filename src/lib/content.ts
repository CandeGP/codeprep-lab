import "server-only";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeStringify from "rehype-stringify";
import GithubSlugger from "github-slugger";
import { db } from "@/lib/db";

export type LessonMeta = {
  slug: string;
  order: number;
  title: string;
  summary: string;
  tags: string[];
};

export type Heading = { id: string; text: string; depth: number };

export type Lesson = LessonMeta & { html: string; markdown: string; headings: Heading[] };

export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
};

export type Adapter = "list" | "tree" | null;

export type Problem = {
  id: string;
  lessonSlug: string;
  title: string;
  difficulty: "fácil" | "media" | "difícil";
  description: string;
  functionName: string;
  starter: { javascript: string; python: string };
  /** Conversión de argumentos/retorno para estructuras (lista enlazada, árbol). */
  argAdapters?: Adapter[];
  returnAdapter?: Adapter;
  /** Si es true, el orden del arreglo resultado no importa. */
  unordered?: boolean;
  tests: { args: unknown[]; expected: unknown }[];
  hints: string[];
  solution: { javascript: string; python: string; explanation: string };
};

// El HTML renderizado se cachea por versión (updatedAt) para no repetir shiki en cada request.
const htmlCache = new Map<string, string>();

function toMeta(l: { slug: string; order: number; title: string; summary: string; tags: string }): LessonMeta {
  return { slug: l.slug, order: l.order, title: l.title, summary: l.summary, tags: JSON.parse(l.tags) as string[] };
}

export async function listLessons(): Promise<LessonMeta[]> {
  const rows = await db.lesson.findMany({
    select: { slug: true, order: true, title: true, summary: true, tags: true },
    orderBy: [{ order: "asc" }, { slug: "asc" }],
  });
  return rows.map(toMeta);
}

function extractHeadings(markdown: string): Heading[] {
  const slugger = new GithubSlugger();
  const headings: Heading[] = [];
  let inFence = false;
  for (const line of markdown.split("\n")) {
    if (line.trimStart().startsWith("```")) inFence = !inFence;
    if (inFence) continue;
    const m = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (m) {
      const text = m[2].replace(/[`*_]/g, "");
      headings.push({ depth: m[1].length, text, id: slugger.slug(text) });
    }
  }
  return headings;
}

async function renderMarkdown(markdown: string) {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(rehypePrettyCode, {
      theme: { light: "github-light", dark: "github-dark" },
      keepBackground: false,
    })
    .use(rehypeStringify)
    .process(markdown);
  return String(file);
}

export { renderMarkdown };

export async function getLesson(slug: string): Promise<Lesson | null> {
  const row = await db.lesson.findUnique({ where: { slug } });
  if (!row) return null;
  const key = `${slug}:${row.updatedAt.getTime()}`;
  let html = htmlCache.get(key);
  if (html === undefined) {
    html = await renderMarkdown(row.markdown);
    htmlCache.set(key, html);
  }
  return { ...toMeta(row), markdown: row.markdown, headings: extractHeadings(row.markdown), html };
}

export async function getQuiz(slug: string): Promise<QuizQuestion[]> {
  const rows = await db.lessonQuestion.findMany({ where: { lessonSlug: slug }, orderBy: { order: "asc" } });
  return rows.map((r) => ({ ...(JSON.parse(r.data) as Omit<QuizQuestion, "id">), id: r.id }));
}

function toProblem(r: { id: string; lessonSlug: string; data: string }): Problem {
  return { ...(JSON.parse(r.data) as Omit<Problem, "id" | "lessonSlug">), id: r.id, lessonSlug: r.lessonSlug };
}

export async function getProblems(slug: string): Promise<Problem[]> {
  const rows = await db.problem.findMany({ where: { lessonSlug: slug }, orderBy: { order: "asc" } });
  return rows.map(toProblem);
}

export async function getAllProblems(): Promise<Problem[]> {
  const rows = await db.problem.findMany({ orderBy: [{ lesson: { order: "asc" } }, { order: "asc" }] });
  return rows.map(toProblem);
}

export async function getProblem(id: string): Promise<Problem | null> {
  const row = await db.problem.findUnique({ where: { id } });
  return row ? toProblem(row) : null;
}

export async function getAllQuestions(): Promise<QuizQuestion[]> {
  const rows = await db.lessonQuestion.findMany({ orderBy: [{ lesson: { order: "asc" } }, { order: "asc" }] });
  return rows.map((r) => ({ ...(JSON.parse(r.data) as Omit<QuizQuestion, "id">), id: r.id }));
}
