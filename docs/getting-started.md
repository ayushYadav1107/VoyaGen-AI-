[← README](../README.md) &nbsp;·&nbsp; **Getting Started** &nbsp;·&nbsp; [Architecture](architecture.md) &nbsp;·&nbsp; [The Agent Layers](agents.md) &nbsp;·&nbsp; [The MCP Tool Fabric](mcp.md) &nbsp;·&nbsp; [Frontend](frontend.md) &nbsp;·&nbsp; [API Reference](api.md) &nbsp;·&nbsp; [Design Notes](design-notes.md)

---

# Getting Started

*Install, configure, run, and deploy VoyaGen AI.*

## 📁 Project Structure

```text
VoyaGen_AI/
├── app.py                         # FastAPI service: 2 endpoints, SPA serving, lifespan,
│                                  #   validation, error boundary
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
│   ├── dist/                      # production build (git-ignored) — served by app.py at /
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
| `DB_POOL_MAX_SIZE` | ➖ | `10` | Upper bound on the PostgreSQL connection pool. |
| `GROQ_MODEL` | ➖ | `openai/gpt-oss-120b` | Any model ID Groq serves. Free-tier token limits differ per model. |
| `GROQ_TPM_LIMIT` | ➖ | `8000` | **Your account's tokens-per-minute allowance.** Every prompt is budgeted against it — see [Token budgeting](#-token-budgeting). |
| `ITINERARY_COMPLETION_TOKENS` | ➖ | `2500` | Reply budget for the draft itinerary. |
| `FINAL_COMPLETION_TOKENS` | ➖ | `2500` | Reply budget for the final plan. |
| `GROQ_TPM_UTILISATION` | ➖ | `0.90` | Fraction of the TPM allowance a single request may plan to use. |
| `MAX_CONTINUATIONS` | ➖ | `3` | Extra rounds allowed to finish a reply that hit its length cap. |
| `GROQ_MAX_RETRIES` | ➖ | `4` | Attempts before a rate-limited step gives up. |
| `MAX_ARTIFACT_CHARS` | ➖ | `6000` | Longest per-agent result kept in `TravelState`. |
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
# optional — raise these together if you are on a paid Groq plan
# GROQ_TPM_LIMIT=30000
# ITINERARY_COMPLETION_TOKENS=4000
# FINAL_COMPLETION_TOKENS=4000

LANGSMITH_TRACING=true
LANGSMITH_API_KEY=lsv2_...
LANGSMITH_PROJECT=voyagen-ai
```

> **Get your keys:** [Groq Console](https://console.groq.com/keys) ·
> [AviationStack](https://aviationstack.com/) · [Tavily](https://app.tavily.com/) ·
> [OpenWeather](https://openweathermap.org/api) · [LangSmith](https://smith.langchain.com/)

> 🔒 `.env` is git-ignored. Never commit real credentials.

---

## 🎛 Token Budgeting

Groq charges prompt **and** completion tokens against a single tokens-per-minute
allowance. The free tier's 8,000 TPM for `openai/gpt-oss-120b` is smaller than a naive
"paste every artifact into the prompt" request, and when a single request exceeds the
whole allowance the API rejects it outright rather than queueing it:

```
Error code: 413 — Request too large … on tokens per minute (TPM):
Limit 8000, Requested 11269, please reduce your message size
```

So `backend.py` budgets every prompt instead of hoping it fits.

Groq screens a request as `prompt_tokens + max_tokens` against the ceiling, so the
reply reservation and the prompt budget are two halves of one number:

```mermaid
flowchart LR
    A["GROQ_TPM_LIMIT<br/>8,000"] --> B["× GROQ_TPM_UTILISATION<br/>0.90"]
    B --> C["− this node's reply budget<br/>COMPLETION_TOKENS[label]"]
    C --> D["× CHARS_PER_TOKEN 3<br/>× 0.85 safety margin"]
    D --> E["character budget<br/>for this prompt"]
    E --> F["_fit_sections()<br/>shares it by weight"]
```

Reply budgets are **per node**, because one global cap either truncates the itinerary or
wastes thousands of tokens on the nodes that answer in strict JSON:

| Node | Reply budget | Why |
| --- | --: | --- |
| `guardrail` | 400 | Returns `{allowed, reason}` and nothing else |
| `supervisor` | 800 | JSON plus a sentence of reasoning |
| `flight_agent` · `hotel_agent` · `weather_agent` | 1,200 | A short section each |
| `budget_agent` | 1,500 | Four short analyses |
| `itinerary_agent` | 2,500 | Writes the full draft |
| `final_agent` | 2,500 | Writes the full seven-section plan |

Two rules do the work:

1. **Artifacts are capped when they are written**, not when they are read.
   `MAX_ARTIFACT_CHARS` bounds what each agent stores in `TravelState`, so a 120 KB raw
   Tavily payload never reaches a prompt *or* a checkpoint.
2. **`_fit_sections()` shares the remaining budget by weight**, and hands any allowance a
   short section does not use back to the sections that are over their share. A two-line
   weather payload therefore costs the draft itinerary nothing.

The `final_agent` prompt is where this matters most. It used to re-send the query,
constraints, flight, hotel, weather and budget artifacts *plus* the full draft — largely
redundant, because the draft is already a synthesis of exactly those artifacts. It now
weights the draft as the primary source at roughly 55–60% of the prompt and passes the
rest as trimmed fact-checking notes.

> **On a paid plan**, raise `GROQ_TPM_LIMIT` to your real allowance. Every prompt in the
> graph widens automatically — there is no other number to change.

### Long answers finish across calls

A seven-day itinerary with hourly tables can outrun even a 2,500-token reply budget. Raising
the cap is not the fix — every token added to the reply is a token taken from the prompt, so a
bigger cap would starve the draft of the context it is supposed to be polishing.

Instead the writing nodes **resume from their own output**. When Groq reports
`finish_reason: "length"`, the trailing partial line is discarded and the model is asked to
continue from the tail of what it has already written:

```mermaid
flowchart LR
    A["first call<br/>prompt + reply budget"] --> B{"finish_reason<br/>== length?"}
    B -->|"no"| DONE["return"]
    B -->|"yes"| C["drop the partial<br/>trailing line"]
    C --> D["resend only the last<br/>CONTINUATION_TAIL_CHARS"]
    D --> E["model continues"]
    E --> B
```

The continuation prompt carries roughly a kilobyte of tail instead of the entire original
context, so each extra round costs a fraction of the first call. After `MAX_CONTINUATIONS`
rounds the node returns what it has rather than looping forever.

### When the limit is hit anyway

A full run makes six or more model calls in well under a minute, so *cumulative* usage can
exhaust the allowance even when every individual request fits. Those calls are retried with
backoff, preferring the delay Groq itself suggests:

| Failure | Behaviour |
| --- | --- |
| `429` / rate limit reached | Retried up to `GROQ_MAX_RETRIES` times, honouring `try again in Ns` |
| `413` / request too large | **Not** retried — waiting cannot shrink a request. Raised with the env var to change |
| `401` / bad key | Raised immediately, no retries burned |

### Choosing a model

Groq's free tier gives `openai/gpt-oss-120b` **30 RPM / 8K TPM / 200K tokens per day** — and
`openai/gpt-oss-20b` has the *same* 8K TPM, so dropping to the smaller model buys no headroom.
Limits are set per organisation and Groq notes there are exceptions, so check
[your own limits page](https://console.groq.com/settings/limits) rather than trusting a table.

In order of value:

1. **Set `GROQ_TPM_LIMIT` to your real allowance.** Every prompt in the graph widens
   automatically; there is no other number to change.
2. **Raise the reply budgets** (`ITINERARY_COMPLETION_TOKENS`, `FINAL_COMPLETION_TOKENS`) once
   the TPM ceiling can afford them — fewer continuation rounds, faster runs.
3. **Move to a paid tier** if you are planning trips regularly. The 200K tokens-per-day cap
   works out to roughly 25 full runs, which a day of iterating will exhaust before the
   per-minute limit does.

Changing `GROQ_MODEL` is worth it only if the target model actually has a higher TPM on your
plan — verify on the limits page first.

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

`app.py` serves the React build automatically when it exists. Build it, then start the API:

```bash
cd frontend && npm run build     # → frontend/dist
cd .. && python app.py
```

That is the whole step — no code change and no second server. The wiring is:

| Path | Served from |
| --- | --- |
| `/` | `frontend/dist/index.html` when built, else the legacy `templates/index.html` |
| `/assets/*` | `frontend/dist/assets/` — Vite's hashed bundles |
| `/static/*` | The legacy CSS/JS, still mounted |
| `/api/*`, `/health`, `/docs`, `/redoc` | Unchanged |

`GET /health` reports which UI is live, so a deploy that forgot to build is obvious:

```json
{ "status": "ok", "frontend": "react" }     // or "legacy_template"
```

> The SPA is served by an explicit `/` route rather than a `StaticFiles(html=True)` catch-all
> mounted at `/`. A catch-all would shadow `/docs` and `/redoc`; this app has no client-side
> router, so it does not need one.

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

The build is two stages, so one `docker build` produces a container with both the API and the
compiled UI in it:

```mermaid
flowchart LR
    subgraph S1["Stage 1 · node:20-slim"]
        A["COPY package*.json"] --> B["npm ci"] --> C["COPY frontend/"] --> D["npm run build<br/>→ /ui/dist"]
    end
    subgraph S2["Stage 2 · python:3.11-slim"]
        E["pip install -r requirements.txt"] --> F["pip install uv<br/><sub>uvx for the stdio MCP server</sub>"]
        F --> G["COPY . ."] --> H["COPY --from=ui /ui/dist<br/>→ ./frontend/dist"]
    end
    D -.->|"dist/"| H
    H --> I["uvicorn app:app :8000"]
```

Three things the Dockerfile does that are easy to miss:

| | Why it matters |
| --- | --- |
| **`pip install uv` in the runtime stage** | The AviationStack MCP server is spawned over stdio with `uvx`. Without `uv` on `PATH`, the flight agent silently degrades to its fallback message on every request. The build verifies it with `uvx --version`. |
| **Manifests copied before `npm ci`** | Keeps the dependency layer cached until `package-lock.json` actually changes, so UI source edits do not re-download `node_modules`. |
| **`uvx aviationstack-mcp --help` cache warm** | Pre-resolves the MCP server at build time so the first flight request does not pay for it. Deliberately non-fatal — it resolves lazily at runtime if the build has no network. |

A `HEALTHCHECK` polls `/health`, so orchestrators see the container as unhealthy rather than
merely running when the app has failed to come up. The image drops onto Render, Railway, Fly.io,
Cloud Run, or ECS with no changes — supply the variables from `.env` as platform secrets.

> `.dockerignore` excludes `.env`, so credentials are never baked into an image layer. Pass them
> at run time with `--env-file` or platform secrets, as above.

---

<div align="center">

← [README](../README.md) &nbsp;•&nbsp; [Architecture](architecture.md) →

</div>
