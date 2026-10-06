// Verifica que las soluciones de referencia de cada ejercicio pasen sus pruebas,
// usando exactamente el mismo corrector que corre en el navegador.
//   node scripts/verify-problems.mjs          → JavaScript
//   node scripts/verify-problems.mjs --python → también Python (requiere python en PATH)
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const dirArg = process.argv.find((a) => a.startsWith("--dir="));
const lessonsDir = path.join(path.resolve(dirArg ? dirArg.slice(6) : (process.env.CONTENT_DIR ?? "content")), "lessons");
const withPython = process.argv.includes("--python");

const problems = [];
for (const lesson of fs.readdirSync(lessonsDir)) {
  const dir = path.join(lessonsDir, lesson, "problems");
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    problems.push({ file: `${lesson}/${f}`, ...JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) });
  }
}

const jsWorker = fs.readFileSync(path.join(root, "public", "runner", "js-worker.js"), "utf8");

function runJs(p, code) {
  let out;
  const self = { postMessage: (m) => (out = m) };
  const ctx = vm.createContext({ self, structuredClone, performance, console });
  vm.runInContext(jsWorker, ctx);
  ctx.self.onmessage({
    data: {
      code,
      functionName: p.functionName,
      tests: p.tests,
      argAdapters: p.argAdapters ?? [],
      returnAdapter: p.returnAdapter ?? null,
      unordered: p.unordered ?? false,
    },
  });
  return out;
}

function runPy(p, code) {
  const src = fs.readFileSync(path.join(root, "public", "runner", "py-worker.js"), "utf8");
  const harness = src.slice(src.indexOf("const HARNESS = `") + 17, src.indexOf("`;", src.indexOf("const HARNESS")));
  const payload = JSON.stringify({
    code,
    fn: p.functionName,
    tests: p.tests,
    args: p.argAdapters ?? [],
    ret: p.returnAdapter ?? null,
    unordered: p.unordered ?? false,
  });
  const script = `${harness}\nimport json,sys\nd=json.loads(sys.stdin.read())\nprint(_run(d["code"],d["fn"],d["tests"],d["args"],d["ret"],d["unordered"]))`;
  const r = spawnSync("python", ["-c", script], { input: payload, encoding: "utf8" });
  if (r.status !== 0) return { type: "error", error: r.stderr };
  return JSON.parse(r.stdout.trim().split("\n").pop());
}

let failures = 0;
const ids = new Set();
for (const p of problems) {
  if (ids.has(p.id)) {
    console.log(`✗ id duplicado: ${p.id}`);
    failures++;
  }
  ids.add(p.id);
  const langs = [["javascript", runJs], ...(withPython ? [["python", runPy]] : [])];
  for (const [lang, run] of langs) {
    const out = run(p, p.solution[lang]);
    const ok = out?.type === "done" && out.results.every((r) => r.passed);
    if (!ok) {
      failures++;
      console.log(`✗ ${p.file} [${lang}]`);
      if (out?.type === "error") console.log("   ", out.error);
      else for (const r of out.results.filter((r) => !r.passed)) console.log("   ", JSON.stringify(r));
    }
    // El código inicial no debe pasar todas las pruebas.
    const starter = run(p, p.starter[lang]);
    if (starter?.type === "done" && starter.results.every((r) => r.passed)) {
      failures++;
      console.log(`✗ ${p.file} [${lang}] el código inicial ya pasa todas las pruebas`);
    }
  }
}
console.log(`\n${problems.length} ejercicios verificados${withPython ? " (JS + Python)" : " (JS)"}; ${failures} fallas.`);
process.exit(failures ? 1 : 0);
