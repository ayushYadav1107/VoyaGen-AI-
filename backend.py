import json
import os 
import certifi
from dotenv import load_dotenv

load_dotenv()

os.environ["SSL_CERT_FILE"] = certifi.where()
os.environ["REQUESTS_CA_BUNDLE"] = certifi.where()

from typing import Any, TypedDict, Annotated
import operator
import re
import time
import uuid
import asyncio
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from langgraph.graph import StateGraph, START, END
from langgraph.types import Command, interrupt

from langgraph.checkpoint.postgres import PostgresSaver
from langchain_core.messages import (
    AnyMessage,
    HumanMessage,
    AIMessage,
    SystemMessage,
)
from langchain_groq import ChatGroq
from mcp_client import tavily_mcp_search, aviation_mcp_call, extract_destination, forecast_mcp_search, weather_mcp_search


def get_database_url():
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        raise ValueError(
            "DATABASE_URL is missing. Please add your Render PostgreSQL External Database URL to .env"
        )

    if "sslmode=" not in database_url:
        separator = "&" if "?" in database_url else "?"
        database_url = f"{database_url}{separator}sslmode=require"

    return database_url


GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY is missing. Please add it to your .env file.")


# =========================
# LLM
# =========================

# =========================
# Rate-limit budgeting
# =========================
# Groq bills prompt + completion tokens against a single tokens-per-minute
# allowance. On the free tier that allowance is small (8k TPM for
# gpt-oss-120b), which is smaller than a naive "concatenate every artifact"
# prompt — the API then rejects the request outright with HTTP 413 rather than
# queueing it. Every prompt in this module is therefore budgeted against these
# numbers, and requests that hit a transient limit are retried with backoff.
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
GROQ_TPM_LIMIT = int(os.getenv("GROQ_TPM_LIMIT", "8000"))
MAX_COMPLETION_TOKENS = int(os.getenv("GROQ_MAX_COMPLETION_TOKENS", "2000"))
MAX_LLM_ATTEMPTS = int(os.getenv("GROQ_MAX_RETRIES", "4"))

# Deliberately pessimistic. Plain English runs ~4 chars/token, but most of what
# fills these prompts is JSON and tabular tool output, which tokenises far
# denser — closer to 3. Guessing high here costs a slightly shorter prompt;
# guessing low costs a rejected request.
CHARS_PER_TOKEN = 3
SAFETY_MARGIN = 0.85

# Longest artifact we will keep in TravelState. Raw Tavily payloads can run to
# tens of kilobytes; storing them whole bloats every checkpoint and guarantees
# the downstream prompt has to throw most of it away anyway.
MAX_ARTIFACT_CHARS = int(os.getenv("MAX_ARTIFACT_CHARS", "6000"))


llm = ChatGroq(
    model=GROQ_MODEL,
    api_key=GROQ_API_KEY,
    max_tokens=MAX_COMPLETION_TOKENS,
)


# =========================
# State
# =========================

class TravelState(TypedDict, total=False):
    messages: Annotated[list[AnyMessage], operator.add]
    user_query: str

    # Supervisor + guardrail state
    guardrail_allowed: bool
    guardrail_reason: str
    selected_agents: list[str]
    trip_constraints: dict[str, Any]
    supervisor_reasoning: str

    # Original specialist results
    flight_results: str
    hotel_results: str
    weather_results: str
    itinerary: str

    # New budget + HITL state
    budget_results: str
    approval_request: str
    approved: bool
    human_feedback: str
    final_response: str

    llm_calls: int


def _truncate(text, max_chars=1000):
    text = str(text)
    if len(text) <= max_chars:
        return text
    # Cut on a newline when one is close to the limit, so a trimmed artifact
    # ends on a whole line instead of mid-token.
    cut = text[:max_chars]
    breakpoint_ = cut.rfind("\n")
    if breakpoint_ > max_chars * 0.6:
        cut = cut[:breakpoint_]
    return cut.rstrip() + "\n...[truncated]"


def _prompt_char_budget(reserve_chars: int = 0) -> int:
    """
    Characters this process may put in one prompt, leaving room for the reply.

    Derived from the TPM allowance rather than a hardcoded number so that
    raising GROQ_TPM_LIMIT (paid tier, or a higher-limit model) widens every
    prompt in the graph without further code changes.
    """
    usable_tokens = max(GROQ_TPM_LIMIT - MAX_COMPLETION_TOKENS, 1_000)
    budget = int(usable_tokens * CHARS_PER_TOKEN * SAFETY_MARGIN)
    return max(budget - reserve_chars, 1_000)


def _fit_sections(
    sections: list[tuple[str, Any, int]],
    budget: int,
) -> str:
    """
    Render labelled context blocks that together fit inside `budget` chars.

    Each section declares a weight. Weights set the initial share, but any
    allowance a short section does not use is handed back to the sections that
    are over their share — so a two-line weather payload does not cost the
    draft itinerary any room.
    """
    # `str(None)` is "None", which would otherwise render as literal text in
    # the prompt, so missing values are normalised to empty before filtering.
    items = [
        (label, text, weight)
        for label, text, weight in (
            (label, "" if value is None else str(value).strip(), weight)
            for label, value, weight in sections
        )
        if text
    ]
    if not items:
        return ""

    # "Label:\n" plus the blank line between blocks.
    overhead = sum(len(label) + 4 for label, _, _ in items)
    budget = max(budget - overhead, 500)

    total_weight = sum(weight for _, _, weight in items) or 1
    shares = {
        label: max(int(budget * weight / total_weight), 120)
        for label, _, weight in items
    }

    spare = sum(
        shares[label] - len(text)
        for label, text, _ in items
        if len(text) < shares[label]
    )
    hungry = [(l, t, w) for l, t, w in items if len(t) > shares[l]]

    if hungry and spare > 0:
        hungry_weight = sum(weight for _, _, weight in hungry) or 1
        for label, _, weight in hungry:
            shares[label] += int(spare * weight / hungry_weight)

    return "\n\n".join(
        f"{label}:\n{_truncate(text, shares[label])}"
        for label, text, _ in items
    )


# =========================
# Rate-limit aware invocation
# =========================
_RETRYABLE_MARKERS = (
    "rate_limit_exceeded",
    "rate limit",
    "429",
    "please try again",
    "service unavailable",
    "502",
    "503",
)

# Groq returns this when a *single* request exceeds the whole per-minute
# allowance. Waiting cannot help — the prompt itself has to shrink.
_OVERSIZED_MARKERS = ("request too large", "reduce your message size")


def _retry_delay(message: str, attempt: int) -> float:
    """Prefer the provider's own hint, else exponential backoff."""
    match = re.search(r"try again in ([0-9.]+)\s*s", message, re.IGNORECASE)
    if match:
        return min(float(match.group(1)) + 0.5, 65.0)

    match = re.search(r"retry-after[\"']?\s*[:=]\s*([0-9.]+)", message, re.IGNORECASE)
    if match:
        return min(float(match.group(1)) + 0.5, 65.0)

    return min(2.0 ** attempt * 2.0, 60.0)


class PromptTooLargeError(RuntimeError):
    """A single request exceeded the provider's per-minute token allowance."""


def _invoke_llm(messages: list[Any], label: str = "llm"):
    """
    Call the model, absorbing transient rate limits.

    The graph makes six-plus calls in quick succession, so on a small TPM
    allowance the *cumulative* usage trips the limit even when every individual
    request fits. Backing off and retrying lets the per-minute window roll over
    instead of failing the whole run.
    """
    last_error: Exception | None = None

    for attempt in range(MAX_LLM_ATTEMPTS):
        try:
            return llm.invoke(messages)
        except Exception as exc:
            last_error = exc
            message = str(exc).lower()

            if any(marker in message for marker in _OVERSIZED_MARKERS):
                raise PromptTooLargeError(
                    f"The {label} prompt exceeded the per-minute token allowance "
                    f"for {GROQ_MODEL}. Lower GROQ_MAX_COMPLETION_TOKENS, or set "
                    f"GROQ_TPM_LIMIT to your actual limit so prompts are budgeted "
                    f"against it."
                ) from exc

            if not any(marker in message for marker in _RETRYABLE_MARKERS):
                raise

            if attempt == MAX_LLM_ATTEMPTS - 1:
                break

            delay = _retry_delay(str(exc), attempt)
            print(
                f"[{label}] rate limited, retrying in {delay:.1f}s "
                f"(attempt {attempt + 2}/{MAX_LLM_ATTEMPTS})",
                flush=True,
            )
            time.sleep(delay)

    raise RuntimeError(
        f"The {label} step was rate limited {MAX_LLM_ATTEMPTS} times by Groq. "
        f"Free-tier limits are per minute — wait a moment and retry, or upgrade "
        f"the Groq plan."
    ) from last_error

# =========================
# Shared helpers
# =========================
KNOWN_AGENTS = {
    "flight_agent",
    "hotel_agent",
    "weather_agent",
    "budget_agent",
    "itinerary_agent",
}

AGENT_ORDER = [
    "flight_agent",
    "hotel_agent",
    "weather_agent",
    "budget_agent",
    "itinerary_agent",
]


def _llm_text(system_prompt: str, user_prompt: str, label: str = "llm") -> str:
    response = _invoke_llm(
        [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ],
        label=label,
    )
    return str(response.content)


def _json_from_llm(text: str) -> dict[str, Any]:
    """Extract the first complete JSON object returned by the model."""
    start = text.find("{")
    end = text.rfind("}")

    if start == -1 or end == -1 or end < start:
        raise ValueError("The model did not return a JSON object.")

    return json.loads(text[start : end + 1])


def _empty_constraints() -> dict[str, Any]:
    return {
        "destination": "",
        "origin": "",
        "duration": "",
        "budget": "",
        "travel_style": "",
        "special_preferences": [],
    }


# =========================
# Supervisor Agent + Input Guardrail
# =========================
def supervisor_agent(state: TravelState):
    query = state["user_query"]
    llm_calls = state.get("llm_calls", 0)

    guardrail_prompt = f"""
Determine whether the following request belongs to travel planning or travel
information. Valid requests can include destinations, flights, hotels, weather,
budgets, visas, transportation, sightseeing, food, packing, or itineraries.

Block clearly unrelated requests and requests asking for harmful or illegal
instructions. Do not block a valid travel request merely because some details
are missing.

Return strict JSON only:
{{
  "allowed": true,
  "reason": ""
}}

User request:
{query}
"""

    # Fail open on parser/model errors so a temporary JSON-format issue does not
    # break the original travel-planning behavior.
    try:
        guardrail_raw = _llm_text(
            "You are the input guardrail for a travel-planning application. "
            "Return strict JSON only.",
            guardrail_prompt,
        )
        guardrail_result = _json_from_llm(guardrail_raw)
        allowed = bool(guardrail_result.get("allowed", True))
        guardrail_reason = str(guardrail_result.get("reason", "")).strip()
        llm_calls += 1
    except Exception as exc:
        print(f"Guardrail fallback used: {exc}")
        allowed = True
        guardrail_reason = "Guardrail validation fallback allowed the request."

    if not allowed:
        reason = guardrail_reason or (
            "TripMate AI can only help with travel-planning requests. "
            "Please ask about a destination, flight, hotel, weather, budget, "
            "or itinerary."
        )
        return {
            "guardrail_allowed": False,
            "guardrail_reason": reason,
            "selected_agents": [],
            "trip_constraints": _empty_constraints(),
            "supervisor_reasoning": reason,
            "final_response": reason,
            "messages": [AIMessage(content=f"Guardrail blocked request: {reason}")],
            "llm_calls": llm_calls,
        }

    supervisor_prompt = f"""
You are the supervisor of a multi-agent travel-planning system.
Choose only the specialist agents needed for the request.

Available agents:
- flight_agent: flights, airports, airlines, routes, airfare, or booking advice
- hotel_agent: hotels, accommodation, neighborhoods, or places to stay
- weather_agent: weather, climate, season, forecast, or packing advice
- budget_agent: cost, affordability, price limits, or budget feasibility
- itinerary_agent: creates the integrated travel plan and must always be included

Return strict JSON only using this schema:
{{
  "selected_agents": ["flight_agent", "hotel_agent", "weather_agent", "budget_agent", "itinerary_agent"],
  "trip_constraints": {{
    "destination": "",
    "origin": "",
    "duration": "",
    "budget": "",
    "travel_style": "",
    "special_preferences": []
  }},
  "reasoning": ""
}}

User request:
{query}
"""

    try:
        supervisor_raw = _llm_text(
            "You route work to travel specialist agents. Return strict JSON only.",
            supervisor_prompt,
        )
        parsed = _json_from_llm(supervisor_raw)
        requested_agents = parsed.get("selected_agents", [])
        selected_agents = [
            name for name in AGENT_ORDER
            if name in requested_agents and name in KNOWN_AGENTS
        ]

        # The itinerary agent integrates whichever specialist results were selected.
        if "itinerary_agent" not in selected_agents:
            selected_agents.append("itinerary_agent")

        constraints = _empty_constraints()
        parsed_constraints = parsed.get("trip_constraints", {})
        if isinstance(parsed_constraints, dict):
            constraints.update(parsed_constraints)

        reasoning = str(parsed.get("reasoning", "")).strip()
        llm_calls += 1
    except Exception as exc:
        print(f"Supervisor fallback used: {exc}")
        # Original workflow behavior is preserved as the fallback.
        selected_agents = AGENT_ORDER.copy()
        constraints = _empty_constraints()
        reasoning = (
            "Supervisor parsing failed, so the original full travel workflow "
            "was selected as a safe fallback."
        )

    return {
        "guardrail_allowed": True,
        "guardrail_reason": guardrail_reason,
        "selected_agents": selected_agents,
        "trip_constraints": constraints,
        "supervisor_reasoning": reasoning,
        "messages": [AIMessage(content="Supervisor created the agent plan.")],
        "llm_calls": llm_calls,
    }


# =========================
# Guardrail blocked response
# =========================
def guardrail_blocked_agent(state: TravelState):
    reason = state.get("final_response") or state.get("guardrail_reason") or (
        "This request was blocked by the travel input guardrail."
    )
    return {
        "final_response": reason,
        "messages": [AIMessage(content=reason)],
    }


# Flight Tool Router Prompt
FLIGHT_AGENT_PROMPT = """
You are a travel flight expert.

User Query:
{query}

Airport Information:
{airport_data}

Airline Information:
{airline_data}

Generate:

1. Likely departure airport
2. Likely arrival airport
3. Airlines serving this route
4. Typical flight duration
5. Estimated airfare range
6. Peak season pricing warning
7. Booking advice

Return concise travel guidance.
"""

def flight_agent(state: TravelState):
    query = state["user_query"]

    try:
        airports = asyncio.run(aviation_mcp_call("list_airports"))
        airlines = asyncio.run(aviation_mcp_call("list_airlines"))

        # The reference payloads dominate this prompt, so split whatever room
        # is left after the instruction template between them.
        template_size = len(FLIGHT_AGENT_PROMPT) + len(query)
        reference_budget = _prompt_char_budget(reserve_chars=template_size + 200)
        per_payload = max(reference_budget // 2, 500)

        prompt = FLIGHT_AGENT_PROMPT.format(
            query=query,
            airport_data=_truncate(str(airports), per_payload),
            airline_data=_truncate(str(airlines), per_payload),
        )

        response = _invoke_llm(
            [
                SystemMessage(content="You are an expert travel flight planner."),
                HumanMessage(content=prompt),
            ],
            label="flight_agent",
        )
        flight_data = str(response.content)
    except Exception as exc:
        # Note what failed, but never inline the raw exception: provider errors
        # can be multi-kilobyte JSON, and this string is fed into every
        # downstream prompt.
        print(
            f"FLIGHT AGENT ERROR: {type(exc).__name__}: {exc}",
            flush=True,
        )
        flight_data = (
            "Live flight lookup is temporarily unavailable "
            f"({type(exc).__name__}). Give general routing, airline and "
            "booking guidance for this journey and clearly label it as "
            "non-live advice."
        )

    return {
        "flight_results": _truncate(flight_data, MAX_ARTIFACT_CHARS),
        "messages": [AIMessage(content="Flight recommendations generated")],
        "llm_calls": state.get("llm_calls", 0) + 1,
    }

# =========================
# Hotel Agent
# =========================

def hotel_agent(state: TravelState):
    query = (
        f"Best hotels for "
        f"{state['user_query']}"
    )

    try:
        hotel_results = asyncio.run(
            tavily_mcp_search(query)
        )

    except Exception as exc:
        print(
            f"HOTEL AGENT MCP ERROR: "
            f"{type(exc).__name__}: {exc}",
            flush=True,
        )

        hotel_results = (
            "Live hotel search is temporarily unavailable. "
            "Provide general accommodation and neighborhood "
            "guidance based on the destination and clearly "
            "label it as non-live advice."
        )

    return {
        "hotel_results": _truncate(str(hotel_results), MAX_ARTIFACT_CHARS),
        "messages": [
            AIMessage(
                content="Hotel information processed."
            )
        ],
        "llm_calls": (
            state.get("llm_calls", 0) + 1
        ),
    }


# =========================
# Weather Agent
# =========================

def weather_agent(state: TravelState):
    city = extract_destination(
        state["user_query"]
    )

    try:
        weather_data = asyncio.run(
            weather_mcp_search(city)
        )

        forecast_data = asyncio.run(
            forecast_mcp_search(city)
        )

        weather_results = f"""
Current Weather:
{weather_data}

Forecast:
{forecast_data}
"""

    except Exception as exc:
        print(
            f"WEATHER AGENT MCP ERROR: "
            f"{type(exc).__name__}: {exc}",
            flush=True,
        )

        weather_results = (
            f"Live weather information for {city} "
            "is temporarily unavailable. Give general "
            "seasonal guidance and advise the traveler "
            "to verify the forecast before departure."
        )

    return {
        "weather_results": _truncate(str(weather_results), MAX_ARTIFACT_CHARS),
        "messages": [
            AIMessage(
                content="Weather information processed."
            )
        ],
    }

# =========================
# Budget Agent
# =========================

def budget_agent(state: TravelState):
    instructions = """
Analyze whether this trip is realistic for the user's budget.

Return:
1. Estimated cost categories
2. Budget risk areas
3. Money-saving suggestions
4. Overall feasibility

If exact live prices are unavailable, clearly label estimates as approximate.
"""

    context = _fit_sections(
        [
            ("User Query", state["user_query"], 2),
            ("Trip Constraints", state.get("trip_constraints", {}), 1),
            ("Flight Results", state.get("flight_results", ""), 3),
            ("Hotel Results", state.get("hotel_results", ""), 3),
            ("Weather Results", state.get("weather_results", ""), 1),
        ],
        _prompt_char_budget(reserve_chars=len(instructions) + 200),
    )

    prompt = f"{instructions}\n{context}\n"

    response = _invoke_llm(
        [
            SystemMessage(content="You are a practical travel budget analyst."),
            HumanMessage(content=prompt),
        ],
        label="budget_agent",
    )

    return {
        "budget_results": _truncate(str(response.content), MAX_ARTIFACT_CHARS),
        "messages": [AIMessage(content="Budget assessment generated.")],
        "llm_calls": state.get("llm_calls", 0) + 1,
    }

# =========================
# Itinerary Agent
# =========================
def itinerary_agent(state: TravelState):
    instructions = """
Create a complete travel itinerary.

Make the itinerary practical, budget-aware, and easy to follow.
Create a clear draft that is ready for human review.
"""

    context = _fit_sections(
        [
            ("User Query", state["user_query"], 2),
            ("Trip Constraints", state.get("trip_constraints", {}), 2),
            ("Flight Results", state.get("flight_results", ""), 3),
            ("Hotel Results", state.get("hotel_results", ""), 3),
            ("Weather Results", state.get("weather_results", ""), 1),
            ("Budget Results", state.get("budget_results", ""), 2),
        ],
        _prompt_char_budget(reserve_chars=len(instructions) + 200),
    )

    prompt = f"{instructions}\n{context}\n"

    response = _invoke_llm(
        [
            SystemMessage(content="You are an expert travel planner."),
            HumanMessage(content=prompt),
        ],
        label="itinerary_agent",
    )

    approval_request = (
        "Please review the generated draft itinerary. Approve it to create the "
        "final polished plan, or provide feedback for revision."
    )

    return {
        "itinerary": _truncate(str(response.content), MAX_ARTIFACT_CHARS * 2),
        "approval_request": approval_request,
        "messages": [AIMessage(content="Draft itinerary created for human review.")],
        "llm_calls": state.get("llm_calls", 0) + 1,
    }

# =========================
# Human-in-the-Loop approval
# =========================
def human_approval_agent(state: TravelState):
    review = interrupt(
        {
            "question": "Do you approve this itinerary?",
            "draft_itinerary": state.get("itinerary", ""),
            "approval_request": state.get("approval_request", ""),
            "selected_agents": state.get("selected_agents", []),
            "supervisor_reasoning": state.get("supervisor_reasoning", ""),
            "expected_response": {
                "approved": True,
                "feedback": "Optional revision feedback",
            },
        }
    )

    approved = bool(review.get("approved", False))
    human_feedback = str(review.get("feedback", "")).strip()

    return {
        "approved": approved,
        "human_feedback": human_feedback,
        "messages": [AIMessage(content="Human approval step completed.")],
    }


# =========================
# Final Response Agent - HITL feedback added
# =========================
def final_agent(state: TravelState):
    if state.get("approved", False):
        review_instruction = (
            "The user approved the draft. Preserve its decisions while polishing it."
        )
    else:
        review_instruction = f"""
The user requested a revision. Apply this feedback carefully:
{state.get('human_feedback', '') or 'Improve the draft before finalizing it.'}
"""

    instructions = f"""
Generate the final travel response for the user.

The draft itinerary below is the primary source. It already synthesises the
flight, hotel, weather and budget research, so treat the supporting notes as
fact-checking references rather than material to restate in full.

Human Review:
{review_instruction}

Format the final answer beautifully using these sections:
1. Trip Summary
2. Flight Information
3. Hotel Suggestions
4. Weather Information
5. Day-by-Day Itinerary
6. Estimated Budget
7. Final Recommendations

Important:
- Be clear and practical.
- Mention that live flight APIs may not provide ticket prices when pricing is unavailable.
- Include weather-based travel advice.
- Keep the response useful for real travel planning.
- Incorporate the human feedback when revision was requested.
"""

    # The draft carries most of the weight here. Re-sending every raw artifact
    # at full length is what pushed this single request past the whole
    # per-minute token allowance, and it was largely redundant: the draft is a
    # synthesis of exactly those artifacts.
    context = _fit_sections(
        [
            ("User Request", state["user_query"], 1),
            ("Supervisor Constraints", state.get("trip_constraints", {}), 1),
            ("Draft Itinerary (primary source)", state.get("itinerary", ""), 10),
            ("Flight Notes", state.get("flight_results", ""), 2),
            ("Hotel Notes", state.get("hotel_results", ""), 2),
            ("Weather Notes", state.get("weather_results", ""), 1),
            ("Budget Notes", state.get("budget_results", ""), 2),
        ],
        _prompt_char_budget(reserve_chars=len(instructions) + 200),
    )

    final_prompt = f"{instructions}\n{context}\n"

    response = _invoke_llm(
        [
            SystemMessage(
                content="You are a professional AI travel booking assistant."
            ),
            HumanMessage(content=final_prompt),
        ],
        label="final_agent",
    )

    return {
        "final_response": response.content,
        "messages": [response],
        "llm_calls": state.get("llm_calls", 0) + 1,
    }

# =========================
# Dynamic Supervisor Routing
# =========================
ROUTE_MAP = {
    "guardrail_blocked": "guardrail_blocked",
    "flight_agent": "flight_agent",
    "hotel_agent": "hotel_agent",
    "weather_agent": "weather_agent",
    "budget_agent": "budget_agent",
    "itinerary_agent": "itinerary_agent",
}


def _selected_agents(state: TravelState) -> list[str]:
    selected = state.get("selected_agents", [])
    return [agent for agent in AGENT_ORDER if agent in selected]


def route_from_supervisor(state: TravelState) -> str:
    if not state.get("guardrail_allowed", True):
        return "guardrail_blocked"

    selected = _selected_agents(state)
    return selected[0] if selected else "itinerary_agent"


def route_after_agent(current_agent: str):
    def route(state: TravelState) -> str:
        selected = _selected_agents(state)
        current_index = AGENT_ORDER.index(current_agent)

        for next_agent in AGENT_ORDER[current_index + 1 :]:
            if next_agent in selected:
                return next_agent

        return "itinerary_agent"

    return route

# =========================
# Build Graph
# =========================
graph = StateGraph(TravelState)

graph.add_node("supervisor", supervisor_agent)
graph.add_node("guardrail_blocked", guardrail_blocked_agent)
graph.add_node("flight_agent", flight_agent)
graph.add_node("hotel_agent", hotel_agent)
graph.add_node("weather_agent", weather_agent)
graph.add_node("budget_agent", budget_agent)
graph.add_node("itinerary_agent", itinerary_agent)
graph.add_node("human_approval", human_approval_agent)
graph.add_node("final_agent", final_agent)

graph.add_edge(START, "supervisor")
graph.add_conditional_edges("supervisor", route_from_supervisor, ROUTE_MAP)

graph.add_conditional_edges(
    "flight_agent", route_after_agent("flight_agent"), ROUTE_MAP
)
graph.add_conditional_edges(
    "hotel_agent", route_after_agent("hotel_agent"), ROUTE_MAP
)
graph.add_conditional_edges(
    "weather_agent", route_after_agent("weather_agent"), ROUTE_MAP
)
graph.add_conditional_edges(
    "budget_agent", route_after_agent("budget_agent"), ROUTE_MAP
)

graph.add_edge("itinerary_agent", "human_approval")
graph.add_edge("human_approval", "final_agent")
graph.add_edge("final_agent", END)
graph.add_edge("guardrail_blocked", END)

# =========================
# PostgreSQL Checkpointer
# =========================
# A pooled connection rather than a single blocking one: a graph run holds its
# connection for the whole request (six-plus LLM calls, several MCP round-trips),
# so one shared connection serialises every concurrent request behind the slowest.
DATABASE_URL = get_database_url()

_pool = ConnectionPool(
    conninfo=DATABASE_URL,
    min_size=1,
    max_size=int(os.getenv("DB_POOL_MAX_SIZE", "10")),
    # PostgresSaver requires all three: autocommit for its own transaction
    # handling, dict rows for checkpoint deserialisation, and prepare_threshold=0
    # because pooled connections are recycled across differing statements.
    kwargs={
        "autocommit": True,
        "row_factory": dict_row,
        "prepare_threshold": 0,
    },
    open=True,
)

checkpointer = PostgresSaver(_pool)
checkpointer.setup()  # idempotent schema migration

travel_graph = graph.compile(checkpointer=checkpointer)


def close_checkpointer() -> None:
    """Release the connection pool. Called from the FastAPI lifespan handler."""
    _pool.close()

# =========================
# FastAPI-facing helpers
# =========================
def _interrupt_payload(result: dict[str, Any]) -> dict[str, Any] | None:
    interrupts = result.get("__interrupt__", [])
    if not interrupts:
        return None

    first_interrupt = interrupts[0]
    payload = getattr(first_interrupt, "value", first_interrupt)
    return payload if isinstance(payload, dict) else {"value": payload}


def _serialize_result(
    result: dict[str, Any],
    thread_id: str,
) -> dict[str, Any]:
    messages = result.get("messages", [])
    last_message = messages[-1].content if messages else ""
    answer = result.get("final_response") or last_message
    interrupt_payload = _interrupt_payload(result)

    if interrupt_payload:
        answer = interrupt_payload.get("draft_itinerary") or result.get(
            "itinerary", ""
        )

    return {
        "thread_id": thread_id,
        "answer": answer,
        "requires_approval": interrupt_payload is not None,
        "approval_request": (
            interrupt_payload.get("approval_request", "")
            if interrupt_payload
            else result.get("approval_request", "")
        ),
        "flight_results": result.get("flight_results", ""),
        "hotel_results": result.get("hotel_results", ""),
        "weather_results": result.get("weather_results", ""),
        "budget_results": result.get("budget_results", ""),
        "itinerary": (
            interrupt_payload.get("draft_itinerary", "")
            if interrupt_payload
            else result.get("itinerary", "")
        ),
        "selected_agents": result.get("selected_agents", []),
        "trip_constraints": result.get("trip_constraints", {}),
        "supervisor_reasoning": result.get("supervisor_reasoning", ""),
        "guardrail_allowed": result.get("guardrail_allowed", True),
        "guardrail_reason": result.get("guardrail_reason", ""),
        "approved": result.get("approved"),
        "human_feedback": result.get("human_feedback", ""),
        "llm_calls": result.get("llm_calls", 0),
    }


def run_travel_agent(user_input: str, thread_id: str | None = None):
    """Start a new travel-planning run and pause at human approval."""
    if not thread_id:
        thread_id = f"user_{uuid.uuid4().hex}"

    config = {"configurable": {"thread_id": thread_id}}

    result = travel_graph.invoke(
        {
            "messages": [HumanMessage(content=user_input)],
            "user_query": user_input,
            "guardrail_allowed": True,
            "guardrail_reason": "",
            "selected_agents": [],
            "trip_constraints": _empty_constraints(),
            "supervisor_reasoning": "",
            "flight_results": "",
            "hotel_results": "",
            "weather_results": "",
            "budget_results": "",
            "itinerary": "",
            "approval_request": "",
            "approved": False,
            "human_feedback": "",
            "final_response": "",
            "llm_calls": 0,
        },
        config=config,
    )

    return _serialize_result(result, thread_id)


def resume_travel_agent(
    thread_id: str,
    approved: bool,
    feedback: str = "",
):
    """Resume the paused LangGraph thread after human review."""
    if not thread_id:
        raise ValueError("thread_id is required to resume a travel plan.")

    config = {"configurable": {"thread_id": thread_id}}
    result = travel_graph.invoke(
        Command(
            resume={
                "approved": approved,
                "feedback": feedback.strip(),
            }
        ),
        config=config,
    )

    return _serialize_result(result, thread_id) 