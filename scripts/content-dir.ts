import path from "node:path";

/** Carpeta con el contenido a importar: --dir=<ruta>, CONTENT_DIR o ./content. */
export function contentDir(): string {
  const arg = process.argv.find((a) => a.startsWith("--dir="));
  return path.resolve(arg ? arg.slice("--dir=".length) : (process.env.CONTENT_DIR ?? "content"));
}
