"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Action = "approve" | "reject" | "delete";

const CONFIRM: Partial<Record<Action, string>> = {
  reject: "¿Bloquear esta cuenta? Se cerrarán sus sesiones y no podrá entrar.",
  delete: "¿Borrar esta cuenta y todos sus datos? No se puede deshacer.",
};

export function UserActions({ userId, status }: { userId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: Action) {
    if (CONFIRM[action] && !confirm(CONFIRM[action])) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Error");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== "APPROVED" && (
        <button className="btn-primary" disabled={busy} onClick={() => run("approve")}>
          Aprobar
        </button>
      )}
      {status === "PENDING" && (
        <button className="btn" disabled={busy} onClick={() => run("reject")}>
          Rechazar
        </button>
      )}
      {status === "APPROVED" && (
        <button className="btn" disabled={busy} onClick={() => run("reject")}>
          Bloquear
        </button>
      )}
      {status !== "APPROVED" && (
        <button className="btn text-bad" disabled={busy} onClick={() => run("delete")}>
          Borrar
        </button>
      )}
      {error && <span className="text-xs text-bad">{error}</span>}
    </div>
  );
}
