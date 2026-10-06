import { ChatPanel } from "@/components/ChatPanel";

export default function AskPage() {
  const configured = !!process.env.ANTHROPIC_API_KEY;
  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-6">
      <h1 className="text-2xl font-bold">Preguntar a la IA</h1>
      <p className="text-sm text-muted mt-1">
        Tutor general de entrevistas técnicas. Dentro de cada lección también puedes abrir un chat con el contexto de esa lección.
      </p>
      {!configured && (
        <div className="mt-4 rounded-lg border border-warn bg-warn/10 px-4 py-3 text-sm">
          Para activar la IA agrega tu <code>ANTHROPIC_API_KEY</code> en el archivo <code>.env</code> y reinicia el servidor.
        </div>
      )}
      <div className="mt-4">
        <ChatPanel
          tall
          suggestions={[
            "Explícame la diferencia entre BFS y DFS",
            "¿Cómo practico para una entrevista en 4 semanas?",
            "Hazme una pregunta de entrevista de arrays",
            "¿Cómo respondo 'háblame de un conflicto con tu equipo'?",
          ]}
        />
      </div>
    </div>
  );
}
