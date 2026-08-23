import { motion, AnimatePresence } from "framer-motion";
import { Brain, ShieldCheck, ShieldAlert, Cpu, Check } from "lucide-react";
import { AGENT_ORDER, agentMeta } from "@/lib/agents";
import type { AgentId } from "@/lib/types";

interface WorkflowPanelProps {
  reasoning: string;
  selected: AgentId[];
  guardrailAllowed: boolean;
  guardrailReason: string;
  llmCalls: number;
  /** True while agents are still executing, so nodes pulse instead of settling. */
  running: boolean;
}

export function WorkflowPanel({
  reasoning,
  selected,
  guardrailAllowed,
  guardrailReason,
  llmCalls,
  running,
}: WorkflowPanelProps) {
  const active = AGENT_ORDER.filter((id) => selected.includes(id));

  return (
    <motion.section
      initial={{ opacity: 0, y: 26 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
      className="glass edge-light overflow-hidden rounded-4xl"
    >
      {/* Header */}
      <div
        className="flex flex-wrap items-center justify-between gap-4 border-b px-6 py-5 sm:px-8"
        style={{ borderColor: "rgb(var(--border) / var(--border-alpha))" }}
      >
        <div className="flex items-center gap-3">
          <span
            className="grid h-10 w-10 place-items-center rounded-2xl"
            style={{
              background: "rgb(var(--accent-2) / 0.14)",
              border: "1px solid rgb(var(--accent-2) / 0.28)",
            }}
          >
            <Brain className="h-[18px] w-[18px]" style={{ color: "rgb(var(--accent-2))" }} />
          </span>
          <div>
            <p className="label-eyebrow">Supervisor agent</p>
            <h2 className="text-lg font-bold tracking-tight text-hi">
              Execution plan
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[11px] tabular-nums"
            style={{
              background: "rgb(var(--surface) / var(--surface-alpha))",
              border: "1px solid rgb(var(--border) / var(--border-alpha))",
              color: "rgb(var(--text-low))",
            }}
          >
            <Cpu className="h-3 w-3" />
            {llmCalls} LLM {llmCalls === 1 ? "call" : "calls"}
          </span>

          <GuardrailBadge allowed={guardrailAllowed} />
        </div>
      </div>

      <div className="px-6 py-6 sm:px-8">
        {/* Reasoning */}
        <div
          className="rounded-2xl px-4 py-3.5"
          style={{
            background: "rgb(var(--accent-2) / 0.06)",
            border: "1px solid rgb(var(--accent-2) / 0.16)",
          }}
        >
          <p className="text-sm leading-relaxed text-mid">
            {guardrailAllowed
              ? reasoning || "Supervisor routing completed."
              : guardrailReason || reasoning}
          </p>
        </div>

        {/* Pipeline */}
        {guardrailAllowed && active.length > 0 && (
          <div className="mt-6">
            <p className="label-eyebrow mb-4">Agent pipeline</p>
            <ol
              className="no-scrollbar -mx-1 flex items-center gap-0 overflow-x-auto px-1 pb-1"
              style={{
                maskImage:
                  "linear-gradient(90deg, #000 0, #000 calc(100% - 28px), transparent 100%)",
                WebkitMaskImage:
                  "linear-gradient(90deg, #000 0, #000 calc(100% - 28px), transparent 100%)",
              }}
            >
              {active.map((id, index) => (
                <li key={id} className="flex flex-none items-center">
                  <AgentNode id={id} index={index} running={running} />
                  {index < active.length - 1 && (
                    <Connector index={index} running={running} />
                  )}
                </li>
              ))}
            </ol>

            <p className="mt-3.5 break-words font-mono text-[10.5px] leading-relaxed text-low">
              START → supervisor → {active.join(" → ")} → human_approval →
              final_agent → END
            </p>
          </div>
        )}
      </div>
    </motion.section>
  );
}

function AgentNode({
  id,
  index,
  running,
}: {
  id: AgentId;
  index: number;
  running: boolean;
}) {
  const meta = agentMeta(id);
  const Icon = meta.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.86, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        delay: index * 0.11,
        duration: 0.55,
        ease: [0.16, 1, 0.3, 1],
      }}
      whileHover={{ y: -3 }}
      title={meta.blurb}
      className="group relative flex items-center gap-1.5 rounded-xl px-2 py-1.5"
      style={{
        background: `rgb(${meta.rgb} / 0.09)`,
        border: `1px solid rgb(${meta.rgb} / 0.28)`,
        boxShadow: `0 10px 32px -16px rgb(${meta.rgb} / 0.8)`,
      }}
    >
      {/* Pulse halo while the graph is executing */}
      {running && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-2xl animate-pulse-ring"
          style={{
            border: `1px solid rgb(${meta.rgb} / 0.5)`,
            animationDelay: `${index * 0.22}s`,
          }}
        />
      )}

      <span
        className="grid h-6 w-6 flex-none place-items-center rounded-lg"
        style={{ background: `rgb(${meta.rgb} / 0.18)` }}
      >
        <Icon className="h-3 w-3" style={{ color: `rgb(${meta.rgb})` }} />
      </span>

      <span className="whitespace-nowrap text-[12px] font-semibold text-hi">
        {meta.short}
      </span>

      {!running && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{
            delay: 0.25 + index * 0.11,
            type: "spring",
            stiffness: 420,
            damping: 18,
          }}
          className="grid h-3.5 w-3.5 flex-none place-items-center rounded-full"
          style={{ background: `rgb(${meta.rgb})` }}
        >
          <Check className="h-2 w-2" strokeWidth={4} color="#04060f" />
        </motion.span>
      )}
    </motion.div>
  );
}

function Connector({ index, running }: { index: number; running: boolean }) {
  return (
    <span className="relative mx-1 block h-px w-4 flex-none overflow-hidden sm:w-6">
      <span
        className="absolute inset-0"
        style={{ background: "rgb(var(--border) / 0.25)" }}
      />
      <motion.span
        className="absolute inset-y-0 left-0 w-full origin-left"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.14 + index * 0.11, duration: 0.4, ease: "easeOut" }}
        style={{
          background:
            "linear-gradient(90deg, rgb(var(--accent) / 0.9), rgb(var(--accent-2) / 0.9))",
        }}
      />
      {running && (
        <span
          className="absolute inset-y-0 w-3 animate-shimmer-x"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgb(var(--accent)), transparent)",
            animationDelay: `${index * 0.2}s`,
          }}
        />
      )}
    </span>
  );
}

function GuardrailBadge({ allowed }: { allowed: boolean }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={allowed ? "pass" : "block"}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.25 }}
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold"
        style={{
          background: allowed
            ? "rgb(var(--ok) / 0.12)"
            : "rgb(var(--danger) / 0.12)",
          border: `1px solid rgb(var(--${allowed ? "ok" : "danger"}) / 0.32)`,
          color: allowed ? "rgb(var(--ok))" : "rgb(var(--danger))",
        }}
      >
        {allowed ? (
          <ShieldCheck className="h-3.5 w-3.5" />
        ) : (
          <ShieldAlert className="h-3.5 w-3.5" />
        )}
        Guardrail {allowed ? "passed" : "blocked"}
      </motion.span>
    </AnimatePresence>
  );
}
