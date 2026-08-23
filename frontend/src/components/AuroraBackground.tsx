import { memo } from "react";

/**
 * Fixed, non-interactive backdrop: a drifting aurora mesh over a faint
 * perspective grid, finished with a grain overlay and vignette.
 * Everything is CSS-driven so it costs no React renders.
 */
function AuroraBackgroundBase() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ backgroundColor: "rgb(var(--bg-base))" }}
    >
      {/* Base wash */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% -10%, rgb(var(--accent-2) / 0.20), transparent 60%)," +
            "radial-gradient(90% 60% at 90% 10%, rgb(var(--accent) / 0.13), transparent 55%)",
        }}
      />

      {/* Drifting aurora blobs */}
      <div
        className="absolute inset-0"
        style={{ opacity: "var(--aurora-opacity)" }}
      >
        <div
          className="absolute -left-[14%] -top-[18%] h-[46rem] w-[46rem] rounded-full blur-[110px] animate-aurora-drift"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, rgb(var(--accent) / 0.55), transparent 62%)",
            animationDelay: "0s",
          }}
        />
        <div
          className="absolute -right-[16%] top-[6%] h-[40rem] w-[40rem] rounded-full blur-[120px] animate-aurora-drift"
          style={{
            background:
              "radial-gradient(circle at 60% 40%, rgb(var(--accent-2) / 0.6), transparent 62%)",
            animationDelay: "-9s",
          }}
        />
        <div
          className="absolute bottom-[-22%] left-[22%] h-[42rem] w-[42rem] rounded-full blur-[130px] animate-aurora-drift"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgb(var(--accent-3) / 0.42), transparent 64%)",
            animationDelay: "-17s",
          }}
        />
        <div
          className="absolute left-[42%] top-[38%] h-[28rem] w-[28rem] rounded-full blur-[100px] animate-aurora-drift"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgb(var(--ok) / 0.28), transparent 65%)",
            animationDelay: "-24s",
          }}
        />
      </div>

      {/* Perspective grid */}
      <div
        className="absolute inset-x-0 bottom-0 h-[55vh] opacity-[0.16]"
        style={{
          backgroundImage:
            "linear-gradient(rgb(var(--border) / 0.5) 1px, transparent 1px)," +
            "linear-gradient(90deg, rgb(var(--border) / 0.5) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage:
            "linear-gradient(to top, #000 0%, transparent 85%)",
          WebkitMaskImage:
            "linear-gradient(to top, #000 0%, transparent 85%)",
          transform: "perspective(520px) rotateX(62deg)",
          transformOrigin: "bottom",
        }}
      />

      {/* Grain */}
      <div
        className="absolute inset-0 mix-blend-overlay"
        style={{
          opacity: "var(--grain-opacity)",
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(130% 100% at 50% 40%, transparent 45%, rgb(var(--bg-base) / 0.85) 100%)",
        }}
      />
    </div>
  );
}

export const AuroraBackground = memo(AuroraBackgroundBase);
