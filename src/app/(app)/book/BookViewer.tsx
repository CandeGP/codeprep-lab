"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { NotesPanel } from "@/components/NotesPanel";
import { ChatPanel } from "@/components/ChatPanel";
import { useAiEnabled } from "@/components/AiContext";

type Props = {
  pdf: { filename: string; size: number; lastPage: number } | null;
  initialPage: number;
  savedPages: number[];
  /** "blob": sube directo a Vercel Blob; "db": sube a /api/pdf (local y Docker). */
  storage: "blob" | "db";
  userId: string;
};

const RANGE_CHUNK = 1024 * 1024;
const MAX_REQUEST = 4 * 1024 * 1024;

/** Descarga [begin, end) de /api/pdf en peticiones de hasta 4 MB. */
async function fetchRange(begin: number, end: number): Promise<Uint8Array> {
  const out = new Uint8Array(end - begin);
  for (let from = begin; from < end; from += MAX_REQUEST) {
    const to = Math.min(from + MAX_REQUEST, end);
    const res = await fetch("/api/pdf", { headers: { Range: `bytes=${from}-${to - 1}` } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length !== to - from) throw new Error("respuesta incompleta");
    out.set(buf, from - begin);
  }
  return out;
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
}

export function BookViewer({ pdf, initialPage, savedPages, storage, userId }: Props) {
  const router = useRouter();
  const ai = useAiEnabled();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTask = useRef<RenderTask | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(initialPage);
  const [pageInput, setPageInput] = useState(String(initialPage));
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(new Set(savedPages));
  const [side, setSide] = useState<"notes" | "ai" | null>("notes");

  // Carga el documento del usuario.
  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        // Se lee por rangos (≤ 4 MB por petición) para funcionar también en Vercel.
        const transport = new pdfjs.PDFDataRangeTransport(pdf.size, null);
        transport.requestDataRange = (begin: number, end: number) => {
          fetchRange(begin, end)
            .then((chunk) => transport.onDataRange(begin, chunk))
            .catch((e) => !cancelled && setError(`No se pudo leer el PDF: ${(e as Error).message}`));
        };
        const loaded = await pdfjs.getDocument({ range: transport, rangeChunkSize: RANGE_CHUNK, disableAutoFetch: true })
          .promise;
        if (!cancelled) {
          setDoc(loaded);
          setPage((p) => Math.min(Math.max(1, p), loaded.numPages));
        }
      } catch (e) {
        if (!cancelled) setError(`No se pudo abrir el PDF: ${(e as Error).message}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdf]);

  // Renderiza la página actual ajustada al ancho disponible.
  const render = useCallback(async () => {
    if (!doc || !canvasRef.current || !containerRef.current) return;
    renderTask.current?.cancel();
    const p = await doc.getPage(page);
    const base = p.getViewport({ scale: 1 });
    const width = Math.min(containerRef.current.clientWidth - 32, 1100);
    const scale = (width / base.width) * zoom;
    const viewport = p.getViewport({ scale });
    const dpr = window.devicePixelRatio || 1;
    const canvas = canvasRef.current;
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;
    const task = p.render({ canvas, viewport, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined });
    renderTask.current = task;
    try {
      await task.promise;
    } catch {
      /* render cancelado */
    }
  }, [doc, page, zoom]);

  useEffect(() => {
    render();
  }, [render, side]);

  useEffect(() => {
    const onResize = () => render();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [render]);

  // Guarda la última página leída (con retraso para no saturar).
  useEffect(() => {
    setPageInput(String(page));
    if (!doc) return;
    const t = setTimeout(() => {
      fetch("/api/pdf", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lastPage: page }) });
    }, 800);
    return () => clearTimeout(t);
  }, [page, doc]);

  // Atajos de teclado: ← → para cambiar de página.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowRight") go(page + 1);
      if (e.key === "ArrowLeft") go(page - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function go(n: number) {
    if (!doc) return;
    setPage(Math.min(Math.max(1, n), doc.numPages));
  }

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      if (storage === "blob") {
        // Directo del navegador a Vercel Blob; luego se registra en la base.
        const { upload: uploadToBlob } = await import("@vercel/blob/client");
        const blob = await uploadToBlob(`pdf/${userId}/${file.name.replace(/[^\w.-]+/g, "_")}`, file, {
          access: "private",
          handleUploadUrl: "/api/pdf/upload",
          contentType: "application/pdf",
          multipart: file.size > 20 * 1024 * 1024,
        });
        await postJson("/api/pdf/commit", { url: blob.url, filename: file.name });
      } else {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/pdf", { method: "POST", body: form });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Error al subir");
      }
    } catch (e) {
      setUploading(false);
      setError((e as Error).message);
      return;
    }
    router.refresh();
    location.reload();
  }

  async function removePdf() {
    if (!confirm("¿Eliminar tu copia local del PDF? Tus notas por página se conservan.")) return;
    await fetch("/api/pdf", { method: "DELETE" });
    location.reload();
  }

  async function toggleSaved() {
    const res = await fetch("/api/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "PDF_PAGE", ref: String(page), label: `Libro · página ${page}` }),
    });
    if (res.ok) {
      const { saved: isSaved } = await res.json();
      const next = new Set(saved);
      if (isSaved) next.add(page);
      else next.delete(page);
      setSaved(next);
    }
  }

  if (!pdf) {
    return (
      <div className="max-w-2xl mx-auto px-4 md:px-8 py-10">
        <h1 className="text-3xl font-bold">Mi libro (PDF)</h1>
        <p className="text-muted mt-2">
          Carga tu propia copia del libro en PDF para leerla en pantalla junto a tus notas por página. El archivo se guarda de
          forma privada asociado a tu cuenta y únicamente tu usuario puede abrirlo.
        </p>
        <label className="card mt-6 p-10 flex flex-col items-center justify-center gap-3 border-dashed cursor-pointer hover:border-accent">
          <span className="text-4xl">▤</span>
          <span className="font-medium">{uploading ? "Subiendo…" : "Selecciona un archivo PDF"}</span>
          <span className="text-xs text-muted">Máximo 200 MB</span>
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            disabled={uploading}
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
        </label>
        {error && <p className="text-bad text-sm mt-3">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] md:h-screen">
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-border bg-surface">
          <span className="text-sm font-medium truncate max-w-48" title={pdf.filename}>{pdf.filename}</span>
          <div className="flex items-center gap-1 ml-auto">
            <button className="btn" onClick={() => go(page - 1)} disabled={page <= 1}>←</button>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                go(Number(pageInput) || 1);
              }}
              className="flex items-center gap-1 text-sm"
            >
              <input className="input !w-16 !py-1 text-center" value={pageInput} onChange={(e) => setPageInput(e.target.value)} />
              <span className="text-muted">/ {doc?.numPages ?? "…"}</span>
            </form>
            <button className="btn" onClick={() => go(page + 1)} disabled={!doc || page >= doc.numPages}>→</button>
          </div>
          <div className="flex items-center gap-1">
            <button className="btn" onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))}>−</button>
            <span className="text-xs w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button className="btn" onClick={() => setZoom((z) => Math.min(3, z + 0.15))}>+</button>
          </div>
          <button className="btn" onClick={toggleSaved}>
            <span className={saved.has(page) ? "text-warn" : ""}>{saved.has(page) ? "★" : "☆"}</span> Página
          </button>
          <button className="btn" onClick={() => setSide(side === "notes" ? null : "notes")}>✎ Notas</button>
          {ai && <button className="btn" onClick={() => setSide(side === "ai" ? null : "ai")}>✦ IA</button>}
          <label className="btn cursor-pointer">
            Reemplazar
            <input type="file" accept="application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
          <button className="btn !text-bad" onClick={removePdf}>Quitar</button>
        </div>
        <div ref={containerRef} className="flex-1 overflow-auto bg-surface-2 p-4">
          {error ? (
            <p className="text-bad text-sm">{error}</p>
          ) : !doc ? (
            <p className="text-muted text-sm">Cargando PDF…</p>
          ) : (
            <canvas ref={canvasRef} className="mx-auto shadow-lg bg-white" />
          )}
        </div>
      </div>
      {side && (
        <aside className="hidden md:flex w-[24rem] shrink-0 flex-col border-l border-border bg-bg">
          <div className="px-4 h-12 flex items-center justify-between border-b border-border">
            <span className="font-semibold text-sm">{side === "notes" ? `Notas · página ${page}` : "Tutor IA"}</span>
            <button className="text-muted cursor-pointer" onClick={() => setSide(null)}>✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {side === "notes" || !ai ? (
              <NotesPanel key={page} pdfPage={page} />
            ) : (
              <ChatPanel
                tall
                suggestions={["Explícame con otras palabras el tema que estoy leyendo", "Hazme 3 preguntas para comprobar que entendí"]}
              />
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
