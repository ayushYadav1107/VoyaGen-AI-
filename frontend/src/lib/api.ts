import type { TravelResponse } from "./types";

const JSON_HEADERS = { "Content-Type": "application/json" };

/**
 * Provider errors arrive as a raw JSON blob pasted into `error` — unreadable in
 * a banner and, worse, it buries the one thing the user can act on. Recognise
 * the common shapes and say what to do instead.
 */
function humanise(raw: string): string {
  const text = raw.toLowerCase();

  const oversized =
    text.includes("request too large") || text.includes("reduce your message size");
  const rateLimited =
    text.includes("rate_limit_exceeded") ||
    text.includes("rate limit") ||
    text.includes("tokens per minute");

  if (oversized) {
    return (
      "The request exceeded the model's per-minute token allowance. " +
      "Set GROQ_TPM_LIMIT in .env to your actual limit so prompts are budgeted " +
      "against it, or lower ITINERARY_COMPLETION_TOKENS / FINAL_COMPLETION_TOKENS."
    );
  }

  if (rateLimited) {
    const retry = raw.match(/try again in ([0-9.]+)\s*s/i);
    const wait = retry ? `about ${Math.ceil(Number(retry[1]))} seconds` : "a minute";
    return (
      `Groq's rate limit was hit — the plan used more tokens than the current ` +
      `plan allows per minute. Wait ${wait} and try again, or switch GROQ_MODEL ` +
      `to a model with a higher limit.`
    );
  }

  if (text.includes("invalid api key") || text.includes("401")) {
    return "Groq rejected the API key. Check GROQ_API_KEY in your .env file.";
  }

  if (text.includes("uvx") || text.includes("aviationstack")) {
    return (
      "The flight tool server could not start. Check that `uv` is installed and " +
      "`uvx --version` works in the environment running the API."
    );
  }

  // Unknown shape: keep it, but do not let a multi-kilobyte payload into the UI.
  return raw.length > 400 ? `${raw.slice(0, 400).trimEnd()}…` : raw;
}

async function parse<T>(response: Response): Promise<T> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(
      `Server returned ${response.status} ${response.statusText} with an unreadable body.`,
    );
  }

  const data = payload as Partial<TravelResponse> & { error?: string };

  if (!response.ok || data.success === false) {
    throw new Error(
      data.error ? humanise(data.error) : "Something went wrong on the server.",
    );
  }
  return data as T;
}

export async function requestPlan(input: {
  message: string;
  threadId: string | null;
}): Promise<TravelResponse> {
  const response = await fetch("/api/travel", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ message: input.message, thread_id: input.threadId }),
  });
  return parse<TravelResponse>(response);
}

export async function submitApproval(input: {
  threadId: string;
  approved: boolean;
  feedback: string;
}): Promise<TravelResponse> {
  const response = await fetch("/api/travel/approve", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({
      thread_id: input.threadId,
      approved: input.approved,
      feedback: input.feedback,
    }),
  });
  return parse<TravelResponse>(response);
}
