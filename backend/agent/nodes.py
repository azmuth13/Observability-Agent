"""Agent node implementations."""

from __future__ import annotations

from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from backend.agent.prompts import ANSWER_PROMPT, SYSTEM_PROMPT
from backend.tools.doc_tool import retrieve_docs_tool
from backend.tools.log_tool import analyze_logs_tool, search_logs_tool
from backend.tools.metrics_tool import get_metrics_tool


def classify_query(state: dict[str, Any]) -> dict[str, Any]:
    """Route queries to the right tooling using lightweight heuristics."""
    query = state["query"].lower()
    if any(
        keyword in query
        for keyword in (
            "log",
            "stack trace",
            "error",
            "exception",
            "trace_id",
            "trace id",
            "trace",
            "request id",
            "correlation id",
        )
    ):
        intent = "logs"
    elif any(keyword in query for keyword in ("cpu", "memory", "latency", "metrics", "slow")):
        intent = "metrics"
    else:
        intent = "docs"
    return {"intent": intent}


def retrieve_context(state: dict[str, Any]) -> dict[str, Any]:
    """Fetch top matching RAG documents."""
    query = state["query"]
    docs = retrieve_docs_tool.invoke({"query": query, "k": 4})
    return {"retrieved_context": docs}


def execute_tools(state: dict[str, Any]) -> dict[str, Any]:
    """Run intent-specific tools."""
    query = state["query"]
    intent = state["intent"]

    if intent == "logs":
        matches = search_logs_tool.invoke({"query": query, "limit": 5})
        tool_output = analyze_logs_tool.invoke({"log_text": matches})
    elif intent == "metrics":
        tool_output = get_metrics_tool.invoke({"service_name": "checkout-service"})
    else:
        tool_output = "Documentation-first query. No runtime tool needed."

    return {"tool_context": tool_output}


def generate_answer(state: dict[str, Any], llm: Any) -> dict[str, Any]:
    """Use the LLM to produce the final answer."""
    if llm is None:
        answer = (
            f"Diagnosis for `{state['query']}`\n\n"
            f"Intent: {state['intent']}\n"
            f"Evidence: {state.get('tool_context', 'No tool output.')}\n"
            f"Docs: {state.get('retrieved_context', 'No docs found.')}\n\n"
            "Next actions: configure `GROQ_API_KEY` to enable the full LLM reasoning step."
        )
        return {"answer": answer}

    prompt = ANSWER_PROMPT.format(
        query=state["query"],
        intent=state["intent"],
        retrieved_context=state.get("retrieved_context", "No docs found."),
        tool_context=state.get("tool_context", "No tool output."),
    )
    response = llm.invoke(
        [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=prompt),
        ]
    )
    content = getattr(response, "content", str(response))
    return {"answer": content}
