"""Application configuration."""

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT_DIR / "data"


class Settings(BaseSettings):
    """Environment-backed application settings."""

    app_name: str = "AI Observability Agent"
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    app_reload: bool = True
    app_origin: str = "http://localhost:5173"

    groq_api_key: str = Field(default="", alias="GROQ_API_KEY")
    groq_model: str = Field(default="llama-3.1-8b-instant", alias="GROQ_MODEL")

    pinecone_api_key: str = Field(default="", alias="PINECONE_API_KEY")
    pinecone_index_name: str = Field(
        default="ai-observability-agent",
        alias="PINECONE_INDEX_NAME",
    )
    pinecone_namespace: str = Field(default="observability-docs", alias="PINECONE_NAMESPACE")

    langchain_api_key: str = Field(default="", alias="LANGCHAIN_API_KEY")
    langchain_project: str = Field(default="ai-observability-agent", alias="LANGCHAIN_PROJECT")
    langchain_tracing_v2: bool = Field(default=True, alias="LANGCHAIN_TRACING_V2")

    embedding_model: str = Field(
        default="sentence-transformers/all-MiniLM-L6-v2",
        alias="EMBEDDING_MODEL",
    )

    docs_path: Path = DATA_DIR / "docs"
    sample_logs_path: Path = DATA_DIR / "sample_logs" / "app.log"

    model_config = SettingsConfigDict(
        env_file=ROOT_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        populate_by_name=True,
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
