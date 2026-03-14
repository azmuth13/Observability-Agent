"""FastAPI entrypoint for the AI Observability Agent."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.routes import router
from backend.config import get_settings


def create_app() -> FastAPI:
    """Build the FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description="Agentic observability assistant with RAG, tools, and MCP.",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.app_origin, "http://127.0.0.1:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(router, prefix="/api")
    return app


app = create_app()
