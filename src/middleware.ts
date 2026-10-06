import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/login", "/register", "/api/auth"];

/**
 * Filtro rápido: si no hay cookie de sesión redirige a /login.
 * La validación real de la sesión se hace en el servidor (lib/auth.ts).
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (!req.cookies.get("codeprep_session")) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|runner/|pdf\\.worker\\.min\\.mjs|.*\\.svg$).*)"],
};
