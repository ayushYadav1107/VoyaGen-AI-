import { motion } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";

export function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <motion.div
      role="alert"
      initial={{ opacity: 0, y: -12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.98 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-start gap-3 rounded-2xl px-4 py-3.5"
      style={{
        background: "rgb(var(--danger) / 0.1)",
        border: "1px solid rgb(var(--danger) / 0.3)",
        boxShadow: "0 20px 60px -30px rgb(var(--danger) / 0.7)",
      }}
    >
      <AlertTriangle
        className="mt-0.5 h-4 w-4 flex-none"
        style={{ color: "rgb(var(--danger))" }}
      />
      <p className="flex-1 text-sm leading-relaxed" style={{ color: "rgb(var(--danger))" }}>
        {message}
      </p>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="-m-1 rounded-lg p-1 transition-opacity hover:opacity-70"
        style={{ color: "rgb(var(--danger))" }}
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
}
