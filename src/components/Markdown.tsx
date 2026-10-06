import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Render seguro de markdown escrito por usuarios o por la IA (sin HTML crudo). */
export function Markdown({ children, compact = false }: { children: string; compact?: boolean }) {
  return (
    <div className={`prose-lesson ${compact ? "prose-compact" : ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
