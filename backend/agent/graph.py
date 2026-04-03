"""LangGraph workflow definition."""

from __future__ import annotations

from time import perf_counter
from typing import Any, TypedDict

from langchain_groq import ChatGroq
from langgraph.graph import END, START, StateGraph

from backend.agent.nodes import classify_query, execute_tools, generate_answer, retrieve_context
from backend.config import get_settings

try:
    from langchain_google_genai import ChatGoogleGenerativeAI
except ImportError:  # pragma: no cover
    ChatGoogleGenerativeAI = None


class AgentState(TypedDict, total=False):
    query: str
    intent: str
    retrieved_context: str
    tool_context: str
    answer: str
    tools_used: list[str]
    retrieval_source: str
    retrieval_hit: bool
    evidence_found: bool
    llm_enabled: bool
    error: str | None
    stage_latencies_ms: dict[str, float]
    total_latency_ms: float


def _build_llm() -> Any:
    settings = get_settings()
    if settings.mock_mode:
        return None

    provider = settings.llm_provider.lower()
    if provider == "groq":
        if not settings.groq_api_key:
            return None
        return ChatGroq(
            api_key=settings.groq_api_key,
            model=settings.groq_model,
            temperature=0.2,
        )

    if provider == "google":
        if ChatGoogleGenerativeAI is None:
            raise RuntimeError(
                "Install `langchain-google-genai` to use Gemini models."
            )
        if not settings.google_api_key:
            return None
        return ChatGoogleGenerativeAI(
            google_api_key=settings.google_api_key,
            model=settings.google_model,
            temperature=0.2,
        )

    raise RuntimeError(
        f"Unsupported LLM_PROVIDER `{settings.llm_provider}`. Use `groq` or `google`."
    )


def build_graph() -> Any:
    """Compile the LangGraph workflow."""
    llm = _build_llm()
    graph = StateGraph(AgentState)

    graph.add_node("classify_query", classify_query)
    graph.add_node("retrieve_context", retrieve_context)
    graph.add_node("execute_tools", execute_tools)
    graph.add_node("generate_answer", lambda state: generate_answer(state, llm))

    graph.add_edge(START, "classify_query")
    graph.add_edge("classify_query", "retrieve_context")
    graph.add_edge("retrieve_context", "execute_tools")
    graph.add_edge("execute_tools", "generate_answer")
    graph.add_edge("generate_answer", END)

    return graph.compile()


def run_agent(query: str) -> dict[str, Any]:
    """Run the full agent graph for a user query."""
    started_at = perf_counter()
    app = build_graph()
    result = app.invoke({"query": query})
    result["total_latency_ms"] = round((perf_counter() - started_at) * 1000, 2)
    return result
