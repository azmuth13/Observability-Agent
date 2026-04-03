"""FastAPI route definitions."""

from __future__ import annotations

import logging
from time import perf_counter
from uuid import uuid4

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from backend.agent.graph import run_agent
from backend.config import get_settings


router = APIRouter(tags=["agent"])
logger = logging.getLogger(__name__)


def _classify_agent_error(exc: Exception, provider: str, model: str) -> tuple[str, str]:
    """Turn provider/network failures into user-friendly responses."""
    message = str(exc).strip()
    lowered = message.lower()

    connectivity_markers = (
        "connection error",
        "connecterror",
        "connect timeout",
        "timed out",
        "timeout",
        "temporary failure in name resolution",
        "name or service not known",
        "nodename nor servname provided",
        "network is unreachable",
        "connection refused",
        "failed to establish a new connection",
        "dns",
    )
    auth_markers = (
        "401",
        "403",
        "unauthorized",
        "forbidden",
        "invalid api key",
        "api key not valid",
        "permission denied",
        "authentication",
    )
    quota_markers = ("429", "quota", "rate limit", "resource exhausted")

    if any(marker in lowered for marker in connectivity_markers):
        return (
            (
                f"The agent could not reach the {provider.title()} model `{model}`. "
                "This usually means there is no internet connection, DNS resolution failed, "
                "or the provider endpoint is temporarily unavailable. Please check network "
                "connectivity and retry."
            ),
            "llm_connection_failed",
        )

    if any(marker in lowered for marker in auth_markers):
        return (
            (
                f"The agent could not authenticate with the {provider.title()} model `{model}`. "
                "Please verify the API key and provider configuration in your environment."
            ),
            "llm_auth_failed",
        )

    if any(marker in lowered for marker in quota_markers):
        return (
            (
                f"The {provider.title()} model `{model}` rejected the request because of quota "
                "or rate limiting. Please wait and retry, or check your provider usage limits."
            ),
            "llm_quota_failed",
        )

    return (
        (
            f"The agent was unable to complete the request with the {provider.title()} model "
            f"`{model}`. Please retry, and check backend logs if the problem continues."
        ),
        "agent_execution_failed",
    )


class ChatRequest(BaseModel):
    query: str


class ChatResponse(BaseModel):
    answer: str
    intent: str | None = None
    retrieved_context: str | None = None
    tool_context: str | None = None
    request_id: str | None = None
    tools_used: list[str] = Field(default_factory=list)
    retrieval_source: str | None = None
    retrieval_hit: bool = False
    evidence_found: bool = False
    llm_enabled: bool = False
    llm_provider: str | None = None
    llm_model: str | None = None
    latency_ms: float | None = None
    stage_latencies_ms: dict[str, float] = Field(default_factory=dict)
    error: str | None = None


class DebugStatusResponse(BaseModel):
    app_name: str
    app_env: str
    mock_mode: bool
    use_pinecone: bool
    enable_mcp: bool
    llm_provider: str
    llm_model: str
    docs_path_exists: bool
    sample_logs_path_exists: bool
    pinecone_configured: bool
    groq_configured: bool
    google_configured: bool
    langchain_tracing_enabled: bool


@router.get("/health")
def healthcheck() -> dict[str, str]:
    settings = get_settings()
    return {"status": "ok", "app": settings.app_name}


@router.get("/debug/status", response_model=DebugStatusResponse)
def debug_status() -> DebugStatusResponse:
    settings = get_settings()
    provider = settings.llm_provider.lower()
    active_model = settings.google_model if provider == "google" else settings.groq_model
    return DebugStatusResponse(
        app_name=settings.app_name,
        app_env=settings.app_env,
        mock_mode=settings.mock_mode,
        use_pinecone=settings.use_pinecone,
        enable_mcp=settings.enable_mcp,
        llm_provider=provider,
        llm_model=active_model,
        docs_path_exists=settings.docs_path.exists(),
        sample_logs_path_exists=settings.sample_logs_path.exists(),
        pinecone_configured=bool(settings.pinecone_api_key),
        groq_configured=bool(settings.groq_api_key),
        google_configured=bool(settings.google_api_key),
        langchain_tracing_enabled=settings.langchain_tracing_v2,
    )


@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest, request: Request) -> ChatResponse:
    settings = get_settings()
    provider = settings.llm_provider.lower()
    active_model = settings.google_model if provider == "google" else settings.groq_model
    request_id = getattr(request.state, "request_id", str(uuid4()))
    started_at = perf_counter()

    try:
        result = run_agent(payload.query)
    except Exception as exc:  # pragma: no cover - exercised via route tests
        duration_ms = round((perf_counter() - started_at) * 1000, 2)
        answer, error_code = _classify_agent_error(exc, provider, active_model)
        logger.exception(
            "chat request failed",
            extra={
                "request_id": request_id,
                "path": str(request.url.path),
                "method": request.method,
                "duration_ms": duration_ms,
                "error": str(exc),
            },
        )
        return ChatResponse(
            answer=answer,
            request_id=request_id,
            llm_provider=provider,
            llm_model=active_model,
            latency_ms=duration_ms,
            error=error_code,
        )

    duration_ms = round((perf_counter() - started_at) * 1000, 2)
    response = ChatResponse(
        answer=result.get("answer", ""),
        intent=result.get("intent"),
        retrieved_context=result.get("retrieved_context"),
        tool_context=result.get("tool_context"),
        request_id=request_id,
        tools_used=result.get("tools_used", []),
        retrieval_source=result.get("retrieval_source"),
        retrieval_hit=result.get("retrieval_hit", False),
        evidence_found=result.get("evidence_found", False),
        llm_enabled=result.get("llm_enabled", False),
        llm_provider=provider,
        llm_model=active_model,
        latency_ms=result.get("total_latency_ms", duration_ms),
        stage_latencies_ms=result.get("stage_latencies_ms", {}),
        error=result.get("error"),
    )

    logger.info(
        "chat request completed",
        extra={
            "request_id": request_id,
            "path": str(request.url.path),
            "method": request.method,
            "status_code": 200,
            "duration_ms": response.latency_ms,
            "intent": response.intent,
            "tools_used": response.tools_used,
            "retrieval_source": response.retrieval_source,
            "error": response.error,
        },
    )
    return response
