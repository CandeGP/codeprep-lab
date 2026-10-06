import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

/**
 * Crea el cliente de Prisma.
 * - Con TURSO_DATABASE_URL (p. ej. en Vercel) se conecta a Turso con el adaptador libSQL.
 * - Sin ella usa el archivo SQLite de DATABASE_URL (desarrollo local y Docker).
 * Sin "server-only" para que también lo usen los scripts de importación.
 */
export function createPrismaClient() {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) return new PrismaClient();
  return new PrismaClient({ adapter: new PrismaLibSQL({ url, authToken: process.env.TURSO_AUTH_TOKEN }) });
}
