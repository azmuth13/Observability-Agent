"""Document ingestion pipeline for Pinecone."""

from __future__ import annotations

from pathlib import Path

from langchain_community.document_loaders import DirectoryLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

from backend.config import get_settings
from backend.rag.retriever import get_vector_store


def load_documents(path: Path | None = None):
    """Load raw text and markdown documents from disk."""
    settings = get_settings()
    docs_path = path or settings.docs_path
    documents = []
    for pattern in ("**/*.md", "**/*.txt"):
        loader = DirectoryLoader(
            str(docs_path),
            glob=pattern,
            loader_cls=TextLoader,
            show_progress=True,
        )
        documents.extend(loader.load())
    return documents


def split_documents():
    """Chunk documents for vector storage."""
    documents = load_documents()
    splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=120)
    return splitter.split_documents(documents)


def ingest_documents() -> int:
    """Embed and upsert documents into Pinecone."""
    chunks = split_documents()
    if not chunks:
        return 0
    vector_store = get_vector_store()
    vector_store.add_documents(chunks)
    return len(chunks)


if __name__ == "__main__":
    total = ingest_documents()
    print(f"Ingested {total} chunks into Pinecone.")
