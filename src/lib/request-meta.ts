import "server-only";
import { db } from "./db";

/**
 * IP, navegador e idioma de quien hace la petición.
 * Detrás de Tailscale Funnel (o cualquier proxy) la IP real viene en X-Forwarded-For.
 */
export function requestMeta(req: Request) {
  const h = req.headers;
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ip: forwarded || h.get("x-real-ip") || null,
    userAgent: h.get("user-agent")?.slice(0, 500) ?? null,
    language: h.get("accept-language")?.split(",")[0]?.trim().slice(0, 35) || null,
  };
}

export async function recordLoginEvent(userId: string, kind: "REGISTER" | "LOGIN", req: Request) {
  await db.loginEvent.create({ data: { userId, kind, ...requestMeta(req) } });
}

/** Resumen legible de un User-Agent, p. ej. "Chrome 140 · Windows · Escritorio". */
export function describeUserAgent(ua: string | null) {
  if (!ua) return "—";
  const browser =
    match(ua, /Edg(?:e|A|iOS)?\/(\d+)/, "Edge") ??
    match(ua, /OPR\/(\d+)/, "Opera") ??
    match(ua, /SamsungBrowser\/(\d+)/, "Samsung Internet") ??
    match(ua, /Firefox\/(\d+)/, "Firefox") ??
    match(ua, /FxiOS\/(\d+)/, "Firefox") ??
    match(ua, /CriOS\/(\d+)/, "Chrome") ??
    match(ua, /Chrome\/(\d+)/, "Chrome") ??
    match(ua, /Version\/(\d+).*Safari/, "Safari") ??
    (/curl|wget|python|node/i.test(ua) ? "Script/bot" : "Otro");
  const os = /Windows/.test(ua)
    ? "Windows"
    : /iPhone|iPad|iPod/.test(ua)
      ? "iOS"
      : /Android/.test(ua)
        ? "Android"
        : /Mac OS X|Macintosh/.test(ua)
          ? "macOS"
          : /CrOS/.test(ua)
            ? "ChromeOS"
            : /Linux/.test(ua)
              ? "Linux"
              : "?";
  const device = /iPad|Tablet/.test(ua) ? "Tablet" : /Mobi|iPhone|Android/.test(ua) ? "Móvil" : "Escritorio";
  return `${browser} · ${os} · ${device}`;
}

function match(ua: string, re: RegExp, name: string) {
  const m = ua.match(re);
  return m ? `${name} ${m[1]}` : null;
}
