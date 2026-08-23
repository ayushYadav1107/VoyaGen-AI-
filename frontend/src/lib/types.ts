/**
 * Mirrors backend._serialize_result() in backend.py — do not add fields the
 * FastAPI layer does not actually send.
 */
export type AgentId =
  | "flight_agent"
  | "hotel_agent"
  | "weather_agent"
  | "budget_agent"
  | "itinerary_agent";

export interface TripConstraints {
  destination?: string;
  origin?: string;
  duration?: string;
  budget?: string;
  travel_style?: string;
  special_preferences?: string[];
}

export interface TravelResponse {
  success: boolean;
  thread_id: string;
  answer: string;
  requires_approval: boolean;
  approval_request: string;
  flight_results: string;
  hotel_results: string;
  weather_results: string;
  budget_results: string;
  itinerary: string;
  selected_agents: AgentId[];
  trip_constraints: TripConstraints;
  supervisor_reasoning: string;
  guardrail_allowed: boolean;
  guardrail_reason: string;
  approved: boolean | null;
  human_feedback: string;
  llm_calls: number;
}

export interface ApiError {
  success: false;
  error: string;
}

export type PlannerPhase =
  | "idle"
  | "planning"
  | "awaiting_approval"
  | "finalising"
  | "complete"
  | "blocked";
