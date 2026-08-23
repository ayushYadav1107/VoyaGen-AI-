/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#05060c",
          900: "#080a14",
          850: "#0b0e1b",
          800: "#101427",
          700: "#161b33",
          600: "#1e2440",
        },
        aurora: {
          cyan: "#3ee8ff",
          sky: "#4c8dff",
          violet: "#8b5cf6",
          magenta: "#e879f9",
          mint: "#34e5b0",
          amber: "#fbbf24",
          rose: "#fb7185",
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ['"Instrument Serif"', '"Plus Jakarta Sans"', "Georgia", "serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.08em" }],
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.75rem",
      },
      boxShadow: {
        glass: "0 1px 0 0 rgba(255,255,255,0.07) inset, 0 24px 60px -24px rgba(0,0,0,0.85)",
        "glass-lg": "0 1px 0 0 rgba(255,255,255,0.09) inset, 0 40px 120px -32px rgba(0,0,0,0.9)",
        glow: "0 0 0 1px rgba(62,232,255,0.18), 0 12px 40px -8px rgba(62,232,255,0.35)",
        "glow-violet": "0 0 0 1px rgba(139,92,246,0.22), 0 12px 44px -8px rgba(139,92,246,0.45)",
      },
      keyframes: {
        "aurora-drift": {
          "0%,100%": { transform: "translate3d(0,0,0) scale(1)" },
          "33%": { transform: "translate3d(6%,-8%,0) scale(1.12)" },
          "66%": { transform: "translate3d(-7%,5%,0) scale(0.94)" },
        },
        "shimmer-x": {
          "0%": { transform: "translateX(-120%)" },
          "100%": { transform: "translateX(220%)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.85)", opacity: "0.75" },
          "100%": { transform: "scale(2.1)", opacity: "0" },
        },
        "border-spin": {
          to: { "--angle": "360deg" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-7px)" },
        },
        "fade-rise": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "grid-pan": {
          to: { backgroundPosition: "64px 64px" },
        },
      },
      animation: {
        "aurora-drift": "aurora-drift 26s ease-in-out infinite",
        "shimmer-x": "shimmer-x 2.2s ease-in-out infinite",
        "pulse-ring": "pulse-ring 2.4s cubic-bezier(0.2,0.7,0.3,1) infinite",
        float: "float 6s ease-in-out infinite",
        "fade-rise": "fade-rise 0.6s cubic-bezier(0.16,1,0.3,1) both",
        "grid-pan": "grid-pan 14s linear infinite",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};
