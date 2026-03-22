"""Log analysis tools."""

from __future__ import annotations

import re
from pathlib import Path

from langchain_core.tools import tool

from backend.config import get_settings


ERROR_PATTERNS = {
    "out_of_memory": re.compile(r"OutOfMemoryError|Java heap space", re.IGNORECASE),
    "timeout": re.compile(r"timeout|timed out", re.IGNORECASE),
    "database": re.compile(r"SQLException|connection refused|deadlock", re.IGNORECASE),
}
TIMESTAMP_PATTERN = re.compile(r"^(?P<timestamp>\S+)")
TRACE_ID_PATTERN = re.compile(r"\btrace_id=(?P<trace_id>[A-Za-z0-9_-]+)")


def _read_log_file() -> str:
    settings = get_settings()
    path = Path(settings.sample_logs_path)
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


@tool("search_logs")
def search_logs_tool(query: str, limit: int = 5) -> str:
    """Search local sample logs for lines matching the query."""
    log_text = _read_log_file()
    if not log_text:
        return "No sample log file found."

    query_terms = _expand_query_terms(query)
    scored_lines: list[tuple[int, str]] = []
    for line in log_text.splitlines():
        lower_line = line.lower()
        score = sum(1 for term in query_terms if term in lower_line)
        if score > 0:
            scored_lines.append((score, line))

    if not scored_lines:
        return "No matching log lines found."

    top_lines = [line for _, line in sorted(scored_lines, reverse=True)[:limit]]
    return "\n".join(top_lines)


@tool("analyze_logs")
def analyze_logs_tool(log_text: str) -> str:
    """Extract likely issue types from a log snippet."""
    if not log_text.strip():
        return "No log content provided."

    findings = []
    for label, pattern in ERROR_PATTERNS.items():
        if pattern.search(log_text):
            findings.append(label.replace("_", " "))

    if "exception" in log_text.lower() and "stack trace" not in findings:
        findings.append("exception stack trace")

    evidence_lines = [line for line in log_text.splitlines() if line.strip()]
    timestamps = _extract_timestamps(evidence_lines)
    trace_ids = _extract_trace_ids(evidence_lines)

    if not findings:
        if evidence_lines:
            summary = [
                "No obvious incident signature detected.\n"
            ]
            if timestamps:
                summary.append(f"Relevant timestamps: {', '.join(timestamps)}.")
            if trace_ids:
                summary.append(f"Relevant trace IDs: {', '.join(trace_ids)}.")
            summary.append(f"Evidence lines:\n{_format_evidence(evidence_lines)}")
            summary.append(
                "Recommended next step: inspect latency spikes, correlation IDs, and nearby log lines."
            )
            return "\n".join(summary)
        return "No obvious incident signature detected. Inspect latency spikes and correlation IDs."

    summary = [f"Likely issue types: {', '.join(findings)}."]
    if timestamps:
        summary.append(f"Relevant timestamps: {', '.join(timestamps)}.")
    if trace_ids:
        summary.append(f"Relevant trace IDs: {', '.join(trace_ids)}.")
    if evidence_lines:
        summary.append(f"Evidence lines:\n{_format_evidence(evidence_lines)}")
    summary.append("Recommended next step: inspect surrounding logs, trace IDs, and recent deploys.")
    return "\n".join(summary)


def _expand_query_terms(query: str) -> list[str]:
    lowered = query.lower()
    normalized = re.sub(r"[^a-zA-Z0-9]+", " ", lowered)
    terms = {term for term in normalized.split() if len(term) > 2}
    raw_terms = {term for term in re.split(r"\s+", lowered) if len(term) > 2}
    terms.update(raw_terms)

    if {"out", "memory"} <= terms or "oom" in terms:
        terms.update({"outofmemoryerror", "java heap space", "heap", "memory"})
    if "java" in terms:
        terms.update({"java", "exception"})
    if "error" in terms:
        terms.update({"error", "exception", "failed"})
    if "time" in terms or "when" in terms:
        terms.update({"timestamp"})
    if "trace" in terms or "trace_id" in terms or "trace id" in lowered:
        terms.update({"trace_id", "trace_id=", "trace", "request", "traceid"})

    return sorted(terms)


def _extract_timestamps(lines: list[str]) -> list[str]:
    timestamps = []
    for line in lines:
        match = TIMESTAMP_PATTERN.match(line)
        if match:
            timestamps.append(match.group("timestamp"))
    return timestamps


def _format_evidence(lines: list[str]) -> str:
    return "\n".join(f"- {line}" for line in lines)


def _extract_trace_ids(lines: list[str]) -> list[str]:
    trace_ids: list[str] = []
    for line in lines:
        match = TRACE_ID_PATTERN.search(line)
        if match:
            trace_ids.append(match.group("trace_id"))
    return trace_ids
