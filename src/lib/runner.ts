"use client";

export type Language = "javascript" | "python";

export type TestResult = {
  index: number;
  passed: boolean;
  input: unknown[];
  expected: unknown;
  actual?: unknown;
  error?: string;
  ms?: number;
};

export type RunOutput =
  | { type: "done"; results: TestResult[]; logs: string[] }
  | { type: "error"; error: string; logs: string[] };

export type RunRequest = {
  code: string;
  functionName: string;
  tests: { args: unknown[]; expected: unknown }[];
  argAdapters?: (string | null)[];
  returnAdapter?: string | null;
  unordered?: boolean;
};

// Python mantiene un worker vivo para no recargar Pyodide en cada ejecución.
let pyWorker: Worker | null = null;

const TIMEOUT_MS = { javascript: 4000, python: 8000 };
const PY_FIRST_LOAD_MS = 60000;
let pyLoaded = false;

export function runCode(language: Language, req: RunRequest, onStatus?: (s: string) => void): Promise<RunOutput> {
  return new Promise((resolve) => {
    const worker =
      language === "javascript"
        ? new Worker("/runner/js-worker.js")
        : (pyWorker ??= new Worker("/runner/py-worker.js"));

    const limit = language === "python" && !pyLoaded ? PY_FIRST_LOAD_MS : TIMEOUT_MS[language];
    const timer = setTimeout(() => {
      worker.terminate();
      if (language === "python") {
        pyWorker = null;
        pyLoaded = false;
      }
      resolve({
        type: "error",
        error: `Tiempo límite excedido (${limit / 1000}s). ¿Hay un ciclo infinito o una solución demasiado lenta?`,
        logs: [],
      });
    }, limit);

    worker.onmessage = (e: MessageEvent) => {
      if (e.data.type === "status") {
        onStatus?.(e.data.status);
        return;
      }
      clearTimeout(timer);
      if (language === "javascript") worker.terminate();
      else pyLoaded = true;
      resolve(e.data as RunOutput);
    };
    worker.onerror = (e) => {
      clearTimeout(timer);
      if (language === "javascript") worker.terminate();
      resolve({ type: "error", error: e.message || "Error en el ejecutor", logs: [] });
    };
    worker.postMessage(req);
  });
}
