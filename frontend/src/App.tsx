import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";

import { AuroraBackground } from "@/components/AuroraBackground";
import { TopBar } from "@/components/TopBar";
import { Hero } from "@/components/Hero";
import { PlannerCard } from "@/components/PlannerCard";
import { WorkflowPanel } from "@/components/WorkflowPanel";
import { ResultPanel } from "@/components/ResultPanel";
import { ApprovalPanel } from "@/components/ApprovalPanel";
import { PlanSkeleton } from "@/components/PlanSkeleton";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Footer } from "@/components/Footer";

import { useTheme } from "@/hooks/useTheme";
import { useTravelPlanner } from "@/hooks/useTravelPlanner";

export default function App() {
  const { theme, toggle } = useTheme();
  const { state, plan, decide, reset, clearError } = useTravelPlanner();
  const [online, setOnline] = useState(true);
  const [skeletonStep, setSkeletonStep] = useState(0);
  const [manualError, setManualError] = useState<string | null>(null);

  const errorRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const approvalRef = useRef<HTMLDivElement>(null);

  const running = state.phase === "planning" || state.phase === "finalising";
  const hasWorkflow =
    state.data !== null && (state.phase !== "planning" || state.data !== null);

  /* --- health probe ------------------------------------------------- */
  useEffect(() => {
    let cancelled = false;
    async function probe() {
      try {
        const response = await fetch("/health");
        if (!cancelled) setOnline(response.ok);
      } catch {
        if (!cancelled) setOnline(false);
      }
    }
    probe();
    const id = window.setInterval(probe, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  /* --- skeleton step ticker ----------------------------------------- */
  useEffect(() => {
    if (!running) {
      setSkeletonStep(0);
      return;
    }
    setSkeletonStep(0);
    const id = window.setInterval(
      () => setSkeletonStep((s) => Math.min(s + 1, 3)),
      2600,
    );
    return () => window.clearInterval(id);
  }, [running]);

  /* --- scroll to the newest surface --------------------------------- */
  useEffect(() => {
    if (state.phase === "awaiting_approval") {
      approvalRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (state.phase === "complete" || state.phase === "blocked") {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [state.phase]);

  const error = state.error ?? manualError;

  /* --- surface errors even when they land below the fold ------------- */
  useEffect(() => {
    if (error) {
      errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [error]);

  function dismissError() {
    setManualError(null);
    clearError();
  }

  return (
    <>
      <AuroraBackground />

      <TopBar
        theme={theme}
        onToggleTheme={toggle}
        online={online}
        onReset={reset}
        canReset={state.data !== null || state.threadId !== null}
      />

      <main className="mx-auto w-full max-w-4xl px-5 pb-8 sm:px-8">
        <Hero />

        <div className="space-y-6">
          <PlannerCard
            onSubmit={plan}
            busy={state.pending === "plan"}
            locked={state.phase === "awaiting_approval"}
            lockReason="A draft is waiting for your review below — approve or revise it before starting a new plan."
          />

          {/* Errors */}
          <div ref={errorRef} className="scroll-mt-24">
            <AnimatePresence>
              {error && <ErrorBanner message={error} onDismiss={dismissError} />}
            </AnimatePresence>
          </div>

          {/* Live progress */}
          <AnimatePresence mode="wait">
            {running && <PlanSkeleton key="skeleton" step={skeletonStep} />}
          </AnimatePresence>

          {/* Supervisor plan */}
          <AnimatePresence>
            {hasWorkflow && state.data && !running && (
              <WorkflowPanel
                key="workflow"
                reasoning={state.data.supervisor_reasoning}
                selected={state.data.selected_agents}
                guardrailAllowed={state.data.guardrail_allowed}
                guardrailReason={state.data.guardrail_reason}
                llmCalls={state.data.llm_calls}
                running={running}
              />
            )}
          </AnimatePresence>

          {/* Result */}
          <div ref={resultRef}>
            <AnimatePresence>
              {state.answer && !running && (
                <ResultPanel
                  key={`${state.threadId}-${state.isDraft ? "draft" : "final"}`}
                  markdown={state.answer}
                  threadId={state.threadId ?? ""}
                  isDraft={state.isDraft}
                  onError={setManualError}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Human-in-the-loop */}
          <div ref={approvalRef}>
            <AnimatePresence>
              {state.phase === "awaiting_approval" && state.data && (
                <ApprovalPanel
                  key="approval"
                  request={state.data.approval_request}
                  pending={state.pending}
                  onDecide={decide}
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
