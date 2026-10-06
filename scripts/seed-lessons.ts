// Carga (sincroniza) las lecciones de <dir>/lessons/NN-slug/ en la base de datos.
//   npx tsx scripts/seed-lessons.ts                → lee ./content
//   npx tsx scripts/seed-lessons.ts --dir=<ruta>   → lee otra carpeta (también CONTENT_DIR)
//   npx tsx scripts/seed-lessons.ts --check        → sólo valida
//
// La carpeta es la fuente: las lecciones que ya no estén ahí se borran de la base
// (con sus quizzes y ejercicios). El progreso de los usuarios no se toca.
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { createPrismaClient } from "../src/lib/prisma";
import { contentDir } from "./content-dir";

const root = path.join(contentDir(), "lessons");
const checkOnly = process.argv.includes("--check");

type LoadedLesson = {
  slug: string;
  order: number;
  title: string;
  summary: string;
  tags: string[];
  markdown: string;
  questions: { id: string; data: Record<string, unknown> }[];
  problems: { id: string; data: Record<string, unknown> }[];
};

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function load(): { lessons: LoadedLesson[]; errors: string[] } {
  const errors: string[] = [];
  const lessons: LoadedLesson[] = [];
  const problemIds = new Map<string, string>();
  if (!fs.existsSync(root)) return { lessons, errors: [`No existe la carpeta ${root}`] };

  for (const slug of fs.readdirSync(root).sort()) {
    const dir = path.join(root, slug);
    const mdFile = path.join(dir, "lesson.md");
    if (!fs.statSync(dir).isDirectory() || !fs.existsSync(mdFile)) continue;
    if (!/^[\w-]+$/.test(slug)) {
      errors.push(`${slug}: el nombre de la carpeta sólo puede tener letras, números, - y _`);
      continue;
    }
    const { data, content } = matter(fs.readFileSync(mdFile, "utf8"));

    const questions: LoadedLesson["questions"] = [];
    const quizFile = path.join(dir, "quiz.json");
    if (fs.existsSync(quizFile)) {
      const raw = readJson(quizFile);
      if (!Array.isArray(raw)) errors.push(`${slug}/quiz.json: se esperaba un arreglo`);
      else
        raw.forEach((q: Record<string, unknown>, i) => {
          const { id, ...rest } = q;
          if (typeof rest.question !== "string" || !Array.isArray(rest.options) || typeof rest.answer !== "number")
            errors.push(`${slug}/quiz.json #${i}: faltan question, options o answer`);
          questions.push({ id: `${slug}:${id ?? i}`, data: rest });
        });
    }

    const problems: LoadedLesson["problems"] = [];
    const probDir = path.join(dir, "problems");
    if (fs.existsSync(probDir)) {
      for (const f of fs.readdirSync(probDir).filter((f) => f.endsWith(".json")).sort()) {
        const { id, ...rest } = readJson(path.join(probDir, f)) as Record<string, unknown>;
        delete rest.lessonSlug; // se asigna según la carpeta
        const where = `${slug}/problems/${f}`;
        if (typeof id !== "string") {
          errors.push(`${where}: falta id`);
          continue;
        }
        if (problemIds.has(id)) errors.push(`${where}: id "${id}" repetido (también en ${problemIds.get(id)})`);
        problemIds.set(id, where);
        if (typeof rest.functionName !== "string" || !Array.isArray(rest.tests))
          errors.push(`${where}: faltan functionName o tests`);
        problems.push({ id, data: rest });
      }
    }

    lessons.push({
      slug,
      order: Number(data.order ?? 999),
      title: String(data.title ?? slug),
      summary: String(data.summary ?? ""),
      tags: (data.tags as string[]) ?? [],
      markdown: content,
      questions,
      problems,
    });
  }
  return { lessons, errors };
}

async function seed(lessons: LoadedLesson[]) {
  const db = createPrismaClient();
  try {
    for (const l of lessons) {
      const meta = { order: l.order, title: l.title, summary: l.summary, tags: JSON.stringify(l.tags), markdown: l.markdown };
      await db.$transaction([
        db.lesson.upsert({ where: { slug: l.slug }, create: { slug: l.slug, ...meta }, update: meta }),
        db.lessonQuestion.deleteMany({ where: { lessonSlug: l.slug } }),
        db.problem.deleteMany({ where: { lessonSlug: l.slug } }),
        db.lessonQuestion.createMany({
          data: l.questions.map((q, order) => ({ id: q.id, lessonSlug: l.slug, order, data: JSON.stringify(q.data) })),
        }),
        db.problem.createMany({
          data: l.problems.map((p, order) => ({ id: p.id, lessonSlug: l.slug, order, data: JSON.stringify(p.data) })),
        }),
      ]);
      console.log(`✓ ${l.slug}: ${l.questions.length} preguntas, ${l.problems.length} ejercicios`);
    }
    const removed = await db.lesson.deleteMany({ where: { slug: { notIn: lessons.map((l) => l.slug) } } });
    if (removed.count) console.log(`  ${removed.count} lecciones que ya no están en la carpeta fueron borradas`);
  } finally {
    await db.$disconnect();
  }
}

async function main() {
  const { lessons, errors } = load();
  if (errors.length) {
    console.error(`✗ ${errors.length} error(es) en ${root}:\n  ` + errors.join("\n  "));
    process.exit(1);
  }
  if (!lessons.length) {
    // Evita vaciar la base por apuntar a una carpeta equivocada.
    console.error(`✗ No se encontraron lecciones en ${root}`);
    process.exit(1);
  }
  console.log(`${lessons.length} lecciones en ${root}`);
  if (!checkOnly) await seed(lessons);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
