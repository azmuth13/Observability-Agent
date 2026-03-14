"""MCP server exposing observability tools."""

from __future__ import annotations

from backend.tools.doc_tool import retrieve_docs_tool
from backend.tools.log_tool import analyze_logs_tool, search_logs_tool
from backend.tools.metrics_tool import get_metrics_tool

try:
    from mcp.server.fastmcp import FastMCP
except ImportError:  # pragma: no cover
    FastMCP = None


def create_mcp_server():
    """Create an MCP server if the dependency is installed."""
    if FastMCP is None:
        raise RuntimeError("Install `mcp` to run the MCP server.")

    server = FastMCP("ai-observability-agent")

    @server.tool()
    def search_logs(query: str, limit: int = 5) -> str:
        return search_logs_tool.invoke({"query": query, "limit": limit})

    @server.tool()
    def analyze_logs(log_text: str) -> str:
        return analyze_logs_tool.invoke({"log_text": log_text})

    @server.tool()
    def get_metrics(service_name: str) -> str:
        return get_metrics_tool.invoke({"service_name": service_name})

    @server.tool()
    def retrieve_docs(query: str, k: int = 4) -> str:
        return retrieve_docs_tool.invoke({"query": query, "k": k})

    return server


if __name__ == "__main__":
    create_mcp_server().run()
