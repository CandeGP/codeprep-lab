import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiAiUser, apiUser } from "@/lib/auth";
import { getLesson } from "@/lib/content";

export const runtime = "nodejs";

const schema = z.object({
  lessonSlug: z.string().max(100).nullish(),
  /** Texto seleccionado o sección sobre la que se pregunta (opcional). */
  focus: z.string().max(4000).nullish(),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(20_000) }))
    .min(1)
    .max(40),
});

const SYSTEM = `Eres un tutor experto en entrevistas técnicas de programación (estructuras de datos, algoritmos, diseño de sistemas y preguntas de comportamiento). Respondes en español, de forma clara y didáctica.

Cómo enseñas:
- Cuando el estudiante pide ayuda con un problema, empieza con una pista o una pregunta guía; da la solución completa solo si la pide explícitamente o si ya lo intentó.
- Siempre menciona la complejidad de tiempo y espacio de las soluciones que muestres.
- Usa ejemplos de código cortos en JavaScript o Python (el lenguaje que use el estudiante) con bloques \`\`\`.
- Si el estudiante comete un error conceptual, corrígelo con amabilidad y explica por qué.
- Sé conciso: prefiere respuestas enfocadas antes que ensayos largos.`;

export async function POST(req: Request) {
  const user = await apiAiUser();
  if (user instanceof Response) return user;
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "Falta configurar ANTHROPIC_API_KEY en el archivo .env para usar la IA." },
      { status: 503 },
    );
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Datos inválidos" }, { status: 400 });
  const { lessonSlug, focus, messages } = parsed.data;
  if (messages[messages.length - 1].role !== "user") {
    return Response.json({ error: "El último mensaje debe ser del usuario" }, { status: 400 });
  }

  // Contexto: la lección actual (contenido propio de la plataforma) va en el system prompt
  // para que sea estable entre turnos y aproveche el caché de prompts.
  const system: Anthropic.TextBlockParam[] = [{ type: "text", text: SYSTEM }];
  const lesson = lessonSlug ? await getLesson(lessonSlug) : null;
  if (lesson) {
    system.push({
      type: "text",
      text: `El estudiante está leyendo esta lección de la plataforma. Úsala como contexto principal:\n\n<leccion titulo="${lesson.title}">\n${lesson.markdown}\n</leccion>`,
      cache_control: { type: "ephemeral" },
    });
  }

  const apiMessages: Anthropic.MessageParam[] = messages.map((m) => ({ role: m.role, content: m.content }));
  if (focus) {
    const last = apiMessages[apiMessages.length - 1];
    last.content = `Sobre este fragmento:\n"""\n${focus}\n"""\n\n${last.content as string}`;
  }

  const userQuestion = messages[messages.length - 1].content;
  await db.chatMessage.create({
    data: { userId: user.id, lessonSlug: lessonSlug ?? null, role: "user", content: userQuestion },
  });

  const client = new Anthropic();
  const stream = client.beta.messages.stream({
    model: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
    max_tokens: 16000,
    system,
    messages: apiMessages as Anthropic.Beta.BetaMessageParam[],
    output_config: { effort: "medium" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      try {
        stream.on("text", (delta) => {
          full += delta;
          controller.enqueue(encoder.encode(delta));
        });
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          const msg = "\n\n_(La IA no pudo responder a esta solicitud.)_";
          full += msg;
          controller.enqueue(encoder.encode(msg));
        } else if (final.stop_reason === "max_tokens") {
          const msg = "\n\n_(Respuesta recortada por longitud.)_";
          full += msg;
          controller.enqueue(encoder.encode(msg));
        }
        if (full) {
          await db.chatMessage.create({
            data: { userId: user.id, lessonSlug: lessonSlug ?? null, role: "assistant", content: full },
          });
        }
      } catch (err) {
        const msg =
          err instanceof Anthropic.AuthenticationError
            ? "API key inválida. Revisa ANTHROPIC_API_KEY en .env."
            : err instanceof Anthropic.RateLimitError
              ? "Límite de uso alcanzado; intenta en un momento."
              : err instanceof Anthropic.APIError
                ? `Error de la API (${err.status ?? "?"}): ${err.message}`
                : "Error inesperado al consultar la IA.";
        controller.enqueue(encoder.encode(`\n\n**Error:** ${msg}`));
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}

/** Historial reciente del usuario (opcionalmente por lección). */
export async function GET(req: Request) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const lessonSlug = new URL(req.url).searchParams.get("lessonSlug");
  const rows = await db.chatMessage.findMany({
    where: { userId: user.id, lessonSlug: lessonSlug || null },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return Response.json(rows.reverse().map((r) => ({ role: r.role, content: r.content })));
}

/** Borra el historial (de una lección o el general). */
export async function DELETE(req: Request) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const lessonSlug = new URL(req.url).searchParams.get("lessonSlug");
  await db.chatMessage.deleteMany({ where: { userId: user.id, lessonSlug: lessonSlug || null } });
  return Response.json({ ok: true });
}
