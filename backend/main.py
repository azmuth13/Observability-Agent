"""FastAPI entrypoint for the AI Observability Agent."""

import logging
from time import perf_counter
from uuid import uuid4

from fastapi import FastAPI
from fastapi import Request
from fastapi.middleware.cors import CORSMiddleware

from backend.api.routes import router
from backend.config import get_settings
from backend.observability import configure_logging


logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    """Build the FastAPI application."""
    settings = get_settings()
    configure_logging()

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

    @app.middleware("http")
    async def add_request_context(request: Request, call_next):
        request_id = request.headers.get("x-request-id", str(uuid4()))
        request.state.request_id = request_id
        started_at = perf_counter()

        response = await call_next(request)

        duration_ms = round((perf_counter() - started_at) * 1000, 2)
        response.headers["X-Request-ID"] = request_id
        logger.info(
            "http request completed",
            extra={
                "request_id": request_id,
                "path": str(request.url.path),
                "method": request.method,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
            },
        )
        return response

    return app


app = create_app()
