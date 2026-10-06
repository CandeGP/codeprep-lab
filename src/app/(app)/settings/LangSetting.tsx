"use client";

import { useState } from "react";
import { saveLang } from "@/components/certs/QuestionView";
import type { Lang } from "@/lib/certs/shared";

/** Preferencia de idioma de las preguntas y flashcards de certificación. */
export function LangSetting({ initial }: { initial: Lang }) {
  const [lang, setLang] = useState<Lang>(initial);
  const [saved, setSaved] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="text-muted">Idioma de las preguntas de certificación:</span>
      <select
        className="input !w-auto !py-1"
        value={lang}
        onChange={(e) => {
          const l = e.target.value as Lang;
          setLang(l);
          saveLang(l);
          setSaved(true);
        }}
      >
        <option value="en">English (como el examen real)</option>
        <option value="es">Español (traducción)</option>
      </select>
      {saved && <span className="text-ok text-xs">Guardado ✓</span>}
    </div>
  );
}
