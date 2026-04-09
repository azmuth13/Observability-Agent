# Backend

This folder contains the FastAPI service, LangGraph agent, RAG pipeline, tools, and MCP server.

## MCP quick check

After installing backend dependencies, you can test the local MCP server with:

```bash
python scripts/test_mcp_client.py --list-tools
python scripts/test_mcp_client.py --tool search_logs --args '{"query":"error","limit":3}'
python scripts/test_mcp_client.py --tool get_metrics --args '{"service_name":"checkout-service"}'
```

## MCP client config

This repo now includes a starter [mcp.json](/Users/suraj/Documents/Codex/ai-observability-agent/mcp.json) file at the repository root.
It shows one way an MCP-aware client can launch the server with:

```bash
python -m backend.mcp.server
```

If you do not want the MCP server enabled, set:

```bash
ENABLE_MCP=false
```
