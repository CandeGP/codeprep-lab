"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
    });
    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Error");
      return;
    }
    if (data.pending) {
      setPending(String(form.get("username")));
      return;
    }
    const next = params.get("next");
    router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
    router.refresh();
  }

  const isLogin = mode === "login";

  if (pending) {
    return (
      <div className="min-h-screen grid place-items-center px-4">
        <div className="w-full max-w-sm card p-7 shadow-sm space-y-4">
          <div>
            <div className="text-xs font-semibold tracking-widest text-accent uppercase">CodePrep</div>
            <h1 className="text-2xl font-bold mt-1">Solicitud enviada</h1>
          </div>
          <p className="text-sm">
            La cuenta <b>{pending}</b> se creó y está <b>pendiente de aprobación</b>. Avísale al administrador; cuando la
            apruebe podrás iniciar sesión con tu usuario y contraseña.
          </p>
          <Link href="/login" className="btn-primary w-full">
            Ir a iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm card p-7 shadow-sm space-y-4">
        <div>
          <div className="text-xs font-semibold tracking-widest text-accent uppercase">CodePrep</div>
          <h1 className="text-2xl font-bold mt-1">{isLogin ? "Iniciar sesión" : "Crear cuenta"}</h1>
          <p className="text-sm text-muted mt-1">
            {isLogin
              ? "Continúa donde te quedaste."
              : "Tu cuenta quedará pendiente hasta que el administrador la apruebe."}
          </p>
        </div>
        <label className="block">
          <span className="text-sm font-medium">Usuario</span>
          <input name="username" required autoComplete="username" className="input mt-1" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Contraseña</span>
          <input
            name="password"
            type="password"
            required
            minLength={isLogin ? 1 : 6}
            autoComplete={isLogin ? "current-password" : "new-password"}
            className="input mt-1"
          />
        </label>
        {error && <p className="text-sm text-bad">{error}</p>}
        <button disabled={loading} className="btn-primary w-full">
          {loading ? "..." : isLogin ? "Entrar" : "Registrarme"}
        </button>
        <p className="text-sm text-muted text-center">
          {isLogin ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? "}
          <Link href={isLogin ? "/register" : "/login"} className="text-accent font-medium">
            {isLogin ? "Regístrate" : "Inicia sesión"}
          </Link>
        </p>
      </form>
    </div>
  );
}
