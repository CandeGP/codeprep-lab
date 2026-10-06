"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/", label: "Inicio", icon: "⌂" },
  { href: "/index", label: "Índice", icon: "☰" },
  { href: "/learn", label: "Aprender", icon: "📘" },
  { href: "/review", label: "Repasar", icon: "↻" },
  { href: "/practice", label: "Practicar", icon: "</>" },
  { href: "/certs", label: "Certificaciones", icon: "☁" },
  { href: "/ask", label: "Preguntar a la IA", icon: "✦" },
  { href: "/saved", label: "Guardados", icon: "★" },
  { href: "/notes", label: "Notas", icon: "✎" },
  { href: "/book", label: "Mi libro (PDF)", icon: "▤" },
  { href: "/settings", label: "Configuración", icon: "⚙" },
];

type Props = { username: string; dueCount: number; certDueCount?: number; showAsk?: boolean; pendingCount?: number };

export function Sidebar({ username, dueCount, certDueCount = 0, showAsk = false, pendingCount = 0 }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  useEffect(() => setOpen(false), [pathname]);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface px-4 h-14">
        <Link href="/" className="font-bold">CodePrep</Link>
        <button className="btn" onClick={() => setOpen((o) => !o)} aria-label="Menú">☰</button>
      </header>
      <aside
        className={`fixed md:sticky top-0 z-40 h-screen w-64 shrink-0 border-r border-border bg-surface flex flex-col transition-transform md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-5 h-16 flex items-center justify-between">
          <Link href="/" className="font-bold text-lg tracking-tight">
            Code<span className="text-accent">Prep</span>
          </Link>
          <button className="md:hidden text-muted" onClick={() => setOpen(false)} aria-label="Cerrar">✕</button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 space-y-0.5">
          {NAV.filter((item) => showAsk || item.href !== "/ask").map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                isActive(item.href) ? "bg-accent/10 text-accent font-semibold" : "hover:bg-surface-2"
              }`}
            >
              <span className="w-5 text-center text-xs font-mono">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.href === "/review" && dueCount > 0 && (
                <span className="rounded-full bg-accent text-accent-fg text-[10px] font-bold px-1.5 py-0.5">{dueCount}</span>
              )}
              {item.href === "/certs" && certDueCount > 0 && (
                <span className="rounded-full bg-accent text-accent-fg text-[10px] font-bold px-1.5 py-0.5">{certDueCount}</span>
              )}
              {item.href === "/settings" && pendingCount > 0 && (
                <span className="rounded-full bg-warn text-white text-[10px] font-bold px-1.5 py-0.5" title="Solicitudes de acceso">
                  {pendingCount}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="border-t border-border p-3 space-y-2">
          <div className="px-2 text-sm">
            <span className="text-muted">Sesión: </span>
            <span className="font-medium">{username}</span>
          </div>
          <div className="flex gap-2">
            <button className="btn flex-1" onClick={toggleTheme}>{dark ? "☀ Claro" : "☾ Oscuro"}</button>
            <button className="btn flex-1" onClick={logout}>Salir</button>
          </div>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setOpen(false)} />}
    </>
  );
}
