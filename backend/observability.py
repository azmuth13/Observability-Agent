"""Logging and request observability utilities."""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from pathlib import Path

from backend.config import get_settings


class JsonFormatter(logging.Formatter):
    """Format logs as compact JSON for easy filtering."""

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        for field in (
            "request_id",
            "path",
            "method",
            "status_code",
            "duration_ms",
            "intent",
            "tools_used",
            "retrieval_source",
            "error",
        ):
            value = getattr(record, field, None)
            if value is not None:
                payload[field] = value

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        return json.dumps(payload, default=str)


def configure_logging() -> None:
    """Set up console and file logging once per process."""
    settings = get_settings()
    log_path = Path(settings.app_log_path)
    log_path.parent.mkdir(parents=True, exist_ok=True)

    root_logger = logging.getLogger()
    if getattr(root_logger, "_ai_observability_configured", False):
        return

    formatter = JsonFormatter()
    handlers: list[logging.Handler] = [
        logging.StreamHandler(),
        logging.FileHandler(log_path, encoding="utf-8"),
    ]

    for handler in handlers:
        handler.setFormatter(formatter)

    root_logger.handlers.clear()
    root_logger.setLevel(settings.app_log_level.upper())
    for handler in handlers:
        root_logger.addHandler(handler)

    root_logger._ai_observability_configured = True  # type: ignore[attr-defined]
