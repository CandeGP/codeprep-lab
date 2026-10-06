"use client";

import { createContext, useContext } from "react";

// Si el usuario actual puede usar la IA (sólo el admin, con API key configurada).
const AiContext = createContext(false);

export function AiProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  return <AiContext.Provider value={enabled}>{children}</AiContext.Provider>;
}

export function useAiEnabled() {
  return useContext(AiContext);
}
