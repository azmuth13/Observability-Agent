"""FastAPI route definitions."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from backend.agent.graph import run_agent
from backend.config import get_settings


router = APIRouter(tags=["agent"])


class ChatRequest(BaseModel):
    query: str


class ChatResponse(BaseModel):
    answer: str
    intent: str | None = None
    retrieved_context: str | None = None
    tool_context: str | None = None


@router.get("/health")
def healthcheck() -> dict[str, str]:
    settings = get_settings()
    return {"status": "ok", "app": settings.app_name}


@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest) -> ChatResponse:
    result = run_agent(payload.query)
    return ChatResponse(
        answer=result.get("answer", ""),
        intent=result.get("intent"),
        retrieved_context=result.get("retrieved_context"),
        tool_context=result.get("tool_context"),
    )
