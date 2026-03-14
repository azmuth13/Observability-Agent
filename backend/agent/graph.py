"""LangGraph workflow definition."""

from __future__ import annotations

from typing import Any, TypedDict

from langchain_groq import ChatGroq
from langgraph.graph import END, START, StateGraph

from backend.agent.nodes import classify_query, execute_tools, generate_answer, retrieve_context
from backend.config import get_settings


class AgentState(TypedDict, total=False):
    query: str
    intent: str
    retrieved_context: str
    tool_context: str
    answer: str


def _build_llm() -> ChatGroq | None:
    settings = get_settings()
    if not settings.groq_api_key:
        return None
    return ChatGroq(
        api_key=settings.groq_api_key,
        model=settings.groq_model,
        temperature=0.2,
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
    app = build_graph()
    return app.invoke({"query": query})
