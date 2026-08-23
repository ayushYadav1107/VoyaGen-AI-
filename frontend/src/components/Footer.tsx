const STACK = [
  "FastAPI",
  "LangGraph",
  "Groq",
  "PostgreSQL",
  "Tavily",
  "AviationStack",
  "MCP",
  "React",
  "TypeScript",
  "Tailwind",
];

export function Footer() {
  return (
    <footer
      className="mt-20 border-t py-10"
      style={{ borderColor: "rgb(var(--border) / var(--border-alpha))" }}
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="flex flex-col items-center gap-5 text-center">
          <p className="label-eyebrow">Built with</p>
          <ul className="flex flex-wrap items-center justify-center gap-2">
            {STACK.map((tech) => (
              <li
                key={tech}
                className="rounded-lg px-2.5 py-1 font-mono text-[11px] text-low transition-colors hover:text-mid"
                style={{
                  background: "rgb(var(--surface) / var(--surface-alpha))",
                  border: "1px solid rgb(var(--border) / var(--border-alpha))",
                }}
              >
                {tech}
              </li>
            ))}
          </ul>
          <p className="text-xs text-low">
            VoyaGen AI · supervisor-routed multi-agent travel planning with
            guardrails and human review
          </p>
        </div>
      </div>
    </footer>
  );
}
