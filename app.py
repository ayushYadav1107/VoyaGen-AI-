from contextlib import asynccontextmanager
from pathlib import Path
import traceback

import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field

from backend import close_checkpointer, run_travel_agent, resume_travel_agent


import nest_asyncio

nest_asyncio.apply()

BASE_DIR = Path(__file__).resolve().parent

# Production build of the React front end (frontend/). Absent until
# `cd frontend && npm run build` has been run, in which case the legacy
# Jinja2 template in templates/ is served instead.
FRONTEND_DIST = BASE_DIR / "frontend" / "dist"
SPA_INDEX = FRONTEND_DIST / "index.html"
SPA_ASSETS = FRONTEND_DIST / "assets"


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield
    # Release the PostgreSQL connection pool on shutdown.
    close_checkpointer()


app = FastAPI(
    lifespan=lifespan,
    title="VoyaGen AI",
    description=(
        "LangGraph Multi-Agent Travel Planner with Supervisor, Guardrails, "
        "Human-in-the-Loop, and FastAPI Frontend"
    ),
    version="2.0.0",
)

app.mount(
    "/static",
    StaticFiles(directory=str(BASE_DIR / "static")),
    name="static",
)

# Vite emits hashed bundles under dist/assets/. Mounted at the same path the
# built index.html references, so no rewriting is needed.
if SPA_ASSETS.is_dir():
    app.mount(
        "/assets",
        StaticFiles(directory=str(SPA_ASSETS)),
        name="spa-assets",
    )

templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))


class TravelRequest(BaseModel):
    message: str
    thread_id: str | None = None


class ApprovalRequest(BaseModel):
    thread_id: str = Field(min_length=1)
    approved: bool
    feedback: str = ""


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    """Serve the React build when present, otherwise the legacy Jinja2 page."""
    if SPA_INDEX.is_file():
        return FileResponse(SPA_INDEX)

    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={},
    )


@app.post("/api/travel")
async def travel_planner(request_data: TravelRequest):
    try:
        user_message = request_data.message.strip()

        if not user_message:
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "error": "Message cannot be empty.",
                },
            )

        result = run_travel_agent(
            user_input=user_message,
            thread_id=request_data.thread_id,
        )

        return JSONResponse(
            content={
                "success": True,
                **result,
            }
        )

    except Exception as exc:
        print("ERROR:", exc)
        traceback.print_exc()

        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": str(exc),
            },
        )


@app.post("/api/travel/approve")
async def approve_travel_plan(request_data: ApprovalRequest):
    try:
        if not request_data.approved and not request_data.feedback.strip():
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "error": "Please provide revision feedback when rejecting the draft.",
                },
            )

        result = resume_travel_agent(
            thread_id=request_data.thread_id,
            approved=request_data.approved,
            feedback=request_data.feedback,
        )

        return JSONResponse(
            content={
                "success": True,
                **result,
            }
        )

    except Exception as exc:
        print("APPROVAL ERROR:", exc)
        traceback.print_exc()

        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": str(exc),
            },
        )


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "message": "VoyaGen AI API is running",
        "features": [
            "supervisor_agent",
            "input_guardrail",
            "mcp_tool_fabric",
            "human_in_the_loop",
        ],
        "frontend": "react" if SPA_INDEX.is_file() else "legacy_template",
    }


@app.get("/favicon.ico")
async def favicon():
    return JSONResponse(content={})


if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
    )