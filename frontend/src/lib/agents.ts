import {
  Plane,
  Hotel,
  CloudSun,
  Wallet,
  CalendarRange,
  type LucideIcon,
} from "lucide-react";
import type { AgentId } from "./types";

export interface AgentMeta {
  id: AgentId;
  label: string;
  short: string;
  icon: LucideIcon;
  /** Tailwind-free raw colors so we can drive glows and gradients inline. */
  rgb: string;
  blurb: string;
}

export const AGENTS: Record<AgentId, AgentMeta> = {
  flight_agent: {
    id: "flight_agent",
    label: "Flight Agent",
    short: "Flights",
    icon: Plane,
    rgb: "76 141 255",
    blurb: "Routes, airports and airlines via the AviationStack tool",
  },
  hotel_agent: {
    id: "hotel_agent",
    label: "Hotel Agent",
    short: "Hotels",
    icon: Hotel,
    rgb: "139 92 246",
    blurb: "Stays and neighbourhoods via the Tavily MCP server",
  },
  weather_agent: {
    id: "weather_agent",
    label: "Weather Agent",
    short: "Weather",
    icon: CloudSun,
    rgb: "62 232 255",
    blurb: "Forecast and packing advice via the custom weather MCP server",
  },
  budget_agent: {
    id: "budget_agent",
    label: "Budget Agent",
    short: "Budget",
    icon: Wallet,
    rgb: "52 229 176",
    blurb: "Cost feasibility against the stated budget ceiling",
  },
  itinerary_agent: {
    id: "itinerary_agent",
    label: "Itinerary Agent",
    short: "Itinerary",
    icon: CalendarRange,
    rgb: "232 121 249",
    blurb: "Composes the day-by-day draft for human review",
  },
};

export const AGENT_ORDER: AgentId[] = [
  "flight_agent",
  "hotel_agent",
  "weather_agent",
  "budget_agent",
  "itinerary_agent",
];

export function agentMeta(id: string): AgentMeta {
  return (
    AGENTS[id as AgentId] ?? {
      id: id as AgentId,
      label: id.replace(/_/g, " "),
      short: id.replace(/_agent$/, ""),
      icon: CalendarRange,
      rgb: "168 178 209",
      blurb: "Specialist agent",
    }
  );
}
