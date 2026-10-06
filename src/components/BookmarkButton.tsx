"use client";

import { useState } from "react";

type Props = {
  type: "LESSON" | "SECTION" | "PROBLEM" | "PDF_PAGE";
  refId: string;
  label: string;
  initial: boolean;
  small?: boolean;
};

export function BookmarkButton({ type, refId, label, initial, small }: Props) {
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const res = await fetch("/api/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ref: refId, label }),
    });
    setBusy(false);
    if (res.ok) setSaved((await res.json()).saved);
  }

  if (small) {
    return (
      <button
        onClick={toggle}
        disabled={busy}
        title={saved ? "Quitar de guardados" : "Guardar"}
        className={`text-sm leading-none cursor-pointer ${saved ? "text-warn" : "text-muted hover:text-text"}`}
      >
        {saved ? "★" : "☆"}
      </button>
    );
  }
  return (
    <button onClick={toggle} disabled={busy} className="btn">
      <span className={saved ? "text-warn" : ""}>{saved ? "★" : "☆"}</span>
      {saved ? "Guardado" : "Guardar"}
    </button>
  );
}
