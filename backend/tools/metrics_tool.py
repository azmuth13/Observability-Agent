"""Metrics tools."""

from __future__ import annotations

from langchain_core.tools import tool


@tool("get_metrics")
def get_metrics_tool(service_name: str) -> str:
    """Return synthetic metrics for local development."""
    return (
        f"Service: {service_name}\n"
        "CPU: 87%\n"
        "Memory: 76%\n"
        "P95 latency: 1.8s\n"
        "GC time: elevated\n"
        "Interpretation: CPU and latency are high enough to suspect GC pressure, hot loops, or thread contention."
    )
