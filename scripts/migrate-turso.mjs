// Aplica las migraciones de prisma/migrations a Turso (Prisma Migrate no soporta Turso).
//   node scripts/migrate-turso.mjs   → usa TURSO_DATABASE_URL y TURSO_AUTH_TOKEN
//
// Lleva el registro en la tabla _turso_migrations; cada migración se aplica una sola vez, en orden.
// Si TURSO_DATABASE_URL no está definida no hace nada (desarrollo local con SQLite).
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.log("TURSO_DATABASE_URL no está definida: se omiten las migraciones de Turso.");
  process.exit(0);
}

const dir = path.join(import.meta.dirname, "..", "prisma", "migrations");
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

try {
  await client.execute(
    "CREATE TABLE IF NOT EXISTS _turso_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
  );
  const applied = new Set((await client.execute("SELECT name FROM _turso_migrations")).rows.map((r) => String(r.name)));
  const pending = fs
    .readdirSync(dir)
    .filter((d) => fs.existsSync(path.join(dir, d, "migration.sql")))
    .sort()
    .filter((d) => !applied.has(d));

  if (!pending.length) console.log("Turso al día: no hay migraciones pendientes.");
  for (const name of pending) {
    const sql = fs.readFileSync(path.join(dir, name, "migration.sql"), "utf8");
    await client.executeMultiple(sql);
    await client.execute({ sql: "INSERT INTO _turso_migrations (name) VALUES (?)", args: [name] });
    console.log(`✓ ${name}`);
  }
} catch (err) {
  console.error("✗ Error aplicando migraciones en Turso:", err);
  process.exitCode = 1;
} finally {
  client.close();
}
