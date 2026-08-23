import type { TravelResponse } from "./types";

const JSON_HEADERS = { "Content-Type": "application/json" };

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
    throw new Error(data.error || "Something went wrong on the server.");
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
