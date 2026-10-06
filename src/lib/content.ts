import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeStringify from "rehype-stringify";
import GithubSlugger from "github-slugger";

const LESSONS_DIR = path.join(process.cwd(), "content", "lessons");

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

async function exists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

const cache = new Map<string, unknown>();
const dev = process.env.NODE_ENV !== "production";

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (!dev && cache.has(key)) return cache.get(key) as T;
  const value = await fn();
  cache.set(key, value);
  return value;
}

export function listLessons(): Promise<LessonMeta[]> {
  return cached("lessons", async () => {
    const dirs = await fs.readdir(LESSONS_DIR, { withFileTypes: true });
    const metas: LessonMeta[] = [];
    for (const d of dirs) {
      if (!d.isDirectory()) continue;
      const file = path.join(LESSONS_DIR, d.name, "lesson.md");
      if (!(await exists(file))) continue;
      const { data } = matter(await fs.readFile(file, "utf8"));
      metas.push({
        slug: d.name,
        order: Number(data.order ?? 999),
        title: String(data.title ?? d.name),
        summary: String(data.summary ?? ""),
        tags: (data.tags as string[]) ?? [],
      });
    }
    return metas.sort((a, b) => a.order - b.order);
  });
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

export function getLesson(slug: string): Promise<Lesson | null> {
  return cached(`lesson:${slug}`, async () => {
    if (!/^[\w-]+$/.test(slug)) return null;
    const file = path.join(LESSONS_DIR, slug, "lesson.md");
    if (!(await exists(file))) return null;
    const { data, content } = matter(await fs.readFile(file, "utf8"));
    return {
      slug,
      order: Number(data.order ?? 999),
      title: String(data.title ?? slug),
      summary: String(data.summary ?? ""),
      tags: (data.tags as string[]) ?? [],
      markdown: content,
      headings: extractHeadings(content),
      html: await renderMarkdown(content),
    };
  });
}

export function getQuiz(slug: string): Promise<QuizQuestion[]> {
  return cached(`quiz:${slug}`, async () => {
    const file = path.join(LESSONS_DIR, slug, "quiz.json");
    if (!(await exists(file))) return [];
    const questions = JSON.parse(await fs.readFile(file, "utf8")) as Omit<QuizQuestion, "id">[] & { id?: string }[];
    return questions.map((q, i) => ({ ...(q as QuizQuestion), id: `${slug}:${(q as { id?: string }).id ?? i}` }));
  });
}

export function getProblems(slug: string): Promise<Problem[]> {
  return cached(`problems:${slug}`, async () => {
    const dir = path.join(LESSONS_DIR, slug, "problems");
    if (!(await exists(dir))) return [];
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json")).sort();
    const problems: Problem[] = [];
    for (const f of files) {
      const p = JSON.parse(await fs.readFile(path.join(dir, f), "utf8"));
      problems.push({ ...p, lessonSlug: slug });
    }
    return problems;
  });
}

export async function getAllProblems(): Promise<Problem[]> {
  const lessons = await listLessons();
  return (await Promise.all(lessons.map((l) => getProblems(l.slug)))).flat();
}

export async function getProblem(id: string): Promise<Problem | null> {
  return (await getAllProblems()).find((p) => p.id === id) ?? null;
}

export async function getAllQuestions(): Promise<QuizQuestion[]> {
  const lessons = await listLessons();
  return (await Promise.all(lessons.map((l) => getQuiz(l.slug)))).flat();
}
