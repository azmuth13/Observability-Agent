"""Agent node implementations."""

from __future__ import annotations

from time import perf_counter
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from backend.agent.prompts import ANSWER_PROMPT, SYSTEM_PROMPT
from backend.rag.retriever import get_retrieval_source
from backend.tools.doc_tool import retrieve_docs_tool
from backend.tools.log_tool import analyze_logs_tool, search_logs_tool
from backend.tools.metrics_tool import get_metrics_tool


def _updated_latencies(state: dict[str, Any], stage_name: str, started_at: float) -> dict[str, float]:
    latencies = dict(state.get("stage_latencies_ms", {}))
    latencies[stage_name] = round((perf_counter() - started_at) * 1000, 2)
    return latencies


def _normalize_llm_content(content: Any) -> str:
    """Flatten provider-specific content blocks into plain text."""
    if isinstance(content, str):
        return content

    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                if item.get("type") == "text":
                    parts.append(str(item.get("text", "")))
                else:
                    parts.append(str(item))
            else:
                text_value = getattr(item, "text", None)
                parts.append(str(text_value if text_value is not None else item))
        return "\n".join(part for part in parts if part).strip()

    text_value = getattr(content, "text", None)
    if text_value is not None:
        return str(text_value)

    return str(content)


def classify_query(state: dict[str, Any]) -> dict[str, Any]:
    """Route queries to the right tooling using lightweight heuristics."""
    started_at = perf_counter()
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
    return {
        "intent": intent,
        "stage_latencies_ms": _updated_latencies(state, "classify_query", started_at),
    }


def retrieve_context(state: dict[str, Any]) -> dict[str, Any]:
    """Fetch top matching RAG documents."""
    started_at = perf_counter()
    query = state["query"]
    docs = retrieve_docs_tool.invoke({"query": query, "k": 4})
    retrieval_source = get_retrieval_source()
    retrieval_hit = "No matching observability documentation found." not in docs
    return {
        "retrieved_context": docs,
        "retrieval_source": retrieval_source,
        "retrieval_hit": retrieval_hit,
        "stage_latencies_ms": _updated_latencies(state, "retrieve_context", started_at),
    }


def execute_tools(state: dict[str, Any]) -> dict[str, Any]:
    """Run intent-specific tools."""
    started_at = perf_counter()
    query = state["query"]
    intent = state["intent"]
    tools_used: list[str]

    if intent == "logs":
        matches = search_logs_tool.invoke({"query": query, "limit": 5})
        tool_output = analyze_logs_tool.invoke({"log_text": matches})
        tools_used = ["search_logs", "analyze_logs"]
    elif intent == "metrics":
        tool_output = get_metrics_tool.invoke({"service_name": "checkout-service"})
        tools_used = ["get_metrics"]
    else:
        tool_output = "Documentation-first query. No runtime tool needed."
        tools_used = []

    evidence_missing_markers = (
        "No sample log file found.",
        "No matching log lines found.",
        "No matching observability documentation found.",
        "No runtime tool needed.",
    )
    evidence_found = not any(marker in tool_output for marker in evidence_missing_markers)

    return {
        "tool_context": tool_output,
        "tools_used": tools_used,
        "evidence_found": evidence_found,
        "stage_latencies_ms": _updated_latencies(state, "execute_tools", started_at),
    }


def generate_answer(state: dict[str, Any], llm: Any) -> dict[str, Any]:
    """Use the LLM to produce the final answer."""
    started_at = perf_counter()
    if llm is None:
        answer = (
            f"Diagnosis for `{state['query']}`\n\n"
            f"Intent: {state['intent']}\n"
            f"Tools used: {', '.join(state.get('tools_used', [])) or 'None'}\n"
            f"Retrieval source: {state.get('retrieval_source', 'unknown')}\n"
            f"Evidence: {state.get('tool_context', 'No tool output.')}\n"
            f"Docs: {state.get('retrieved_context', 'No docs found.')}\n\n"
            "Next actions: configure `GROQ_API_KEY` to enable the full LLM reasoning step."
        )
        return {
            "answer": answer,
            "llm_enabled": False,
            "stage_latencies_ms": _updated_latencies(state, "generate_answer", started_at),
        }

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
    content = _normalize_llm_content(getattr(response, "content", str(response)))
    return {
        "answer": content,
        "llm_enabled": True,
        "stage_latencies_ms": _updated_latencies(state, "generate_answer", started_at),
    }
