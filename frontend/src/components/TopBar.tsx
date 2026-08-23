import { motion } from "framer-motion";
import { Moon, Sun, Github, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface TopBarProps {
  theme: "dark" | "light";
  onToggleTheme: () => void;
  online: boolean;
  onReset: () => void;
  canReset: boolean;
}

export function TopBar({
  theme,
  onToggleTheme,
  online,
  onReset,
  canReset,
}: TopBarProps) {
  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="sticky top-0 z-40 w-full"
    >
      <div
        className="border-b backdrop-blur-xl"
        style={{
          background: "rgb(var(--bg-base) / 0.55)",
          borderColor: "rgb(var(--border) / var(--border-alpha))",
        }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          {/* Brand */}
          <a href="/" className="group flex items-center gap-3">
            <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-aurora-cyan to-aurora-violet shadow-glow">
              <svg
                viewBox="0 0 24 24"
                className="h-[18px] w-[18px]"
                fill="none"
                stroke="#04060f"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17.8 19.2 16 11l3.5-3.5a2.1 2.1 0 0 0-3-3L13 8 4.8 6.2a.6.6 0 0 0-.6.9l2.6 4.2-2.1 2.1-1.9-.5a.6.6 0 0 0-.6 1l2.2 2.2 2.2 2.2a.6.6 0 0 0 1-.6l-.5-1.9 2.1-2.1 4.2 2.6a.6.6 0 0 0 .9-.6Z" />
              </svg>
              <span className="absolute inset-0 rounded-xl ring-1 ring-white/25" />
            </span>
            <span className="flex flex-col leading-none">
              <span className="text-[15px] font-extrabold tracking-tight text-hi">
                VoyaGen<span style={{ color: "rgb(var(--accent))" }}> AI</span>
              </span>
              <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-low">
                Multi-Agent Planner
              </span>
            </span>
          </a>

          {/* Right cluster */}
          <div className="flex items-center gap-2">
            <StatusPill online={online} />

            {canReset && (
              <button
                onClick={onReset}
                className="hidden h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-mid transition-colors hover:text-hi sm:flex"
                style={{
                  background: "rgb(var(--surface) / var(--surface-alpha))",
                  border: "1px solid rgb(var(--border) / var(--border-alpha))",
                }}
                title="Clear the saved thread and start over"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                New session
              </button>
            )}

            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Source"
              className="hidden h-9 w-9 place-items-center rounded-xl text-mid transition-colors hover:text-hi sm:grid"
              style={{
                background: "rgb(var(--surface) / var(--surface-alpha))",
                border: "1px solid rgb(var(--border) / var(--border-alpha))",
              }}
            >
              <Github className="h-4 w-4" />
            </a>

            <button
              onClick={onToggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl text-mid transition-colors hover:text-hi"
              style={{
                background: "rgb(var(--surface) / var(--surface-alpha))",
                border: "1px solid rgb(var(--border) / var(--border-alpha))",
              }}
            >
              <motion.span
                key={theme}
                initial={{ y: 14, opacity: 0, rotate: -35 }}
                animate={{ y: 0, opacity: 1, rotate: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="grid place-items-center"
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </motion.span>
            </button>
          </div>
        </div>
      </div>
    </motion.header>
  );
}

function StatusPill({ online }: { online: boolean }) {
  return (
    <span
      className="flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold"
      style={{
        background: "rgb(var(--surface) / var(--surface-alpha))",
        border: "1px solid rgb(var(--border) / var(--border-alpha))",
        color: online ? "rgb(var(--ok))" : "rgb(var(--danger))",
      }}
    >
      <span className="relative flex h-2 w-2">
        <span
          className={cn(
            "absolute inline-flex h-full w-full rounded-full",
            online && "animate-pulse-ring",
          )}
          style={{
            background: online ? "rgb(var(--ok))" : "rgb(var(--danger))",
          }}
        />
        <span
          className="relative inline-flex h-2 w-2 rounded-full"
          style={{
            background: online ? "rgb(var(--ok))" : "rgb(var(--danger))",
          }}
        />
      </span>
      <span className="hidden sm:inline">{online ? "API online" : "API offline"}</span>
    </span>
  );
}
