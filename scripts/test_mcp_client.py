"""Tiny local MCP client for exercising the observability MCP server."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path
from typing import Any

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


REPO_ROOT = Path(__file__).resolve().parents[1]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Connect to the local MCP server, list tools, or call one tool."
    )
    parser.add_argument(
        "--python",
        default=sys.executable,
        help="Python executable used to launch the MCP server.",
    )
    parser.add_argument(
        "--server-module",
        default="backend.mcp.server",
        help="Python module path for the MCP server entrypoint.",
    )
    parser.add_argument(
        "--list-tools",
        action="store_true",
        help="List all tools exposed by the MCP server.",
    )
    parser.add_argument(
        "--tool",
        help="Tool name to call, for example `search_logs` or `get_metrics`.",
    )
    parser.add_argument(
        "--args",
        default="{}",
        help='JSON object with tool arguments, for example \'{"query":"error","limit":3}\'.',
    )
    return parser


async def run_client(args: argparse.Namespace) -> int:
    try:
        tool_args: dict[str, Any] = json.loads(args.args)
    except json.JSONDecodeError as exc:
        print(f"Invalid JSON passed to --args: {exc}", file=sys.stderr)
        return 2

    if not isinstance(tool_args, dict):
        print("--args must decode to a JSON object.", file=sys.stderr)
        return 2

    server = StdioServerParameters(
        command=args.python,
        args=["-m", args.server_module],
        cwd=str(REPO_ROOT),
    )

    async with stdio_client(server) as (read_stream, write_stream):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()

            if args.list_tools or not args.tool:
                tools = await session.list_tools()
                print("Available MCP tools:")
                for tool in tools.tools:
                    print(f"- {tool.name}: {tool.description}")

            if args.tool:
                result = await session.call_tool(args.tool, tool_args)
                print(f"\nTool result for `{args.tool}`:")
                for content in result.content:
                    text = getattr(content, "text", None)
                    if text:
                        print(text)
                    else:
                        print(content)

    return 0


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return asyncio.run(run_client(args))


if __name__ == "__main__":
    raise SystemExit(main())
