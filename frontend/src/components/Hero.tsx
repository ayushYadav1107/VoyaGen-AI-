import { motion } from "framer-motion";
import { Sparkles, ShieldCheck, GitBranch, UserCheck, Plug } from "lucide-react";

const CAPABILITIES = [
  { icon: GitBranch, label: "LangGraph supervisor" },
  { icon: ShieldCheck, label: "Input guardrails" },
  { icon: Plug, label: "MCP tool servers" },
  { icon: UserCheck, label: "Human-in-the-loop" },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 22, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.75, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export function Hero() {
  return (
    <motion.section
      variants={container}
      initial="hidden"
      animate="show"
      className="relative flex flex-col items-center pb-10 pt-16 text-center sm:pt-24"
    >
      {/* Badge */}
      <motion.div variants={item}>
        <span
          className="group inline-flex items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-4 text-xs font-semibold backdrop-blur-md"
          style={{
            background: "rgb(var(--surface) / var(--surface-alpha))",
            border: "1px solid rgb(var(--border) / var(--border-strong-alpha))",
            color: "rgb(var(--text-mid))",
          }}
        >
          <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-aurora-cyan to-aurora-violet">
            <Sparkles className="h-3 w-3 text-[#04060f]" />
          </span>
          Five specialist agents, one supervisor
          <span
            className="ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide"
            style={{
              background: "rgb(var(--accent) / 0.14)",
              color: "rgb(var(--accent))",
            }}
          >
            v2.0
          </span>
        </span>
      </motion.div>

      {/* Headline */}
      <motion.h1
        variants={item}
        className="mt-7 max-w-5xl text-balance text-[2.5rem] font-extrabold leading-[1.06] tracking-[-0.035em] sm:text-[3.5rem] lg:text-[4.1rem]"
      >
        <span className="text-hi">Plan your perfect trip</span>
        <br />
        <span className="grad-text">with a team of AI agents</span>
      </motion.h1>

      {/* Subhead */}
      <motion.p
        variants={item}
        className="mt-6 max-w-2xl text-pretty text-base leading-relaxed text-mid sm:text-[1.0625rem]"
      >
        Search live flights, discover hotels, read the forecast and pressure-test your
        budget — then review the AI-generated draft yourself before the final itinerary
        is written.
      </motion.p>

      {/* Capability strip */}
      <motion.ul
        variants={item}
        className="mt-9 flex flex-wrap items-center justify-center gap-2.5"
      >
        {CAPABILITIES.map(({ icon: Icon, label }) => (
          <li key={label} className="chip">
            <Icon className="h-3.5 w-3.5" style={{ color: "rgb(var(--accent))" }} />
            {label}
          </li>
        ))}
      </motion.ul>
    </motion.section>
  );
}
