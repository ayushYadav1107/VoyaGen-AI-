# syntax=docker/dockerfile:1

# ============================================================
# Stage 1 — build the React front end
# ============================================================
FROM node:20-slim AS ui

WORKDIR /ui

# Copy manifests first so `npm ci` is cached until dependencies change.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build          # → /ui/dist


# ============================================================
# Stage 2 — Python runtime
# ============================================================
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# The AviationStack MCP server is spawned over stdio with `uvx`, so the flight
# agent is dead in the water without uv on PATH. Installed via pip so it lands
# in the same environment the app runs in.
RUN pip install --no-cache-dir uv && uvx --version

# Warm the uvx cache so the first flight request does not pay for resolving and
# downloading the MCP server. Deliberately non-fatal: if the package or the
# network is unavailable at build time, uvx resolves it lazily at runtime.
RUN uvx aviationstack-mcp --help >/dev/null 2>&1 \
    || echo "aviationstack-mcp not pre-cached; will resolve on first use"

COPY . .

# Built SPA from stage 1. app.py serves this at / when present and falls back
# to the legacy Jinja2 template when it is not.
COPY --from=ui /ui/dist ./frontend/dist

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/health || exit 1

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
