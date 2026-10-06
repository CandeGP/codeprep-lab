// Carga (idempotente) los cursos curados de <dir>/certs/<curso>/ en la base de datos.
//   npx tsx scripts/seed-certs.ts               → valida y carga desde ./content
//   npx tsx scripts/seed-certs.ts --dir=<ruta>  → otra carpeta (también CONTENT_DIR)
//   npx tsx scripts/seed-certs.ts --check       → sólo valida los JSON
//
// Estructura de cada curso:
//   course.json                 meta, dominios (con peso %) y temas
//   questions/batch-NN.json     lotes de preguntas (≈10 por archivo)
//   flashcards/batch-NN.json    lotes de flashcards
import fs from "node:fs";
import path from "node:path";
import { createPrismaClient } from "../src/lib/prisma";
import {
  courseFileSchema,
  flashcardFileSchema,
  questionFileSchema,
  stemHash,
  type CourseFile,
} from "../src/lib/certs/shared";
import { contentDir } from "./content-dir";

const root = path.join(contentDir(), "certs");
const checkOnly = process.argv.includes("--check");

type Loaded = {
  course: CourseFile;
  questions: (ReturnType<typeof questionFileSchema.parse> & { file: string })[];
  flashcards: (ReturnType<typeof flashcardFileSchema.parse> & { file: string })[];
};

function readBatches(dir: string) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .flatMap((f) => {
      const data = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      if (!Array.isArray(data)) throw new Error(`${dir}/${f}: se esperaba un arreglo`);
      return data.map((item: unknown) => ({ item, file: f }));
    });
}

function load(): { courses: Loaded[]; errors: string[] } {
  const errors: string[] = [];
  const courses: Loaded[] = [];
  for (const slug of fs.readdirSync(root).filter((d) => fs.statSync(path.join(root, d)).isDirectory())) {
    const dir = path.join(root, slug);
    const parsedCourse = courseFileSchema.safeParse(JSON.parse(fs.readFileSync(path.join(dir, "course.json"), "utf8")));
    if (!parsedCourse.success) {
      errors.push(`${slug}/course.json: ${parsedCourse.error.message}`);
      continue;
    }
    const course = parsedCourse.data;
    const domains = new Set(course.domains.map((d) => d.slug));
    const topics = new Set(course.topics.map((t) => t.slug));
    const weightSum = course.domains.reduce((a, d) => a + d.weight, 0);
    if (weightSum !== 100) errors.push(`${slug}: los pesos de los dominios suman ${weightSum}, no 100`);

    const ids = new Set<string>();
    const hashes = new Map<string, string>();
    const questions: Loaded["questions"] = [];
    for (const { item, file } of readBatches(path.join(dir, "questions"))) {
      const r = questionFileSchema.safeParse(item);
      const where = `${slug}/questions/${file} (${(item as { id?: string }).id ?? "?"})`;
      if (!r.success) {
        errors.push(`${where}: ${r.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
        continue;
      }
      const q = r.data;
      if (ids.has(q.id)) errors.push(`${where}: id repetido`);
      ids.add(q.id);
      const h = stemHash(q.stem);
      if (hashes.has(h)) errors.push(`${where}: enunciado duplicado de ${hashes.get(h)}`);
      hashes.set(h, q.id);
      if (!domains.has(q.domain)) errors.push(`${where}: dominio desconocido "${q.domain}"`);
      for (const t of q.topics) if (!topics.has(t)) errors.push(`${where}: tema desconocido "${t}"`);
      questions.push({ ...q, file });
    }

    const flashcards: Loaded["flashcards"] = [];
    const fids = new Set<string>();
    for (const { item, file } of readBatches(path.join(dir, "flashcards"))) {
      const r = flashcardFileSchema.safeParse(item);
      const where = `${slug}/flashcards/${file} (${(item as { id?: string }).id ?? "?"})`;
      if (!r.success) {
        errors.push(`${where}: ${r.error.message}`);
        continue;
      }
      if (fids.has(r.data.id)) errors.push(`${where}: id repetido`);
      fids.add(r.data.id);
      if (r.data.topic && !topics.has(r.data.topic)) errors.push(`${where}: tema desconocido "${r.data.topic}"`);
      flashcards.push({ ...r.data, file });
    }
    courses.push({ course, questions, flashcards });
  }
  return { courses, errors };
}

async function seed(courses: Loaded[]) {
  const db = createPrismaClient();
  try {
    for (const { course, questions, flashcards } of courses) {
      const { domains, topics, ...meta } = course;
      const c = await db.course.upsert({
        where: { slug: course.slug },
        create: { ...meta, source: "CURATED" },
        update: meta,
      });
      const domainIds = new Map<string, string>();
      for (const [order, d] of domains.entries()) {
        const row = await db.domain.upsert({
          where: { courseId_slug: { courseId: c.id, slug: d.slug } },
          create: { courseId: c.id, slug: d.slug, name: d.name, nameEn: d.nameEn ?? null, weight: d.weight, order },
          update: { name: d.name, nameEn: d.nameEn ?? null, weight: d.weight, order },
        });
        domainIds.set(d.slug, row.id);
      }
      const topicIds = new Map<string, string>();
      for (const t of topics) {
        const row = await db.topic.upsert({
          where: { courseId_slug: { courseId: c.id, slug: t.slug } },
          create: { courseId: c.id, slug: t.slug, name: t.name, nameEn: t.nameEn ?? null },
          update: { name: t.name, nameEn: t.nameEn ?? null },
        });
        topicIds.set(t.slug, row.id);
      }

      for (const q of questions) {
        const data = {
          courseId: c.id,
          domainId: domainIds.get(q.domain)!,
          type: q.correct.length > 1 ? "MULTI" : "SINGLE",
          stem: q.stem,
          options: JSON.stringify(q.options),
          correct: JSON.stringify(q.correct),
          explanation: q.explanation,
          optionNotes: JSON.stringify(q.notes ?? []),
          stemEs: q.es?.stem ?? null,
          optionsEs: q.es ? JSON.stringify(q.es.options) : null,
          explanationEs: q.es?.explanation ?? null,
          optionNotesEs: q.es?.notes ? JSON.stringify(q.es.notes) : null,
          sources: JSON.stringify(q.sources),
          difficulty: q.difficulty,
          source: "CURATED",
          stemHash: stemHash(q.stem),
        };
        // Si otra pregunta (p. ej. generada por IA) ya tiene el mismo enunciado, se deja la existente.
        const clash = await db.question.findUnique({
          where: { courseId_stemHash: { courseId: c.id, stemHash: data.stemHash } },
          select: { id: true },
        });
        if (clash && clash.id !== q.id) continue;
        await db.question.upsert({ where: { id: q.id }, create: { id: q.id, ...data }, update: data });
        await db.questionTopic.deleteMany({ where: { questionId: q.id } });
        await db.questionTopic.createMany({ data: q.topics.map((t) => ({ questionId: q.id, topicId: topicIds.get(t)! })) });
      }

      // Preguntas curadas que ya no están en los archivos: se ocultan (no se borran) para conservar el historial.
      const retired = await db.question.updateMany({
        where: { courseId: c.id, source: "CURATED", status: { not: "HIDDEN" }, id: { notIn: questions.map((q) => q.id) } },
        data: { status: "HIDDEN" },
      });
      if (retired.count) console.log(`  ${retired.count} preguntas curadas retiradas (ocultas)`);

      for (const f of flashcards) {
        const data = {
          courseId: c.id,
          topicId: f.topic ? topicIds.get(f.topic)! : null,
          front: f.front,
          back: f.back,
          frontEs: f.es?.front ?? null,
          backEs: f.es?.back ?? null,
        };
        await db.flashcard.upsert({ where: { id: f.id }, create: { id: f.id, ...data }, update: data });
      }
      console.log(`✓ ${course.code}: ${questions.length} preguntas, ${flashcards.length} flashcards`);
    }
  } finally {
    await db.$disconnect();
  }
}

async function main() {
  const { courses, errors } = load();
  if (errors.length) {
    console.error(`✗ ${errors.length} error(es) en ${root}:\n  ` + errors.join("\n  "));
    process.exit(1);
  }
  for (const { course, questions } of courses) {
    const byDomain = course.domains.map((d) => `${d.slug}=${questions.filter((q) => q.domain === d.slug).length}`);
    const withEs = questions.filter((q) => q.es).length;
    const withSrc = questions.filter((q) => q.sources.length).length;
    console.log(`${course.code}: ${questions.length} preguntas (${byDomain.join(", ")}) · ES ${withEs} · con fuentes ${withSrc}`);
  }
  if (!checkOnly) await seed(courses);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
