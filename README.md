<div align="center">

<img src="assets/ui-hero.png" alt="VoyaGen AI planner interface" width="100%">

# ✈️ VoyaGen AI

### A supervisor-routed, guardrailed, human-in-the-loop multi-agent travel planner

*Turn one sentence — "Plan a 7-day Japan trip from India under ₹2 lakhs" — into a grounded,
budget-tested itinerary that **you approve** before it is finalised.*

[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![LangGraph](https://img.shields.io/badge/LangGraph-1.2-1C3C3C?style=flat-square&logo=langchain&logoColor=white)](https://langchain-ai.github.io/langgraph/)
[![MCP](https://img.shields.io/badge/MCP-3%20servers-6E56CF?style=flat-square)](https://modelcontextprotocol.io/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.136-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind](https://img.shields.io/badge/Tailwind-3.4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Checkpointer-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Groq](https://img.shields.io/badge/Groq-LPU%20Inference-F55036?style=flat-square)](https://groq.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

</div>

---

## 📖 Table of Contents

**Understanding the system**

- [Overview](#-overview)
- [Why This Project](#-why-this-project)
- [Key Features](#-key-features)
- [The Interface](#-the-interface)

**Architecture**

- [System Architecture](#-system-architecture)
- [End-to-End Architecture Diagram](#-end-to-end-architecture-diagram)
- [The Agent Graph](#-the-agent-graph)
- [Layer 1 · Input Guardrail](#-layer-1--input-guardrail)
- [Layer 2 · The Supervisor Agent](#-layer-2--the-supervisor-agent)
- [Layer 3 · Dynamic Routing](#-layer-3--dynamic-routing)
- [Layer 4 · The MCP Tool Fabric](#-layer-4--the-mcp-tool-fabric)
- [Layer 5 · Human-in-the-Loop Interrupt](#-layer-5--human-in-the-loop-interrupt)
- [State Design](#-state-design)
- [Persistence & Checkpointing](#-persistence--checkpointing)
- [Request Lifecycle](#-request-lifecycle)

**Frontend**

- [Frontend Architecture](#-frontend-architecture)
- [Design System](#-design-system)

**Running it**

- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Configuration](#️-configuration)
- [Running the Application](#️-running-the-application)
- [Docker Deployment](#-docker-deployment)
- [API Reference](#-api-reference)

**Engineering notes**

- [Example Walkthrough](#-example-walkthrough)
- [Design Decisions & Trade-offs](#-design-decisions--trade-offs)
- [Known Limitations](#️-known-limitations)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)
- [Acknowledgements](#-acknowledgements)

---

## 🌍 Overview

**VoyaGen AI** is an end-to-end, production-shaped **multi-agent system** that plans complete
trips from a single natural-language request. Rather than dropping one monolithic prompt on a
language model and hoping for the best, VoyaGen decomposes travel planning into a **directed
graph of specialised agents**, each owning exactly one responsibility, all communicating through
a single typed, durably checkpointed state object.

Five things make it more than a demo:

| | |
| --- | --- |
| 🛡️ **Guardrailed** | Every request passes an LLM-backed relevance/safety check before a single specialist runs. Off-domain requests short-circuit the graph and return a reason. |
| 🧠 **Supervisor-routed** | A supervisor agent reads the request and *decides at runtime* which specialists are needed. A weather question never pays for a flight lookup. |
| 🔌 **MCP-grounded** | Facts come from three [Model Context Protocol](https://modelcontextprotocol.io/) servers — Tavily (hosted HTTP), AviationStack (stdio), and a custom weather server — not from the model's parametric memory. |
| 👤 **Human-in-the-loop** | The graph **interrupts** at a real LangGraph `interrupt()` after drafting the itinerary. Nothing is finalised until a person approves or sends revision feedback. |
| 💾 **Resumable** | State lives in PostgreSQL via LangGraph's `PostgresSaver`. A `thread_id` survives process restarts, redeploys, and horizontal scaling — which is exactly what makes the interrupt/resume cycle work at all. |

```text
User: "Plan a complete 7 day Japan trip from India including
       flights, hotels and sightseeing under 2 lakhs"

                            ⬇  guardrail: PASS
                            ⬇  supervisor: all 5 specialists
                            ⬇  flight · hotel · weather · budget · itinerary
                            ⬇  ⏸  INTERRUPT — awaiting your review
                            ⬇  you: "reduce the hotel cost, add a free day"
                            ⬇  final agent re-synthesises

VoyaGen: 1. Trip Summary        5. Day-by-Day Itinerary
         2. Flight Information  6. Estimated Budget
         3. Hotel Suggestions   7. Final Recommendations
         4. Weather Information
```

---

## 💡 Why This Project

Travel planning is a deceptively good benchmark for applied-AI engineering: it is
**multi-source** (flights, lodging, weather, budget), **temporally grounded** (live schedules and
forecasts), **constraint-driven** (budget, duration, origin), and **long-form** (the output is a
structured document, not a sentence). A single LLM call fails at it in predictable ways —
hallucinated flight numbers, invented hotel prices, itineraries that quietly ignore the stated
budget.

VoyaGen AI was built to answer five engineering questions:

| Question | How VoyaGen answers it |
| --- | --- |
| **How do you stop an LLM from inventing facts?** | Push every factual claim to an MCP tool. The LLM is used for *synthesis and formatting*, never for retrieval of flights, hotels, or weather. |
| **How do you avoid paying for work the request doesn't need?** | A supervisor agent selects the minimum viable set of specialists per request, so a weather-only question runs one agent instead of five. |
| **How do you keep a multi-step agent debuggable?** | Model the workflow as an explicit `StateGraph` with named nodes, and expose *every* intermediate field over the API — plus a `supervisor_reasoning` string that explains the routing decision in plain English. |
| **How do you keep a human meaningfully in control?** | A real graph interrupt, not a fake confirmation dialog. Execution genuinely pauses mid-graph, the state is checkpointed, and a separate HTTP request resumes it with the human's decision. |
| **How do you make agent memory survive production?** | A `PostgresSaver` checkpointer keyed by `thread_id`, so threads outlive the process. |

---

## ✨ Key Features

| | Feature | Description |
| :-: | --- | --- |
| 🛡️ | **Input guardrail** | An LLM-backed classifier returns `{allowed, reason}` before routing. Off-domain requests exit through a dedicated `guardrail_blocked` node with an explanation. |
| 🧠 | **Supervisor agent** | Reads the request, extracts `trip_constraints` (destination, origin, duration, budget, style, preferences) and selects `selected_agents` — dynamic workflow definition, no hand-wired branches. |
| ✈️ | **Flight agent** | Airport and airline reference data from the **AviationStack MCP** server, synthesised into route options, carriers, durations, fare ranges and booking advice. |
| 🏨 | **Hotel agent** | Live, cited lodging discovery through the **Tavily MCP** server over streamable HTTP. |
| 🌦️ | **Weather agent** | Current conditions *and* a 5-slot forecast from a **custom FastMCP weather server** wrapping OpenWeather. |
| 💰 | **Budget agent** | Pressure-tests the plan against the stated ceiling: cost categories, risk areas, savings levers, feasibility verdict. |
| 🗓️ | **Itinerary agent** | Composes the day-by-day draft from everything above, explicitly framed as *ready for human review*. |
| 👤 | **Human-in-the-loop** | `langgraph.types.interrupt()` pauses the graph; `Command(resume=…)` restarts it with `approved` + `feedback`. |
| 💾 | **Durable memory** | PostgreSQL-backed checkpointing; threads persist across restarts, redeploys and replicas. |
| ⚡ | **Fast inference** | Groq LPU inference (`openai/gpt-oss-120b`). |
| 🎨 | **Modern React UI** | Vite + React 18 + TypeScript + Tailwind + Framer Motion. Aurora-mesh background, glassmorphic surfaces, animated agent pipeline, dark/light themes, markdown rendering, PDF export. |
| 🔌 | **Transparent JSON API** | Both endpoints return the final answer *plus* every intermediate artifact, the supervisor's reasoning, the guardrail verdict and an LLM-call counter. |
| 📊 | **LangSmith tracing** | Optional, env-gated observability across the whole graph. |
| 🐳 | **Containerised** | Slim Python 3.11 image, Uvicorn entrypoint, ready for Render / Railway / Fly.io / Cloud Run / ECS. |

---

## 🖥 The Interface

The front end is a single-page React application that mirrors the graph's own phases: compose →
supervisor plan → draft → human review → final plan.

<table>
<tr>
<td width="50%"><img src="assets/ui-supervisor.png" alt="Supervisor execution plan showing the selected agent pipeline and guardrail verdict" width="100%"></td>
<td width="50%"><img src="assets/ui-hitl.png" alt="Human-in-the-loop review panel with approve and revise actions" width="100%"></td>
</tr>
<tr>
<td align="center"><b>Supervisor execution plan</b><br/><sub>Routing rationale, guardrail verdict, LLM-call counter, and the animated agent pipeline with the resolved graph path.</sub></td>
<td align="center"><b>Human-in-the-loop review</b><br/><sub>The graph is paused. Approve to finalise, or send feedback and the final agent re-synthesises around it.</sub></td>
</tr>
<tr>
<td><img src="assets/ui-plan.png" alt="Rendered travel plan with tables and sections" width="100%"></td>
<td><img src="assets/ui-light.png" alt="Light theme" width="100%"></td>
</tr>
<tr>
<td align="center"><b>Rendered plan</b><br/><sub>GitHub-flavoured markdown with styled tables, copy-to-clipboard, and a light-forced PDF export.</sub></td>
<td align="center"><b>Light theme</b><br/><sub>Every colour is a CSS custom property, so both themes are one token swap apart.</sub></td>
</tr>
</table>

---

## 🏛 System Architecture

The system is deliberately layered so each concern can be tested, replaced, or scaled in
isolation.

```mermaid
flowchart TB
    subgraph Client["🎨  Presentation — React SPA (frontend/)"]
        UI["Vite · React 18 · TypeScript<br/>Tailwind · Framer Motion"]
        HK["useTravelPlanner()<br/>phase machine + thread persistence"]
        UI --- HK
    end

    subgraph API["⚙️  Service — FastAPI (app.py)"]
        R1["POST /api/travel<br/>start / restart a thread"]
        R2["POST /api/travel/approve<br/>resume a paused thread"]
        R3["GET /health"]
    end

    subgraph Graph["🧠  Orchestration — LangGraph (backend.py)"]
        SUP["supervisor<br/>guardrail + routing"]
        BLK["guardrail_blocked"]
        SPEC["flight · hotel · weather · budget"]
        ITIN["itinerary_agent"]
        HITL["human_approval<br/>⏸ interrupt()"]
        FIN["final_agent"]
        SUP --> BLK
        SUP --> SPEC --> ITIN --> HITL --> FIN
    end

    subgraph MCP["🔌  Tool Fabric — MCP (mcp_client.py)"]
        M1["tavily<br/>streamable_http"]
        M2["aviationstack<br/>stdio via uvx"]
        M3["weather<br/>stdio, local FastMCP"]
    end

    subgraph Ext["☁️  External Services"]
        E1["Tavily Search API"]
        E2["AviationStack API"]
        E3["OpenWeather API"]
        E4["Groq LPU Inference"]
        E5[("PostgreSQL<br/>checkpoint store")]
    end

    HK -->|"JSON"| R1
    HK -->|"JSON"| R2
    R1 --> SUP
    R2 -->|"Command(resume=…)"| HITL
    SPEC --> M1 --> E1
    SPEC --> M2 --> E2
    SPEC --> M3 --> E3
    SUP -.-> E4
    ITIN -.-> E4
    FIN -.-> E4
    Graph <-->|"checkpoint read/write"| E5
    FIN -->|"final answer + artifacts"| HK
```

**Why these boundaries:**

1. **Presentation** — a typed React client that knows only the JSON contract. It holds a phase
   machine (`idle → planning → awaiting_approval → finalising → complete`) mirroring the graph,
   so the UI can never show an approve button for a thread that isn't paused.
2. **Service** — FastAPI owns request validation (`pydantic` models), the error boundary, and
   the two-endpoint contract. It contains no travel logic.
3. **Orchestration** — LangGraph owns control flow, state reduction, interrupts, and persistence.
4. **Tool fabric** — every external fact enters through an MCP server. Swapping AviationStack for
   Amadeus means changing one server entry, not touching an agent.

---

## 🗺 End-to-End Architecture Diagram

A wider view of the same system — the guardrail, the supervisor, each specialist with the MCP
server behind it, how their outputs land in the shared `TravelState`, the human review gate, and
how everything is persisted:

<div align="center">
  <img src="assets/architecture.png" alt="VoyaGen AI architecture: user input → input guardrail → supervisor agent → dynamically selected specialist agents (flight, hotel, weather, budget, itinerary) backed by MCP servers → shared TravelState → human-in-the-loop review → final response agent → PostgreSQL persistence" width="100%">
</div>

**Reading this diagram:**

- **Nothing runs before the guardrail.** A blocked request never reaches the supervisor, so an
  off-domain prompt costs exactly one LLM call.
- **The supervisor writes the workflow, the graph executes it.** `selected_agents` is data, not
  code — which is why adding a sixth specialist requires a node, a routing entry, and one line
  in the supervisor prompt, and nothing else.
- **Every agent writes into the *same* `TravelState`** rather than passing messages
  point-to-point. That is what lets the budget agent read flight and hotel results fetched two
  steps earlier without re-fetching, and the final agent see all of it at once.
- **The human sits inside the graph, not beside it.** Review happens at a checkpointed pause
  between the draft and the final synthesis — the plan the user approves is the plan that gets
  polished.
- **State is checkpointed after each step**, so a restart mid-run resumes from the last completed
  node instead of losing the conversation.

---

## 🕸 The Agent Graph

```mermaid
stateDiagram-v2
    direction TB

    [*] --> supervisor

    supervisor --> guardrail_blocked : guardrail_allowed == false
    guardrail_blocked --> [*] : returns the block reason

    supervisor --> flight_agent : first selected agent
    supervisor --> hotel_agent
    supervisor --> weather_agent
    supervisor --> budget_agent
    supervisor --> itinerary_agent

    flight_agent --> hotel_agent : next selected
    flight_agent --> weather_agent
    flight_agent --> budget_agent
    hotel_agent --> weather_agent
    hotel_agent --> budget_agent
    weather_agent --> budget_agent
    budget_agent --> itinerary_agent

    itinerary_agent --> human_approval : writes draft + approval_request
    human_approval --> final_agent : ⏸ interrupt → resume(approved, feedback)
    final_agent --> [*] : writes final_response
```

> Every specialist edge is a **conditional edge**. `route_after_agent(current)` walks the fixed
> `AGENT_ORDER` list forward from the current node and jumps to the next agent that is present in
> `selected_agents`, falling through to `itinerary_agent` when none remain. The order is fixed —
> the *membership* is dynamic.

### Node responsibilities

| Node | Reads from state | Tool / model | Writes to state |
| --- | --- | --- | --- |
| **`supervisor`** | `user_query` | Groq LLM ×2 (guardrail + routing) | `guardrail_allowed`, `guardrail_reason`, `selected_agents`, `trip_constraints`, `supervisor_reasoning` |
| **`guardrail_blocked`** | `guardrail_reason` | — | `final_response` |
| **`flight_agent`** | `user_query` | AviationStack MCP (`list_airports`, `list_airlines`) → Groq LLM | `flight_results` |
| **`hotel_agent`** | `user_query` | Tavily MCP (`tavily_search`) | `hotel_results` |
| **`weather_agent`** | `user_query` | Weather MCP (`get_current_weather`, `get_forecast`) | `weather_results` |
| **`budget_agent`** | query, constraints, flight/hotel/weather results | Groq LLM, *"practical travel budget analyst"* | `budget_results` |
| **`itinerary_agent`** | everything above | Groq LLM, *"expert travel planner"* | `itinerary`, `approval_request` |
| **`human_approval`** | `itinerary`, `approval_request` | **`interrupt()`** — no model call | `approved`, `human_feedback` |
| **`final_agent`** | everything, incl. the human's verdict | Groq LLM, *"professional travel booking assistant"* | `final_response` |

**Why separate `itinerary_agent` and `final_agent`?** Splitting *reasoning over noisy retrieval*
from *formatting to a strict seven-section contract* keeps each prompt short and single-purpose,
so section formatting and constraint-following are not competing for attention inside one long
instruction. It also creates the natural seam where the human review belongs: the draft is
substantive enough to judge, and the final pass is cheap enough to re-run against feedback.

---

## 🛡 Layer 1 · Input Guardrail

The very first thing the supervisor node does is classify the request. It runs **before** routing,
before any tool call, and before any specialist LLM call.

```mermaid
flowchart LR
    Q["user_query"] --> G["Guardrail LLM<br/><i>strict JSON</i>"]
    G --> J{"allowed?"}
    J -->|"true"| ROUTE["→ supervisor routing prompt"]
    J -->|"false"| BLOCK["guardrail_blocked node"]
    BLOCK --> OUT["final_response = reason<br/>graph ends · 1 LLM call spent"]
    G -.->|"malformed JSON /<br/>API failure"| FAILOPEN["fail open → allow<br/>(availability &gt; strictness)"]
    FAILOPEN --> ROUTE
```

The guardrail contract is a two-field JSON object:

```json
{ "allowed": true, "reason": "" }
```

Valid requests may concern *destinations, flights, hotels, weather, budgets, visas,
transportation, sightseeing, food, packing, or itineraries*. Anything else is refused with a
human-readable reason that flows straight through to the UI's **Guardrail blocked** badge.

**Design note — why fail open?** `_json_from_llm()` extracts the first complete JSON object from
the model's reply. If the model returns prose, or the API call fails, the code treats the request
as allowed rather than blocking it. For a travel planner, wrongly refusing a legitimate trip is a
worse failure than wastefully planning an odd one. A system with a stricter threat model would
invert that default.

---

## 🧠 Layer 2 · The Supervisor Agent

Once the request clears the guardrail, the same node runs a second, different prompt whose entire
job is to **write the workflow**.

```mermaid
flowchart TB
    Q["user_query"] --> S["Supervisor LLM"]
    S --> OUT["strict JSON output"]
    OUT --> A["selected_agents[]<br/><sub>which specialists to run</sub>"]
    OUT --> B["trip_constraints{}<br/><sub>destination · origin · duration<br/>budget · style · preferences</sub>"]
    OUT --> C["reasoning<br/><sub>plain-English rationale,<br/>surfaced in the UI</sub>"]

    A --> V{"validate"}
    V -->|"unknown name"| DROP["dropped"]
    V -->|"known"| KEEP["kept, re-sorted into AGENT_ORDER"]
    KEEP --> FORCE["itinerary_agent always appended"]
```

The supervisor emits exactly this shape:

```json
{
  "selected_agents": ["flight_agent", "hotel_agent", "weather_agent", "budget_agent", "itinerary_agent"],
  "trip_constraints": {
    "destination": "Japan",
    "origin": "India",
    "duration": "7 days",
    "budget": "2 lakhs",
    "travel_style": "balanced",
    "special_preferences": ["sightseeing"]
  },
  "reasoning": "The request names a destination, an origin, a duration and a hard budget ceiling, and explicitly asks for flights, hotels and sightseeing — so all five specialists are required."
}
```

Three safeguards sit between that JSON and execution:

| Safeguard | What it prevents |
| --- | --- |
| **Membership filter** against `KNOWN_AGENTS` | A hallucinated agent name (`"visa_agent"`) silently becoming a routing target. |
| **Re-sort into `AGENT_ORDER`** | The model returning agents in an order that would let the budget agent run before flight data exists. |
| **`itinerary_agent` always forced in** | A request that skips the composer and produces no plan at all. |

Because `reasoning` is returned all the way to the client, the UI can show *why* those agents ran
— the routing decision is auditable by the end user, not just by the developer reading logs.

**Cost impact.** A "what's the weather in Bali?" request selects `weather_agent` +
`itinerary_agent`, so the graph makes ~3 LLM calls instead of ~7 and issues one MCP call instead
of four. The `llm_calls` counter in every response makes that saving measurable rather than
theoretical.

---

## 🔀 Layer 3 · Dynamic Routing

LangGraph needs a static topology at compile time, but the *path taken through it* is decided per
request. VoyaGen resolves that with conditional edges over a fixed order.

```mermaid
flowchart LR
    subgraph Static["Compile time — fixed topology"]
      direction LR
      N1["flight_agent"] -.-> N2["hotel_agent"] -.-> N3["weather_agent"] -.-> N4["budget_agent"] -.-> N5["itinerary_agent"]
    end
```

```python
AGENT_ORDER = [
    "flight_agent", "hotel_agent", "weather_agent",
    "budget_agent", "itinerary_agent",
]

def route_after_agent(current_agent: str):
    def route(state: TravelState) -> str:
        selected = [a for a in AGENT_ORDER if a in state.get("selected_agents", [])]
        i = AGENT_ORDER.index(current_agent)
        for nxt in AGENT_ORDER[i + 1:]:      # walk forward…
            if nxt in selected:              # …to the next *selected* agent
                return nxt
        return "itinerary_agent"             # …or fall through to the composer
    return route
```

Three requests, three different paths through the same compiled graph:

| Request | `selected_agents` | Executed path |
| --- | --- | --- |
| *"Plan a 7-day Japan trip under ₹2L"* | all five | `flight → hotel → weather → budget → itinerary` |
| *"What's the weather in Bali in July?"* | `weather`, `itinerary` | `weather → itinerary` |
| *"Cheap hotels near Shibuya?"* | `hotel`, `itinerary` | `hotel → itinerary` |

Ordering is intentional and load-bearing: retrieval agents (flight, hotel, weather) run first
because the **budget agent reads their output**, and the itinerary agent reads everything.

---

## 🔌 Layer 4 · The MCP Tool Fabric

All external facts enter through [Model Context Protocol](https://modelcontextprotocol.io/)
servers, managed by a single `MultiServerMCPClient` in `mcp_client.py`. Three servers, three
different transports — deliberately, to prove the abstraction holds.

```mermaid
flowchart LR
    subgraph App["mcp_client.py · MultiServerMCPClient"]
        C["_get_server_tool(server, tool)<br/><sub>per-server lazy load + key check</sub>"]
    end

    subgraph S1["tavily"]
        T1["tavily_search"]
    end
    subgraph S2["aviationstack"]
        T2["list_airports"]
        T3["list_airlines"]
    end
    subgraph S3["weather"]
        T4["get_current_weather"]
        T5["get_forecast"]
    end

    C -->|"streamable_http<br/>mcp.tavily.com"| S1 --> E1["Tavily Search API"]
    C -->|"stdio<br/>uvx aviationstack-mcp"| S2 --> E2["AviationStack API"]
    C -->|"stdio<br/>python custom_weather_mcp_server.py"| S3 --> E3["OpenWeather API"]
```

| Server | Transport | Process | Tools used |
| --- | --- | --- | --- |
| **tavily** | `streamable_http` | Hosted at `mcp.tavily.com` | `tavily_search` |
| **aviationstack** | `stdio` | Spawned via `uvx aviationstack-mcp` | `list_airports`, `list_airlines` |
| **weather** | `stdio` | Local `custom_weather_mcp_server.py`, run with `sys.executable` | `get_current_weather`, `get_forecast` |

### Why per-server lazy loading matters

`_get_server_tool()` loads tools from **one** server at a time rather than eagerly connecting to
all three:

```python
tools = await client.get_tools(server_name=server_name)   # not get_tools() for everything
```

This is the difference between *one* degraded capability and *total* failure. If `uvx` is not on
`PATH`, or the OpenWeather key is missing, the hotel agent still returns live Tavily results. Each
agent additionally wraps its call in a `try/except` that substitutes an **explicit, honest
fallback string** into state:

```python
hotel_results = (
    "Live hotel search is temporarily unavailable. Provide general accommodation "
    "and neighborhood guidance based on the destination and clearly label it as "
    "non-live advice."
)
```

That string is not an error message for a log — it is an instruction that flows into the
downstream prompt. The model is told to degrade *and to say that it degraded*, so a partial
outage produces a labelled, lower-confidence plan instead of a confident fabrication.

### The custom weather server

`custom_weather_mcp_server.py` is a ~60-line **FastMCP** server, included to demonstrate authoring
an MCP server rather than only consuming them:

```python
mcp = FastMCP("Weather MCP Server")

@mcp.tool()
def get_current_weather(city: str):
    ...  # OpenWeather /weather → {city, temperature_c, feels_like_c, humidity, condition, wind_speed}

@mcp.tool()
def get_forecast(city: str):
    ...  # OpenWeather /forecast → first 5 slots as {datetime, temperature, weather}
```

The weather agent first calls `extract_destination()` — a tiny single-purpose LLM call that
reduces *"Plan a 7 day Japan trip from Bangladesh under 2 lakhs"* to `"Japan"` — because the
OpenWeather API needs a place name, not a sentence.

---

## 👤 Layer 5 · Human-in-the-Loop Interrupt

This is the part that most distinguishes VoyaGen from a chained-prompt demo. The pause is a
**real LangGraph interrupt**, not a UI-side confirmation modal.

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant F as React SPA
    participant A as FastAPI
    participant G as LangGraph
    participant P as PostgreSQL

    U->>F: "Plan a 7-day Japan trip under ₹2L"
    F->>A: POST /api/travel
    A->>G: invoke(thread_id)
    G->>G: supervisor → guardrail PASS → route
    G->>G: flight · hotel · weather · budget · itinerary
    G->>P: checkpoint state
    G-->>A: __interrupt__ { draft_itinerary, approval_request }
    A-->>F: { requires_approval: true, itinerary, … }
    F-->>U: renders DRAFT + review panel

    Note over G,P: process may restart here — state is durable

    U->>F: "Revise: reduce hotel cost, add a free day"
    F->>A: POST /api/travel/approve<br/>{ thread_id, approved:false, feedback }
    A->>G: invoke(Command(resume={approved, feedback}), thread_id)
    G->>P: load checkpoint for thread_id
    G->>G: human_approval resumes → final_agent
    G->>P: checkpoint final state
    G-->>A: { final_response }
    A-->>F: { requires_approval: false, answer }
    F-->>U: renders FINAL plan
```

The node itself is remarkably small — the interrupt payload *is* the API contract:

```python
def human_approval_agent(state: TravelState):
    review = interrupt({
        "question": "Do you approve this itinerary?",
        "draft_itinerary": state.get("itinerary", ""),
        "approval_request": state.get("approval_request", ""),
        "selected_agents": state.get("selected_agents", []),
        "supervisor_reasoning": state.get("supervisor_reasoning", ""),
        "expected_response": {"approved": True, "feedback": "Optional revision feedback"},
    })
    return {
        "approved": bool(review.get("approved", False)),
        "human_feedback": str(review.get("feedback", "")).strip(),
    }
```

And the final agent branches on the verdict:

| Verdict | Instruction injected into the final prompt |
| --- | --- |
| `approved: true` | *"The user approved the draft. Preserve its decisions while polishing it."* |
| `approved: false` | *"The user requested a revision. Apply this feedback carefully: `<feedback>`"* |

**Why this needs durable checkpointing.** The pause can last minutes or days. Without
`PostgresSaver`, a restart between the draft and the approval would lose the thread entirely. The
checkpointer is not an optimisation here — it is what makes the feature possible.

**What the UI enforces on top.** While `phase === "awaiting_approval"`, the composer is locked and
explains why, and *Revise* stays disabled until feedback is non-empty — mirroring the server-side
`400` that rejects a rejection with no feedback.

---

## 🧬 State Design

Every node communicates through one typed dictionary. LangGraph merges each node's partial return
into the running state.

```python
class TravelState(TypedDict, total=False):
    messages: Annotated[list[AnyMessage], operator.add]   # append-only chat log

    user_query: str

    # Supervisor + guardrail
    guardrail_allowed: bool
    guardrail_reason: str
    selected_agents: list[str]
    trip_constraints: dict[str, Any]
    supervisor_reasoning: str

    # Specialist results
    flight_results: str
    hotel_results: str
    weather_results: str
    budget_results: str
    itinerary: str

    # Human-in-the-loop
    approval_request: str
    approved: bool
    human_feedback: str

    # Output + observability
    final_response: str
    llm_calls: int
```

```mermaid
flowchart LR
    subgraph W["Writers"]
        S["supervisor"]
        FA["flight_agent"]
        HA["hotel_agent"]
        WA["weather_agent"]
        BA["budget_agent"]
        IA["itinerary_agent"]
        HL["human_approval"]
        FN["final_agent"]
    end

    subgraph ST["TravelState"]
        F1["selected_agents<br/>trip_constraints<br/>supervisor_reasoning"]
        F2["flight_results"]
        F3["hotel_results"]
        F4["weather_results"]
        F5["budget_results"]
        F6["itinerary"]
        F7["approved · human_feedback"]
        F8["final_response"]
    end

    S --> F1
    FA --> F2
    HA --> F3
    WA --> F4
    BA --> F5
    IA --> F6
    HL --> F7
    FN --> F8

    F2 & F3 & F4 --> BA
    F1 & F2 & F3 & F4 & F5 --> IA
    F6 --> HL
    F1 & F2 & F3 & F4 & F5 & F6 & F7 --> FN
```

Three details worth calling out:

- **`Annotated[list[AnyMessage], operator.add]`** makes `messages` an *append-only reducer*.
  Nodes return only what they add; LangGraph concatenates rather than overwrites. Every other
  field uses last-write-wins, which is exactly right for single-writer fields.
- **`total=False`** means every key is optional, so a guardrail-blocked run — which never
  populates `flight_results` — is a perfectly valid state rather than a type error.
- **`llm_calls`** is incremented by every model-calling node, giving a cheap cost signal that is
  surfaced all the way into the API response and rendered in the UI's execution-plan header.

---

## 💾 Persistence & Checkpointing

```python
DATABASE_URL = get_database_url()        # appends sslmode=require when absent
_conn = psycopg.connect(DATABASE_URL, autocommit=True, row_factory=dict_row)
checkpointer = PostgresSaver(_conn)
checkpointer.setup()                     # idempotent schema migration
travel_graph = graph.compile(checkpointer=checkpointer)
```

Every invocation is scoped by `config={"configurable": {"thread_id": ...}}`. The React client
stores its `thread_id` in `localStorage`, so a returning user resumes the same durable thread —
and, critically, so does a paused approval.

```mermaid
flowchart LR
    N1["node completes"] --> C1["checkpoint written<br/>(thread_id, step)"]
    C1 --> N2["next node"]
    N2 --> C2["checkpoint written"]
    C2 --> INT["⏸ interrupt<br/>checkpoint written"]
    INT -.->|"minutes · hours · a redeploy"| RES["Command(resume=…)"]
    RES --> LOAD["load latest checkpoint<br/>for thread_id"]
    LOAD --> N3["human_approval resumes"]
```

The connection helper appends `sslmode=require` automatically when the URL omits it — a small
guard that matters for managed Postgres providers such as Render, Neon, and Supabase.

---

## 🔄 Request Lifecycle

The complete happy path, front to back:

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant R as React SPA
    participant A as FastAPI
    participant S as supervisor
    participant M as MCP servers
    participant L as Groq LLM
    participant P as PostgreSQL

    U->>R: types a request, ⌘/Ctrl+Enter
    R->>R: phase = "planning" · skeleton renders
    R->>A: POST /api/travel { message, thread_id }
    A->>S: run_travel_agent()
    S->>L: guardrail classify
    L-->>S: { allowed: true }
    S->>L: routing + constraint extraction
    L-->>S: { selected_agents, trip_constraints, reasoning }
    S->>P: checkpoint

    loop each selected specialist
        S->>M: MCP tool call (Tavily / AviationStack / Weather)
        M-->>S: grounded facts
        S->>L: synthesise this agent's section
        L-->>S: agent result
        S->>P: checkpoint
    end

    S->>L: itinerary_agent → draft
    S->>P: checkpoint
    S-->>A: __interrupt__
    A-->>R: { requires_approval: true, itinerary, selected_agents, … }
    R->>R: phase = "awaiting_approval" · composer locks
    R-->>U: draft + execution plan + review panel

    U->>R: Approve (or Revise + feedback)
    R->>A: POST /api/travel/approve
    A->>S: Command(resume={ approved, feedback })
    S->>L: final_agent synthesis
    S->>P: checkpoint
    S-->>A: { final_response }
    A-->>R: { requires_approval: false, answer }
    R->>R: phase = "complete"
    R-->>U: final plan · copy · PDF export
```

---

## 🎨 Frontend Architecture

The front end is a **Vite + React 18 + TypeScript** SPA in `frontend/`, styled with Tailwind and
animated with Framer Motion. It is a rewrite of the original Jinja2 + vanilla-JS page, built to
mirror the graph's phases rather than just render its output.

```mermaid
flowchart TB
    M["main.tsx"] --> APP["App.tsx<br/><sub>phase orchestration · scroll focus · health probe</sub>"]

    APP --> BG["AuroraBackground<br/><sub>memoised, CSS-only</sub>"]
    APP --> TB["TopBar<br/><sub>theme toggle · API status · reset</sub>"]
    APP --> HERO["Hero"]
    APP --> PC["PlannerCard<br/><sub>autosizing composer · quick prompts</sub>"]
    APP --> EB["ErrorBanner"]
    APP --> SK["PlanSkeleton<br/><sub>staged progress</sub>"]
    APP --> WP["WorkflowPanel<br/><sub>guardrail badge · agent pipeline · graph path</sub>"]
    APP --> RP["ResultPanel<br/><sub>markdown · copy · PDF</sub>"]
    APP --> AP["ApprovalPanel<br/><sub>HITL · feedback presets</sub>"]
    APP --> FT["Footer"]

    RP --> MD["Markdown<br/><sub>react-markdown + remark-gfm</sub>"]

    APP -.-> H1["useTravelPlanner()<br/><sub>phase machine · thread persistence</sub>"]
    APP -.-> H2["useTheme()<br/><sub>dark/light, localStorage</sub>"]
    H1 -.-> API["lib/api.ts<br/><sub>typed fetch client</sub>"]
    API -.-> T["lib/types.ts<br/><sub>mirrors _serialize_result()</sub>"]
```

### The phase machine

`useTravelPlanner()` owns all planner state and exposes exactly one legal transition per phase —
which is what keeps impossible UI states unreachable:

```mermaid
stateDiagram-v2
    direction LR
    [*] --> idle
    idle --> planning : plan()
    planning --> awaiting_approval : requires_approval
    planning --> complete : final answer
    planning --> blocked : guardrail_allowed == false
    planning --> idle : error
    awaiting_approval --> finalising : decide(approved, feedback)
    finalising --> complete : final answer
    finalising --> awaiting_approval : error
    complete --> planning : plan()
    blocked --> planning : plan()
```

Consequences the user actually feels:

- The composer **locks** in `awaiting_approval` and explains why, so a second plan cannot be
  started on a thread the server has paused.
- **Revise** stays disabled until feedback is non-empty, mirroring the server's `400`.
- An `inFlight` ref plus a `phaseRef` guard prevents double submits and stale-closure races.
- Errors return the machine to a phase the user can act from — a failed approval lands back in
  `awaiting_approval`, not in `idle` with the draft orphaned.

### Notable implementation details

| Detail | Why |
| --- | --- |
| **Typed API contract** | `lib/types.ts` mirrors `backend._serialize_result()` field for field, so a backend rename becomes a compile error rather than a blank panel. |
| **Lazy PDF export** | `html2pdf.js` (~670 kB) is `import()`-ed only when Download is clicked, keeping it out of the initial bundle. |
| **Light-forced PDF** | The export toggles a `.pdf-light` class so the snapshot is readable on white paper even when the UI is dark. |
| **Memoised background** | `AuroraBackground` is CSS-animated and `memo`-wrapped, so re-renders during planning cost nothing. |
| **`prefers-reduced-motion`** | A global media query collapses every animation to ~0 ms. |
| **Honest progress** | The backend does not stream, so `PlanSkeleton` shows *named graph stages*, never a fake percentage. |
| **Health probe** | `GET /health` every 30 s drives the API online/offline pill. |
| **Accessible focus** | A visible `:focus-visible` ring, real `<label>`s, `role="alert"` on errors, and semantic `<ol>` for the pipeline. |

---

## 🎨 Design System

Every colour is a CSS custom property defined once on `:root` and swapped under `html.light`, so
the two themes are a token swap apart rather than two stylesheets.

```css
:root {                      /* dark — the default */
  --bg-base:  5 6 12;
  --text-hi:  244 246 255;
  --accent:   62 232 255;    /* cyan   */
  --accent-2: 139 92 246;    /* violet */
  --accent-3: 232 121 249;   /* magenta */
  --ok: 52 229 176;  --warn: 251 191 36;  --danger: 251 113 133;
}
html.light { --bg-base: 246 247 251; --text-hi: 12 16 32; --accent: 8 118 152; /* … */ }
```

Channel-triplet values (rather than `#hex`) let any token be used at any opacity —
`rgb(var(--accent) / 0.14)` — which is what makes the glass surfaces and coloured agent nodes
possible from a single palette.

| Layer | Treatment |
| --- | --- |
| **Backdrop** | Four drifting aurora blobs (26 s loop, staggered), a perspective grid, an SVG grain overlay, and a vignette — all CSS, no canvas, no JS per frame. |
| **Surfaces** | `.glass` / `.glass-strong` — `backdrop-filter: blur(22px) saturate(160%)`, hairline inset highlight, deep ambient shadow. |
| **Focus** | `.conic-border` — an animated conic-gradient ring driven by an `@property --angle` that activates when the composer is focused or busy. |
| **Typography** | Plus Jakarta Sans (UI), JetBrains Mono (ids, graph path, counters), with full system fallbacks. |
| **Motion** | Framer Motion for enter/exit and layout; one shared spring curve, `cubic-bezier(0.16, 1, 0.3, 1)`. |
| **Agent colours** | Each specialist owns an RGB triplet used for its icon, border, glow and connector — so the pipeline is readable at a glance without a legend. |

---

## 🛠 Tech Stack

<table>
<tr><th align="left">Layer</th><th align="left">Technology</th><th align="left">Role</th></tr>
<tr><td rowspan="3"><b>Orchestration</b></td><td>LangGraph <code>1.2.2</code></td><td>Stateful multi-agent graph, conditional edges, interrupts, checkpointing</td></tr>
<tr><td>LangChain <code>1.3.2</code> · <code>langchain-groq</code></td><td>Message abstractions, model bindings</td></tr>
<tr><td><code>langgraph-checkpoint-postgres</code> <code>3.1.0</code></td><td>Durable thread state</td></tr>
<tr><td><b>Model serving</b></td><td>Groq — <code>openai/gpt-oss-120b</code></td><td>Low-latency LPU inference</td></tr>
<tr><td rowspan="2"><b>Tool fabric</b></td><td><code>langchain-mcp-adapters</code> <code>0.3.0</code> · <code>mcp</code> <code>1.28.1</code></td><td>MultiServerMCPClient across stdio + streamable HTTP</td></tr>
<tr><td>FastMCP</td><td>The custom weather MCP server</td></tr>
<tr><td rowspan="2"><b>Service</b></td><td>FastAPI <code>0.136</code> + Uvicorn <code>0.48</code></td><td>Async HTTP API, ASGI server</td></tr>
<tr><td><code>nest_asyncio</code></td><td>Lets sync graph nodes call async MCP tools via <code>asyncio.run()</code></td></tr>
<tr><td rowspan="5"><b>Frontend</b></td><td>React <code>18</code> + TypeScript <code>5.6</code></td><td>Typed component layer</td></tr>
<tr><td>Vite <code>5</code></td><td>Dev server, HMR, production bundling</td></tr>
<tr><td>Tailwind CSS <code>3.4</code></td><td>Token-driven utility styling</td></tr>
<tr><td>Framer Motion <code>11</code></td><td>Enter/exit and layout animation</td></tr>
<tr><td><code>react-markdown</code> + <code>remark-gfm</code> · <code>lucide-react</code> · <code>html2pdf.js</code></td><td>Markdown/GFM rendering, icons, PDF export</td></tr>
<tr><td><b>Persistence</b></td><td>PostgreSQL + <code>psycopg 3</code></td><td>Checkpoint store</td></tr>
<tr><td rowspan="3"><b>External data</b></td><td>AviationStack (MCP)</td><td>Airport and airline reference data</td></tr>
<tr><td>Tavily <code>0.7</code> (MCP)</td><td>Real-time hotel and destination search</td></tr>
<tr><td>OpenWeather (custom MCP)</td><td>Current conditions + forecast</td></tr>
<tr><td><b>Observability</b></td><td>LangSmith (optional)</td><td>Trace-level debugging of graph runs</td></tr>
<tr><td><b>Packaging</b></td><td>Docker (<code>python:3.11-slim</code>)</td><td>Reproducible deployment</td></tr>
</table>

---

## 📁 Project Structure

```text
VoyaGen_AI/
├── app.py                         # FastAPI service: 2 endpoints, validation, error boundary
├── backend.py                     # LangGraph: state, guardrail, supervisor, 5 specialists,
│                                  #   HITL interrupt, final agent, routing, checkpointer
├── mcp_client.py                  # MultiServerMCPClient: tavily · aviationstack · weather
├── custom_weather_mcp_server.py   # FastMCP server wrapping OpenWeather
│
├── frontend/                      # ── React SPA ──────────────────────────────
│   ├── index.html                 # Shell: fonts, meta, #root
│   ├── vite.config.ts             # Dev proxy → 127.0.0.1:8000, @ alias, build config
│   ├── tailwind.config.js         # Palette, keyframes, shadows, motion tokens
│   ├── postcss.config.js
│   ├── tsconfig*.json
│   ├── package.json
│   └── src/
│       ├── main.tsx
│       ├── App.tsx                # Phase orchestration, scroll focus, health probe
│       ├── index.css              # Design tokens, glass/button/chip layers, markdown styles
│       ├── vite-env.d.ts          # html2pdf.js ambient types
│       ├── components/
│       │   ├── AuroraBackground.tsx   # Drifting mesh + grid + grain + vignette
│       │   ├── TopBar.tsx             # Brand, API status, theme toggle, reset
│       │   ├── Hero.tsx               # Headline + capability chips
│       │   ├── PlannerCard.tsx        # Autosizing composer, quick prompts, ⌘/Ctrl+Enter
│       │   ├── WorkflowPanel.tsx      # Guardrail badge, agent pipeline, graph path
│       │   ├── ResultPanel.tsx        # Draft/final plan, copy, lazy PDF export
│       │   ├── ApprovalPanel.tsx      # HITL review, feedback presets
│       │   ├── PlanSkeleton.tsx       # Staged progress placeholder
│       │   ├── Markdown.tsx           # react-markdown + remark-gfm
│       │   ├── ErrorBanner.tsx
│       │   └── Footer.tsx
│       ├── hooks/
│       │   ├── useTravelPlanner.ts    # Phase machine, thread persistence, API calls
│       │   └── useTheme.ts            # Dark/light, persisted
│       └── lib/
│           ├── api.ts                 # Typed fetch client for both endpoints
│           ├── types.ts               # Mirrors backend._serialize_result()
│           ├── agents.ts              # Agent metadata: label, icon, colour, blurb
│           └── utils.ts               # cn(), word/reading counts
│
├── templates/index.html           # Legacy Jinja2 shell (superseded by frontend/)
├── static/                        # Legacy CSS + JS (superseded by frontend/)
│
├── assets/
│   ├── architecture.png           # End-to-end architecture diagram
│   └── ui-*.png                   # Interface screenshots
│
├── Dockerfile
├── .dockerignore
├── requirements.txt
├── .env                           # git-ignored
├── LICENSE                        # MIT
└── README.md
```

> `templates/` and `static/` are the original vanilla front end. They are kept so `python app.py`
> still serves a working UI with no Node toolchain installed; `frontend/` is the maintained one.

---

## 🚀 Getting Started

### Prerequisites

| | Needed for |
| --- | --- |
| **Python 3.11+** | The FastAPI service and the LangGraph backend |
| **Node.js 18+** | The React front end (`frontend/`) |
| **PostgreSQL** | Checkpointing — any instance (local, Render, Neon, Supabase, RDS) |
| **[uv / uvx](https://docs.astral.sh/uv/)** | Spawning the AviationStack MCP server over stdio |
| **API keys** | Groq · AviationStack · Tavily · OpenWeather (all have free tiers) |

### 1 · Clone

```bash
git clone https://github.com/ayushYadav1107/VoyaGen-AI-.git
cd VoyaGen-AI-
```

### 2 · Python environment

```bash
# macOS / Linux
python3 -m venv .venv && source .venv/bin/activate

# Windows (PowerShell)
python -m venv .venv; .\.venv\Scripts\Activate.ps1

pip install --upgrade pip
pip install -r requirements.txt
```

### 3 · Verify `uvx`

The AviationStack MCP server is spawned as a subprocess, so `uvx` must be on `PATH`:

```bash
uvx --version
# not found? → https://docs.astral.sh/uv/getting-started/installation/
```

### 4 · Front-end dependencies

```bash
cd frontend
npm install
cd ..
```

### 5 · Environment variables

Create a `.env` in the project root — see [Configuration](#️-configuration).

### 6 · Smoke-test the MCP fabric

Before running the app, confirm all three servers connect. Each is tested independently, so one
failure does not mask the others:

```bash
python -c "import asyncio, mcp_client; asyncio.run(mcp_client.get_all_tools())"
# tavily: OK -> tavily_search, tavily_extract, …
# aviationstack: OK -> list_airports, list_airlines, …
# weather: OK -> get_current_weather, get_forecast
```

---

## ⚙️ Configuration

| Variable | Required | Default | Purpose |
| --- | :-: | --- | --- |
| `GROQ_API_KEY` | ✅ | — | Groq inference credential. The app **fails fast at import** if missing. |
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string. `sslmode=require` is appended automatically if absent. |
| `TAVILY_API_KEY` | ✅ | — | Hotel and destination search via the hosted Tavily MCP server. |
| `AVIATION_STACK_API_KEY` | ✅ | — | Flight reference data. `AVIATIONSTACK_API_KEY` is also accepted. |
| `OPENWEATHER_API_KEY` | ✅ | — | Current weather + forecast for the custom MCP server. |
| `LANGSMITH_TRACING` | ➖ | — | Set to `true` to enable tracing. |
| `LANGSMITH_ENDPOINT` | ➖ | — | LangSmith API endpoint. |
| `LANGSMITH_API_KEY` | ➖ | — | LangSmith credential. |
| `LANGSMITH_PROJECT` | ➖ | — | Trace project name. |
| `VITE_API_TARGET` | ➖ | `http://127.0.0.1:8000` | Dev-server proxy target for the front end. |

Example `.env`:

```dotenv
GROQ_API_KEY=gsk_...
DATABASE_URL=postgresql://user:pass@host:5432/voyagen
TAVILY_API_KEY=tvly-...
AVIATION_STACK_API_KEY=...
OPENWEATHER_API_KEY=...

# optional
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=lsv2_...
LANGSMITH_PROJECT=voyagen-ai
```

> **Get your keys:** [Groq Console](https://console.groq.com/keys) ·
> [AviationStack](https://aviationstack.com/) · [Tavily](https://app.tavily.com/) ·
> [OpenWeather](https://openweathermap.org/api) · [LangSmith](https://smith.langchain.com/)

> 🔒 `.env` is git-ignored. Never commit real credentials.

---

## ▶️ Running the Application

### Development — two processes

Run the API and the Vite dev server side by side. Vite proxies `/api` and `/health` to FastAPI,
so there is no CORS configuration to maintain.

```bash
# Terminal 1 — API on :8000
python app.py

# Terminal 2 — UI on :5173 with HMR
cd frontend && npm run dev
```

Open **<http://127.0.0.1:5173>**.

```mermaid
flowchart LR
    B["Browser<br/>:5173"] --> V["Vite dev server<br/>HMR · React Fast Refresh"]
    V -->|"/api/* · /health<br/>proxied"| F["FastAPI :8000"]
    F --> G["LangGraph + MCP"]
```

### Production — one process

Build the SPA and let FastAPI serve the static bundle:

```bash
cd frontend && npm run build     # → frontend/dist
cd .. && python app.py
```

Then mount `frontend/dist` in `app.py` (add below the existing `/static` mount):

```python
from fastapi.staticfiles import StaticFiles
from pathlib import Path

DIST = Path(__file__).resolve().parent / "frontend" / "dist"
if DIST.is_dir():
    app.mount("/", StaticFiles(directory=str(DIST), html=True), name="spa")
```

> Mount the SPA **last**. `StaticFiles(html=True)` at `/` is a catch-all, so any route declared
> after it will never be reached.

### Endpoints

| URL | What it gives you |
| --- | --- |
| `/` | The VoyaGen planner UI |
| `/docs` | Auto-generated Swagger UI |
| `/redoc` | ReDoc API reference |
| `/health` | JSON liveness probe (also drives the UI's status pill) |

### Front-end scripts

```bash
npm run dev         # Vite dev server with HMR
npm run build       # tsc --build && vite build → dist/
npm run typecheck   # types only, no emit
npm run preview     # serve the production build locally
```

---

## 🐳 Docker Deployment

```bash
docker build -t voyagen-ai .
docker run --rm -p 8000:8000 --env-file .env voyagen-ai
```

The image is based on `python:3.11-slim`, installs pinned dependencies, exposes port `8000`, and
starts Uvicorn bound to `0.0.0.0` — so it drops onto Render, Railway, Fly.io, Cloud Run, or ECS
with no changes. Supply the same variables from `.env` as platform secrets.

> **Two caveats for containerised deploys.** ① The AviationStack MCP server is spawned with
> `uvx`, so the image needs `uv` installed (`pip install uv`, or copy the binary in) for the
> flight agent to work. ② To ship the React build, add a Node stage:
>
> ```dockerfile
> FROM node:20-slim AS ui
> WORKDIR /ui
> COPY frontend/package*.json ./
> RUN npm ci
> COPY frontend/ ./
> RUN npm run build
>
> # …then in the Python stage:
> COPY --from=ui /ui/dist ./frontend/dist
> ```

---

## 📡 API Reference

Two endpoints: one starts a run, one resumes a paused one.

```mermaid
flowchart LR
    A["POST /api/travel"] -->|"requires_approval: true"| B["POST /api/travel/approve"]
    B -->|"approved: true"| C["final answer"]
    B -->|"approved: false + feedback"| C
    A -->|"requires_approval: false"| C
    A -->|"guardrail_allowed: false"| D["block reason"]
```

### `POST /api/travel`

Starts (or continues) a thread. Runs guardrail → supervisor → selected specialists → itinerary,
then pauses at the human-approval interrupt.

**Request**

```json
{
  "message": "Plan a complete 7 day Japan trip from India under 2 lakhs",
  "thread_id": "b1f0c9d2-4a77-4f31-9c2e-77aa10bb44de"
}
```

| Field | Type | Required | Notes |
| --- | --- | :-: | --- |
| `message` | `string` | ✅ | The natural-language travel request. Empty/whitespace-only → `400`. |
| `thread_id` | `string \| null` | ➖ | Omit to start a new thread; a UUID is generated and returned. |

**Response `200`**

```json
{
  "success": true,
  "thread_id": "b1f0c9d2-4a77-4f31-9c2e-77aa10bb44de",
  "answer": "## Trip Summary\n…",
  "requires_approval": true,
  "approval_request": "Please review the generated draft itinerary…",
  "itinerary": "## Trip Summary\n…",
  "flight_results": "Likely departure airport: DEL…",
  "hotel_results": "1. **Best Hotels in Tokyo** …",
  "weather_results": "Current Weather:\n{…}\n\nForecast:\n{…}",
  "budget_results": "Estimated cost categories…",
  "selected_agents": ["flight_agent", "hotel_agent", "weather_agent", "budget_agent", "itinerary_agent"],
  "trip_constraints": {
    "destination": "Japan", "origin": "India", "duration": "7 days",
    "budget": "2 lakhs", "travel_style": "", "special_preferences": ["sightseeing"]
  },
  "supervisor_reasoning": "The request names a destination, an origin, a duration and a hard budget ceiling…",
  "guardrail_allowed": true,
  "guardrail_reason": "",
  "approved": null,
  "human_feedback": "",
  "llm_calls": 6
}
```

| Field | Meaning |
| --- | --- |
| `answer` | The draft itinerary while `requires_approval` is `true`; the final plan afterwards. |
| `requires_approval` | `true` when the graph is paused at the HITL interrupt. |
| `selected_agents` / `supervisor_reasoning` | The supervisor's routing decision and its rationale. |
| `guardrail_allowed` / `guardrail_reason` | The guardrail verdict. When `false`, no specialist ran. |
| `flight_results` … `budget_results` | Raw per-agent artifacts, for debugging and per-agent inspection. |
| `llm_calls` | Cumulative model calls for the thread. |

Returning the intermediates — not just `answer` — is intentional: a poor final answer can be
attributed to bad retrieval versus bad synthesis without re-running anything.

### `POST /api/travel/approve`

Resumes a paused thread with the human's verdict.

**Request**

```json
{
  "thread_id": "b1f0c9d2-4a77-4f31-9c2e-77aa10bb44de",
  "approved": false,
  "feedback": "Reduce the hotel cost and leave Day 4 open."
}
```

| Field | Type | Required | Notes |
| --- | --- | :-: | --- |
| `thread_id` | `string` | ✅ | Must reference a thread paused at the interrupt. |
| `approved` | `boolean` | ✅ | `true` polishes the draft; `false` revises it against `feedback`. |
| `feedback` | `string` | ➖ | **Required when `approved` is `false`** — otherwise `400`. |

The response has the same shape as above, with `requires_approval: false`, `answer` holding the
final plan, and `approved` / `human_feedback` echoing the decision.

### `GET /health`

```json
{
  "status": "ok",
  "message": "TripMate AI API is running",
  "features": ["supervisor_agent", "input_guardrail", "human_in_the_loop"]
}
```

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `400` | `{ "success": false, "error": "Message cannot be empty." }` | Blank `message` |
| `400` | `{ "success": false, "error": "Please provide revision feedback when rejecting the draft." }` | `approved: false` with no `feedback` |
| `500` | `{ "success": false, "error": "<exception text>" }` | Upstream API, MCP, or database failure (logged with a full traceback server-side) |

### Quick cURL walkthrough

```bash
# 1 · start a plan — returns requires_approval: true
curl -s -X POST http://127.0.0.1:8000/api/travel \
  -H "Content-Type: application/json" \
  -d '{"message":"Plan a 5 day Thailand trip from India under 1 lakh"}' | jq

# 2 · resume it with feedback
curl -s -X POST http://127.0.0.1:8000/api/travel/approve \
  -H "Content-Type: application/json" \
  -d '{"thread_id":"<id from step 1>","approved":false,"feedback":"Add two beach days."}' | jq
```

---

## 🧭 Example Walkthrough

**Input**

> *"Plan a complete 7 days Japan trip from India including flights, hotels and sightseeing under 2 lakhs"*

| Step | Node | What happens |
| :-: | --- | --- |
| 1 | `supervisor` (guardrail) | Classifies the request as travel-domain → `{"allowed": true}`. **1 LLM call.** |
| 2 | `supervisor` (routing) | Extracts `destination: Japan`, `origin: India`, `duration: 7 days`, `budget: 2 lakhs`; selects all five specialists; writes a plain-English rationale. **2 LLM calls.** |
| 3 | `flight_agent` | Calls `list_airports` and `list_airlines` over the AviationStack MCP server, truncates each payload to 3 000 chars, and prompts the LLM for departure/arrival airports, carriers, duration, fare range, peak-season warning and booking advice. **3 LLM calls.** |
| 4 | `hotel_agent` | Issues `"Best hotels for <query>"` to the Tavily MCP server; live, cited results land in `hotel_results`. **4 LLM calls.** |
| 5 | `weather_agent` | `extract_destination()` reduces the sentence to `"Japan"`, then calls `get_current_weather` and `get_forecast` on the custom weather MCP server. |
| 6 | `budget_agent` | Reads flights, hotels, weather and the ₹2 L ceiling → cost categories, risk areas, savings levers, feasibility verdict. **5 LLM calls.** |
| 7 | `itinerary_agent` | Composes the day-by-day draft and sets `approval_request`. **6 LLM calls.** |
| 8 | `human_approval` | **⏸ `interrupt()`.** State is checkpointed to PostgreSQL; the API returns `requires_approval: true`; the UI renders the draft with a **DRAFT** badge and locks the composer. |
| 9 | *You* | *"Reduce the hotel cost and leave Day 4 open."* → `POST /api/travel/approve` with `approved: false`. |
| 10 | `final_agent` | Resumes with `Command(resume=…)`, applies the feedback, and emits the seven-section plan. **7 LLM calls.** |
| 11 | Checkpointer | Final state persisted under the thread ID; the client keeps it in `localStorage`. |

**Output** — markdown rendered in-browser with a trip summary, flight guidance, a cited hotel
shortlist, weather and packing advice, a day-by-day plan, an estimated budget table, and closing
recommendations. Copy to clipboard, or export a light-themed PDF.

---

## 🎯 Design Decisions & Trade-offs

<details>
<summary><b>Why a supervisor agent instead of running every specialist every time?</b></summary>

<br>

Running all five specialists on *"what's the weather in Bali?"* wastes four MCP round-trips and
four LLM calls, and pads the itinerary prompt with irrelevant context that measurably degrades
output quality. The supervisor costs one extra LLM call and pays for itself on any narrow request.

The trade-off is a new failure mode: the supervisor can under-select. That is mitigated three
ways — `itinerary_agent` is always forced in, unknown agent names are dropped rather than
trusted, and `supervisor_reasoning` is surfaced in the UI so a wrong routing decision is visible
to the user rather than buried.

</details>

<details>
<summary><b>Why a separate guardrail call instead of one combined prompt?</b></summary>

<br>

Combining classification and routing into one prompt would save a call, but it couples two
decisions with very different failure costs. A wrong routing decision produces a slightly worse
plan; a wrong guardrail decision means the system answers something it should not have. Keeping
them separate means the guardrail prompt stays short and single-purpose, and a blocked request
exits after exactly one call rather than paying for constraint extraction it will never use.

</details>

<details>
<summary><b>Why MCP instead of calling the APIs directly?</b></summary>

<br>

Direct SDK calls would be fewer moving parts. MCP buys three things that matter more here:

1. **A uniform tool interface** across a hosted HTTP service (Tavily), a third-party stdio server
   (AviationStack), and a local one you wrote (weather) — the agent code cannot tell them apart.
2. **Process isolation.** A crashing stdio server takes down its own subprocess, not the API.
3. **Portability.** The same three servers can be attached to Claude Desktop or any MCP client
   with no code changes.

The cost is real: stdio servers need `uvx` on `PATH`, subprocess spawning adds latency, and the
failure surface is larger. That is precisely why loading is per-server and every agent has an
explicit fallback string.

</details>

<details>
<summary><b>Why a real graph interrupt rather than a two-call "generate then refine" flow?</b></summary>

<br>

You could return the draft, then send a second independent request containing draft + feedback.
That works until you want the *original grounded artifacts* in the revision — flight results,
hotel citations, weather data. Re-sending them costs tokens; re-fetching them costs money and
time; trusting the model to remember them costs accuracy.

A checkpointed interrupt keeps the full `TravelState` alive across the pause, so `final_agent`
resumes with everything the specialists gathered, plus the human's verdict, and nothing has to be
re-derived. It also means the pause survives a server restart.

</details>

<details>
<summary><b>Why is the guardrail fail-open?</b></summary>

<br>

If the classifier returns malformed JSON or the API call fails, the request is allowed through.
For a travel planner, wrongly refusing a legitimate trip is a worse product failure than
wastefully planning an odd one, and there is no safety-critical downside to a false allow. A
system with a stricter threat model — anything handling payments, PII, or moderation — should
invert this default and fail closed.

</details>

<details>
<summary><b>Why are agent results formatted strings rather than structured JSON?</b></summary>

<br>

The immediate consumer is a language model, and pre-formatted labelled text is a cheap, reliable
way to keep the model from misreading nested JSON. The cost is that programmatic consumers must
re-parse it — which is why Pydantic models plus a rendering layer are on the roadmap: structured
for code, rendered for the prompt.

</details>

<details>
<summary><b>Why rewrite the front end in React?</b></summary>

<br>

The original vanilla page worked, but the v2 backend introduced *phases* — planning, awaiting
approval, finalising — and phase-dependent UI is exactly what imperative DOM manipulation handles
badly. A stray `classList.remove("hidden")` can leave an approve button live on a thread that is
no longer paused.

Modelling the client as an explicit state machine in `useTravelPlanner()` makes those states
unrepresentable, and TypeScript types mirroring `_serialize_result()` turn a backend field rename
into a compile error instead of a silently blank panel. The cost is a Node toolchain in the build
— which is why `templates/` and `static/` are kept so `python app.py` alone still serves a
working UI.

</details>

<details>
<summary><b>Why PostgreSQL rather than in-memory checkpointing?</b></summary>

<br>

`MemorySaver` loses every thread on restart and cannot be shared across replicas — which would
make the human-in-the-loop interrupt unusable, since the pause between draft and approval is
open-ended. A Postgres checkpointer means threads survive redeploys, multiple Uvicorn workers see
the same state, and past runs can be inspected after the fact.

</details>

---

## ⚠️ Known Limitations

Stated plainly, because knowing where a system is weak is part of building it:

- **No ticket pricing.** AviationStack exposes reference and status data, not fares. The flight
  agent produces *estimated* ranges and the final prompt is instructed to label them as such — a
  pricing provider such as Amadeus would close this gap.
- **No date-aware flight filtering.** Requests resolve to a route, not to a departure date, so
  results reflect current reference data rather than the traveller's intended window.
- **Budget is advisory.** The ceiling is reasoned about by the budget agent but not enforced by a
  hard constraint or optimisation step.
- **Sequential specialists.** Flight, hotel and weather are independent but run one after another,
  so end-to-end latency is roughly the sum rather than the max.
- **Duplicate checkpointer initialisation.** `backend.py` currently builds `PostgresSaver` and
  compiles the graph twice at import; the second assignment wins, but the first connection leaks.
- **Single blocking DB connection.** One `psycopg` connection is opened at import time; a pool
  (`psycopg_pool`, already in `requirements.txt`) is the right shape under concurrency.
- **No streaming.** The API returns one response per phase, so the UI shows named graph stages
  rather than token-level progress.
- **`uvx` is a hard dependency** for the flight agent — including inside Docker, where it is not
  installed by default.
- **No automated test suite.** MCP connectivity has a smoke test; the graph does not.

---

## 🗺 Roadmap

- [ ] **Parallel fan-out/fan-in** — run flight, hotel and weather concurrently, join before budget
- [ ] **Streaming** via `graph.astream()` + SSE, so the UI can replace staged progress with live token output
- [ ] **Amadeus integration** for real fare pricing and bookable offers
- [ ] **Date extraction** so flight and weather lookups target the actual travel window
- [ ] **A visa/documents agent** conditionally routed for international itineraries
- [ ] **Structured tool outputs** with Pydantic models plus a rendering layer for prompts
- [ ] **Connection pooling** with `psycopg_pool` and the async Postgres checkpointer
- [ ] **Fix the duplicate checkpointer block** in `backend.py`
- [ ] **Evaluation harness** — a golden set scored on groundedness, section completeness, budget adherence, and routing precision/recall
- [ ] **Test suite** — `pytest` for the supervisor JSON contract, mocked MCP tool tests, and graph-level integration tests including the interrupt/resume cycle
- [ ] **Multi-turn threads** — follow-up questions against a finalised plan on the same `thread_id`

---

## 🤝 Contributing

Contributions are welcome.

1. Fork the repository
2. Create a feature branch — `git checkout -b feature/amadeus-pricing`
3. Commit your changes — `git commit -m "Add Amadeus fare pricing MCP server"`
4. Push the branch — `git push origin feature/amadeus-pricing`
5. Open a pull request describing the change and how you verified it

**If you are adding a tool**, prefer an MCP server over an inline API call, register it in
`mcp_client.py`, and give it a key check in `_get_server_tool()` so a missing credential produces
a readable setup error rather than a stack trace.

**If you are adding an agent**, you need four things: the node function, an entry in
`KNOWN_AGENTS` and `AGENT_ORDER`, a `ROUTE_MAP` entry with its conditional edge, and one line in
the supervisor prompt describing when to select it.

**If you are touching the front end**, run `npm run typecheck` before opening the PR, and keep
`src/lib/types.ts` in sync with `backend._serialize_result()`.

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for the full text.

---

## 🙏 Acknowledgements

- [LangGraph](https://langchain-ai.github.io/langgraph/) — stateful multi-agent orchestration, conditional edges, interrupts
- [Model Context Protocol](https://modelcontextprotocol.io/) — the tool-server standard the whole fabric is built on
- [Groq](https://groq.com/) — low-latency LPU inference
- [Tavily](https://tavily.com/) — search API purpose-built for LLM grounding
- [AviationStack](https://aviationstack.com/) — global flight and airline data
- [OpenWeather](https://openweathermap.org/) — current conditions and forecasts
- [FastAPI](https://fastapi.tiangolo.com/) — the ASGI framework running the service
- [React](https://react.dev/), [Vite](https://vitejs.dev/), [Tailwind CSS](https://tailwindcss.com/), [Framer Motion](https://www.framer.com/motion/) — the front-end stack

---

<div align="center">

**Built by [Ayush Yadav](https://github.com/ayushYadav1107)**

<sub>If this project is useful to you, a ⭐ is appreciated.</sub>

</div>
