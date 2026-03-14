"""Documentation retrieval tools."""

from __future__ import annotations

from langchain_core.tools import tool

from backend.rag.retriever import search_documents


@tool("retrieve_docs")
def retrieve_docs_tool(query: str, k: int = 4) -> str:
    """Retrieve supporting documentation from Pinecone."""
    return search_documents(query, k=k)
