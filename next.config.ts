import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite construir en otra carpeta (NEXT_DIST_DIR=.next-build) sin pisar la de `npm run dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // El driver de Turso (libsql) trae binarios nativos: se carga desde node_modules sin empaquetar.
  serverExternalPackages: ["@prisma/adapter-libsql", "@libsql/client", "libsql"],
};

export default nextConfig;
