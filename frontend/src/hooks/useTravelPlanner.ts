import { useCallback, useRef, useState } from "react";
import { requestPlan, submitApproval } from "@/lib/api";
import type { PlannerPhase, TravelResponse } from "@/lib/types";

const THREAD_KEY = "voyagen_thread_id";

function readThread(): string | null {
  try {
    return window.localStorage.getItem(THREAD_KEY);
  } catch {
    return null;
  }
}

function writeThread(id: string | null) {
  try {
    if (id) window.localStorage.setItem(THREAD_KEY, id);
    else window.localStorage.removeItem(THREAD_KEY);
  } catch {
    /* ignore */
  }
}

export interface PlannerState {
  phase: PlannerPhase;
  data: TravelResponse | null;
  /** Markdown currently on screen — draft while awaiting approval, else final. */
  answer: string;
  isDraft: boolean;
  error: string | null;
  threadId: string | null;
  /** Which submit is in flight, so buttons can show the right spinner. */
  pending: "none" | "plan" | "approve" | "revise";
}

const INITIAL: PlannerState = {
  phase: "idle",
  data: null,
  answer: "",
  isDraft: false,
  error: null,
  threadId: null,
  pending: "none",
};

export function useTravelPlanner() {
  const [state, setState] = useState<PlannerState>(() => ({
    ...INITIAL,
    threadId: readThread(),
  }));
  const inFlight = useRef(false);
  const phaseRef = useRef<PlannerPhase>(state.phase);
  phaseRef.current = state.phase;

  const clearError = useCallback(
    () => setState((s) => (s.error ? { ...s, error: null } : s)),
    [],
  );

  const absorb = useCallback((data: TravelResponse) => {
    writeThread(data.thread_id);

    if (data.guardrail_allowed === false) {
      setState({
        phase: "blocked",
        data,
        answer: data.answer || data.guardrail_reason,
        isDraft: false,
        error: null,
        threadId: data.thread_id,
        pending: "none",
      });
      return;
    }

    if (data.requires_approval) {
      setState({
        phase: "awaiting_approval",
        data,
        answer: data.itinerary || data.answer,
        isDraft: true,
        error: null,
        threadId: data.thread_id,
        pending: "none",
      });
      return;
    }

    setState({
      phase: "complete",
      data,
      answer: data.answer,
      isDraft: false,
      error: null,
      threadId: data.thread_id,
      pending: "none",
    });
  }, []);

  const plan = useCallback(
    async (message: string) => {
      if (inFlight.current) return;

      const trimmed = message.trim();
      if (!trimmed) {
        setState((s) => ({
          ...s,
          error: "Describe your trip before generating a plan.",
        }));
        return;
      }

      if (phaseRef.current === "awaiting_approval") {
        setState((s) => ({
          ...s,
          error: "Approve or revise the current draft before starting a new plan.",
        }));
        return;
      }

      inFlight.current = true;
      setState((s) => ({ ...s, phase: "planning", pending: "plan", error: null }));

      try {
        const data = await requestPlan({ message: trimmed, threadId: readThread() });
        absorb(data);
      } catch (err) {
        setState((s) => ({
          ...s,
          phase: "idle",
          pending: "none",
          error: err instanceof Error ? err.message : "Unexpected error.",
        }));
      } finally {
        inFlight.current = false;
      }
    },
    [absorb],
  );

  const decide = useCallback(
    async (approved: boolean, feedback: string) => {
      if (inFlight.current) return;

      const threadId = state.threadId ?? readThread();
      if (!threadId || phaseRef.current !== "awaiting_approval") {
        setState((s) => ({ ...s, error: "There is no draft waiting for approval." }));
        return;
      }

      const trimmedFeedback = feedback.trim();
      if (!approved && !trimmedFeedback) {
        setState((s) => ({
          ...s,
          error: "Add revision feedback before requesting changes.",
        }));
        return;
      }

      inFlight.current = true;
      setState((s) => ({
        ...s,
        phase: "finalising",
        pending: approved ? "approve" : "revise",
        error: null,
      }));

      try {
        const data = await submitApproval({
          threadId,
          approved,
          feedback: trimmedFeedback,
        });
        absorb(data);
      } catch (err) {
        setState((s) => ({
          ...s,
          phase: "awaiting_approval",
          pending: "none",
          error: err instanceof Error ? err.message : "Could not resume the workflow.",
        }));
      } finally {
        inFlight.current = false;
      }
    },
    [absorb, state.threadId],
  );

  const reset = useCallback(() => {
    writeThread(null);
    setState({ ...INITIAL, threadId: null });
  }, []);

  const busy = state.pending !== "none";

  return { state, busy, plan, decide, reset, clearError };
}
