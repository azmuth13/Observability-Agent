"""Retriever and vector store setup."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from langchain_huggingface import HuggingFaceEmbeddings
from langchain_pinecone import PineconeVectorStore

from backend.config import get_settings


@lru_cache(maxsize=1)
def get_embeddings() -> HuggingFaceEmbeddings:
    settings = get_settings()
    return HuggingFaceEmbeddings(model_name=settings.embedding_model)


def get_vector_store() -> PineconeVectorStore:
    settings = get_settings()
    if not settings.pinecone_api_key:
        raise RuntimeError("PINECONE_API_KEY is not configured.")
    return PineconeVectorStore(
        index_name=settings.pinecone_index_name,
        embedding=get_embeddings(),
        namespace=settings.pinecone_namespace,
        pinecone_api_key=settings.pinecone_api_key,
    )


def get_retriever(search_kwargs: dict | None = None):
    kwargs = {"k": 4}
    if search_kwargs:
        kwargs.update(search_kwargs)
    return get_vector_store().as_retriever(search_kwargs=kwargs)


def search_documents(query: str, k: int = 4) -> str:
    settings = get_settings()
    if not settings.pinecone_api_key:
        return _search_local_documents(query, k=k)

    try:
        retriever = get_retriever({"k": k})
        docs = retriever.invoke(query)
    except Exception:
        return _search_local_documents(query, k=k)

    if not docs:
        return "No matching observability documentation found."
    return "\n\n".join(
        f"Source: {doc.metadata.get('source', 'unknown')}\n{doc.page_content}"
        for doc in docs
    )


def _search_local_documents(query: str, k: int = 4) -> str:
    docs_path = get_settings().docs_path
    scored_docs: list[tuple[int, Path]] = []
    terms = [term for term in query.lower().split() if len(term) > 2]

    for path in docs_path.glob("**/*"):
        if not path.is_file():
            continue
        content = path.read_text(encoding="utf-8")
        score = sum(content.lower().count(term) for term in terms)
        if score:
            scored_docs.append((score, path))

    if not scored_docs:
        return "No matching observability documentation found."

    top_paths = sorted(scored_docs, key=lambda item: item[0], reverse=True)[:k]
    results = []
    for _, path in top_paths:
        content = path.read_text(encoding="utf-8")
        results.append(f"Source: {path.name}\n{content}")
    return "\n\n".join(results)
