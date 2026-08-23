[← README](../README.md) &nbsp;·&nbsp; [Getting Started](getting-started.md) &nbsp;·&nbsp; [Architecture](architecture.md) &nbsp;·&nbsp; [The Agent Layers](agents.md) &nbsp;·&nbsp; [The MCP Tool Fabric](mcp.md) &nbsp;·&nbsp; [Frontend](frontend.md) &nbsp;·&nbsp; [API Reference](api.md) &nbsp;·&nbsp; **Design Notes**

---

# Design Notes

*Why the system is built this way, where it is weak, and what comes next.*

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
<summary><b>Why budget prompts by character count instead of counting tokens properly?</b></summary>

<br>

Counting exactly would mean shipping a tokenizer for whichever model `GROQ_MODEL` points
at, keeping it in sync with the provider, and paying that cost on every node. The budget
only has to be *safe*, not exact — so `CHARS_PER_TOKEN` is set to 3 rather than the ~4 that
plain English actually averages, because most of what fills these prompts is JSON and
tabular tool output, which tokenises denser. Guessing high costs a slightly shorter prompt.
Guessing low costs a rejected request and a failed run, which is far worse.

The same reasoning drives the safety margin (`GROQ_TPM_UTILISATION`, 90% by default) and the
decision to reserve each node's `COMPLETION_TOKENS` entry up front: the allowance covers
prompt *and* reply combined, so a budget that ignores the reply is not a budget.

</details>

<details>
<summary><b>Why does <code>final_agent</code> no longer receive the full artifacts?</b></summary>

<br>

It used to receive the query, the constraints, and the flight, hotel, weather and budget
artifacts at full length — *plus* the complete draft itinerary. That is close to sending the
same information twice, since the draft is a synthesis of exactly those artifacts, and it
was enough to push one request past an entire per-minute token allowance.

The draft is now weighted as the primary source at roughly 55–60% of the prompt, with the
artifacts passed as trimmed notes for fact-checking. The final pass is a polish-and-format
step over an already-reasoned document, not a second synthesis from raw retrieval, so the
notes only need to be long enough to catch a contradiction.

</details>

<details>
<summary><b>Why continue a truncated answer instead of just raising the token cap?</b></summary>

<br>

Because the cap and the prompt budget are the same number. Groq screens a request as
`prompt_tokens + max_tokens` against the per-minute ceiling, so every token handed to the
reply is taken from the context. Raising `final_agent`'s cap to fit a seven-day itinerary
would starve it of the draft it is meant to be polishing — trading a truncated answer for a
worse-informed one.

Continuing costs far less. The resume prompt carries about a kilobyte of the model's own tail
instead of the entire original context, so a second round is a fraction of the first call.
That makes output length effectively independent of the TPM ceiling, which is the property
actually wanted: the ceiling should limit how much *context* a node can consider, not how many
days a trip can have.

The trailing partial line is discarded before resuming. A cut-off completion almost always
ends mid-sentence or mid-table-row, and asking a model to continue mid-word produces worse
seams than asking it to rewrite one clean line.

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
- **No streaming.** The API returns one response per phase, so the UI shows named graph stages
  rather than token-level progress.
- **Free-tier token limits are the real ceiling.** A full run makes six or more model calls in
  under a minute. Prompts are budgeted and rate limits are retried with backoff, but on an
  8,000 TPM allowance a complex trip can still spend time waiting for the window to roll over.
  See [Token budgeting](getting-started.md#-token-budgeting).
- **Long artifacts are truncated, not summarised.** `MAX_ARTIFACT_CHARS` cuts on a line
  boundary and appends a marker. A summarisation pass would preserve more signal per token,
  at the cost of another model call per agent.
- **Continuation seams are not verified.** The model is instructed not to repeat itself when
  resuming, but nothing checks the join. A duplicated heading is possible on an unlucky
  continuation, and a deterministic overlap check would catch it.
- **`uvx` is a hard dependency** for the flight agent. It is installed in the Docker image, but a
  bare-metal deploy needs `uv` on `PATH` or the flight agent degrades to its fallback message.
- **Guardrail fails open.** A malformed classifier response allows the request through. That is a
  deliberate product choice, documented in [Design Decisions](#-design-decisions--trade-offs), not
  an oversight — but it is the right thing to change first under a stricter threat model.
- **No automated test suite.** MCP connectivity has a smoke test; the graph does not.

---

## 🗺 Roadmap

- [ ] **Parallel fan-out/fan-in** — run flight, hotel and weather concurrently, join before budget
- [ ] **Streaming** via `graph.astream()` + SSE, so the UI can replace staged progress with live token output
- [ ] **Amadeus integration** for real fare pricing and bookable offers
- [ ] **Date extraction** so flight and weather lookups target the actual travel window
- [ ] **A visa/documents agent** conditionally routed for international itineraries
- [ ] **Structured tool outputs** with Pydantic models plus a rendering layer for prompts
- [ ] **Async checkpointing** with `AsyncPostgresSaver` to match the async request path
- [ ] **Summarise instead of truncate** when an artifact exceeds its budget, so trimmed
      retrieval loses signal rather than just tail bytes
- [ ] **Token accounting from the provider response** (`usage.prompt_tokens`) to replace the
      character estimate with measured values
- [ ] **Overlap detection on continuation joins**, so a repeated line at the seam is removed
      rather than trusted away by the prompt
- [ ] **Evaluation harness** — a golden set scored on groundedness, section completeness, budget adherence, and routing precision/recall
- [ ] **Test suite** — `pytest` for the supervisor JSON contract, mocked MCP tool tests, and graph-level integration tests including the interrupt/resume cycle
- [ ] **Multi-turn threads** — follow-up questions against a finalised plan on the same `thread_id`

---

<div align="center">

← [API Reference](api.md) &nbsp;•&nbsp; [README](../README.md) →

</div>
