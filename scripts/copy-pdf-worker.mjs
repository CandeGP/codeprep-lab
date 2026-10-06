// Copia el worker de pdf.js a /public para servirlo como archivo estático.
import { copyFileSync, mkdirSync } from "node:fs";
mkdirSync("public", { recursive: true });
copyFileSync("node_modules/pdfjs-dist/build/pdf.worker.min.mjs", "public/pdf.worker.min.mjs");
console.log("pdf.worker.min.mjs copiado a public/");
