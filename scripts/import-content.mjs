// Importa lecciones y cursos de certificación a la base de datos.
//   npm run content:import                     → desde ./content
//   npm run content:import -- --dir=<ruta>     → desde otra carpeta (también CONTENT_DIR)
//   npm run content:check                      → sólo valida
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const tsx = createRequire(import.meta.url).resolve("tsx/cli");

const args = process.argv.slice(2);
for (const script of ["scripts/seed-lessons.ts", "scripts/seed-certs.ts"]) {
  const r = spawnSync(process.execPath, [tsx, script, ...args], { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
