import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, Command, CornerDownLeft, Loader2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

const QUICK_PROMPTS = [
  {
    flag: "🇯🇵",
    title: "Japan · 7 days",
    prompt:
      "Plan a complete 7 days Japan trip from Delhi including flights, hotels and sightseeing under 2 lakhs.",
  },
  {
    flag: "🇦🇪",
    title: "Dubai · 5 days",
    prompt:
      "Plan a 5 days Dubai trip from Mumbai with flights, hotels and sightseeing.",
  },
  {
    flag: "🇹🇭",
    title: "Thailand · 6 days",
    prompt:
      "Plan a 6 days Thailand trip from Bengaluru with budget hotels and sightseeing.",
  },
  {
    flag: "🇻🇳",
    title: "Vietnam · 8 days",
    prompt:
      "Plan an 8 days Vietnam trip from Hyderabad covering Hanoi and Da Nang under 1.5 lakhs.",
  },
  {
    flag: "🏔️",
    title: "Himachal · 5 days",
    prompt:
      "Plan a 5 days Himachal trip from Chennai with hotels, weather advice and a day-by-day plan.",
  },
  {
    flag: "🌍",
    title: "Global flights",
    prompt: "Give me all country flight info.",
  },
];

const MAX_CHARS = 1200;

interface PlannerCardProps {
  onSubmit: (message: string) => void;
  busy: boolean;
  locked: boolean;
  lockReason?: string;
}

export function PlannerCard({
  onSubmit,
  busy,
  locked,
  lockReason,
}: PlannerCardProps) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow the textarea with the content.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 260)}px`;
  }, [value]);

  const disabled = busy || locked;
  const canSubmit = value.trim().length > 0 && !disabled;

  function submit() {
    if (!canSubmit) return;
    onSubmit(value);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    const isSubmitCombo =
      (event.metaKey || event.ctrlKey) && event.key === "Enter";
    if (isSubmitCombo) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 34 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="relative"
    >
      {/* Ambient glow behind the card */}
      <div
        aria-hidden
        className="absolute -inset-x-8 -top-6 bottom-0 -z-10 rounded-[3rem] blur-3xl transition-opacity duration-700"
        style={{
          opacity: focused ? 0.55 : 0.28,
          background:
            "radial-gradient(60% 60% at 50% 0%, rgb(var(--accent) / 0.4), transparent 70%)",
        }}
      />

      <div
        data-active={focused || busy}
        className="conic-border glass-strong edge-light overflow-hidden rounded-4xl"
      >
        {/* Header row */}
        <div
          className="flex flex-wrap items-start justify-between gap-4 border-b px-6 py-5 sm:px-8"
          style={{ borderColor: "rgb(var(--border) / var(--border-alpha))" }}
        >
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-hi">
              <MapPin className="h-4 w-4" style={{ color: "rgb(var(--accent))" }} />
              Where do you want to go?
            </h2>
            <p className="mt-1.5 text-sm text-mid">
              Describe the trip in plain language — the supervisor decides which
              agents to run.
            </p>
          </div>

          <span
            className="rounded-full px-3 py-1 font-mono text-[11px] tabular-nums"
            style={{
              background: "rgb(var(--surface) / var(--surface-alpha))",
              border: "1px solid rgb(var(--border) / var(--border-alpha))",
              color:
                value.length > MAX_CHARS * 0.9
                  ? "rgb(var(--warn))"
                  : "rgb(var(--text-low))",
            }}
          >
            {value.length}/{MAX_CHARS}
          </span>
        </div>

        {/* Composer */}
        <div className="px-6 pb-6 pt-5 sm:px-8">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={value}
              maxLength={MAX_CHARS}
              onChange={(e) => setValue(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={handleKeyDown}
              disabled={locked}
              rows={3}
              placeholder="Plan a complete 7 days Japan trip from Delhi including flights, hotels and sightseeing under 2 lakhs…"
              className={cn(
                "w-full resize-none rounded-2xl bg-transparent px-4 py-3.5 pr-4 text-[15px] leading-relaxed outline-none transition-colors duration-300 sm:pr-40",
                locked && "cursor-not-allowed opacity-60",
              )}
              style={{
                background: "rgb(var(--bg-base) / 0.35)",
                border: `1px solid rgb(var(--border) / ${
                  focused ? "var(--border-strong-alpha)" : "var(--border-alpha)"
                })`,
                minHeight: "7rem",
              }}
            />

            {/* Submit button — floats inside on desktop, stacks on mobile */}
            <div className="mt-3 flex items-center justify-between gap-3 sm:absolute sm:bottom-3.5 sm:right-3.5 sm:mt-0 sm:justify-end">
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-low sm:hidden">
                <Command className="h-3 w-3" />
                <CornerDownLeft className="h-3 w-3" /> to send
              </span>

              <button
                onClick={submit}
                disabled={!canSubmit}
                className="btn btn-primary sheen min-w-[11rem]"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {busy ? (
                    <motion.span
                      key="busy"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18 }}
                      className="flex items-center gap-2"
                    >
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Routing agents…
                    </motion.span>
                  ) : (
                    <motion.span
                      key="idle"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18 }}
                      className="flex items-center gap-2"
                    >
                      Generate draft
                      <ArrowUp className="h-4 w-4" />
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </div>
          </div>

          <AnimatePresence>
            {locked && lockReason && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 text-xs font-medium"
                style={{ color: "rgb(var(--warn))" }}
              >
                {lockReason}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Quick prompts */}
          <div className="mt-6">
            <p className="label-eyebrow mb-3">Try one of these</p>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {QUICK_PROMPTS.map((item, index) => (
                <motion.button
                  key={item.title}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: 0.45 + index * 0.07,
                    duration: 0.55,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setValue(item.prompt);
                    textareaRef.current?.focus();
                  }}
                  disabled={locked}
                  className="group flex min-w-0 items-center gap-3 rounded-2xl px-3.5 py-3 text-left transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    background: "rgb(var(--surface) / var(--surface-alpha))",
                    border: "1px solid rgb(var(--border) / var(--border-alpha))",
                  }}
                >
                  <span className="text-lg leading-none">{item.flag}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-hi">
                      {item.title}
                    </span>
                    <span className="block truncate text-[11px] text-low">
                      {item.prompt}
                    </span>
                  </span>
                </motion.button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer hint bar */}
        <div
          className="hidden items-center justify-between border-t px-8 py-3 text-[11px] text-low sm:flex"
          style={{ borderColor: "rgb(var(--border) / var(--border-alpha))" }}
        >
          <span className="flex items-center gap-1.5">
            <kbd
              className="rounded px-1.5 py-0.5 font-mono text-[10px]"
              style={{ background: "rgb(var(--border) / 0.1)" }}
            >
              Ctrl
            </kbd>
            +
            <kbd
              className="rounded px-1.5 py-0.5 font-mono text-[10px]"
              style={{ background: "rgb(var(--border) / 0.1)" }}
            >
              Enter
            </kbd>
            to generate
          </span>
          <span>Draft is always reviewed by you before the final plan</span>
        </div>
      </div>
    </motion.section>
  );
}
