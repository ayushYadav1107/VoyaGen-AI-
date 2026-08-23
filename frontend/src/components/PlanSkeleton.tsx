import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

const STEPS = [
  "Guardrail checking the request",
  "Supervisor selecting specialist agents",
  "Agents calling MCP tools",
  "Itinerary agent drafting the plan",
];

/** Shown while the graph is executing — the backend is not streaming, so this
 *  is an honest "work in progress" placeholder rather than fake progress. */
export function PlanSkeleton({ step }: { step: number }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="glass edge-light overflow-hidden rounded-4xl px-6 py-7 sm:px-8"
    >
      <div className="flex items-center gap-3">
        <Loader2
          className="h-4 w-4 animate-spin"
          style={{ color: "rgb(var(--accent))" }}
        />
        <p className="text-sm font-semibold text-hi">Building your plan</p>
      </div>

      <ul className="mt-5 space-y-2.5">
        {STEPS.map((label, index) => {
          const state =
            index < step ? "done" : index === step ? "active" : "pending";
          return (
            <li key={label} className="flex items-center gap-3 text-sm">
              <span
                className="grid h-5 w-5 flex-none place-items-center rounded-full text-[10px] font-bold transition-colors duration-500"
                style={{
                  background:
                    state === "pending"
                      ? "rgb(var(--border) / 0.1)"
                      : "rgb(var(--accent) / 0.16)",
                  border: `1px solid rgb(var(--${
                    state === "pending" ? "border" : "accent"
                  }) / ${state === "pending" ? "0.14" : "0.4"})`,
                  color:
                    state === "pending"
                      ? "rgb(var(--text-low))"
                      : "rgb(var(--accent))",
                }}
              >
                {state === "done" ? "✓" : index + 1}
              </span>
              <span
                className="transition-colors duration-500"
                style={{
                  color:
                    state === "pending"
                      ? "rgb(var(--text-low))"
                      : "rgb(var(--text-mid))",
                }}
              >
                {label}
              </span>
              {state === "active" && (
                <span className="skeleton h-1.5 flex-1 rounded-full" />
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-7 space-y-3">
        <div className="skeleton h-4 w-2/5" />
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-3 w-11/12" />
        <div className="skeleton h-3 w-4/5" />
        <div className="skeleton h-4 w-1/3" />
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-3 w-9/12" />
      </div>
    </motion.section>
  );
}
