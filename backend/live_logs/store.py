"""Recent live log storage backed by SQLite."""

from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from pathlib import Path

from backend.config import get_settings


@dataclass(slots=True)
class LogEvent:
    timestamp: str
    service: str
    level: str
    message: str
    trace_id: str | None = None
    logger: str | None = None
    method: str | None = None
    exception: str | None = None
    raw: str | None = None

    def to_line(self) -> str:
        parts = [self.timestamp, self.level, self.service, self.message]
        if self.trace_id:
            parts.append(f"trace_id={self.trace_id}")
        if self.method:
            parts.append(f"method={self.method}")
        if self.exception:
            parts.append(f"exception={self.exception}")
        return " ".join(part for part in parts if part).strip()


class LiveLogStore:
    """Store a rolling window of recent logs for exact search."""

    def __init__(self, db_path: Path | None = None, max_rows: int | None = None) -> None:
        settings = get_settings()
        self.db_path = Path(db_path or settings.live_logs_db_path)
        self.max_rows = max_rows or settings.live_logs_max_rows
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self.db_path)

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS live_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    service TEXT NOT NULL,
                    level TEXT NOT NULL,
                    message TEXT NOT NULL,
                    trace_id TEXT,
                    logger TEXT,
                    method TEXT,
                    exception TEXT,
                    raw TEXT
                )
                """
            )
            connection.commit()

    def append(self, event: LogEvent) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO live_logs (
                    timestamp, service, level, message, trace_id, logger, method, exception, raw
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    event.timestamp,
                    event.service,
                    event.level,
                    event.message,
                    event.trace_id,
                    event.logger,
                    event.method,
                    event.exception,
                    event.raw or event.to_line(),
                ),
            )
            self._trim(connection)
            connection.commit()

    def _trim(self, connection: sqlite3.Connection) -> None:
        connection.execute(
            """
            DELETE FROM live_logs
            WHERE id NOT IN (
                SELECT id
                FROM live_logs
                ORDER BY id DESC
                LIMIT ?
            )
            """,
            (self.max_rows,),
        )

    def search(self, query_terms: list[str], limit: int = 5) -> list[str]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT timestamp, service, level, message, trace_id, logger, method, exception, raw
                FROM live_logs
                ORDER BY id DESC
                LIMIT ?
                """,
                (self.max_rows,),
            ).fetchall()

        scored_lines: list[tuple[int, str]] = []
        for row in rows:
            event = LogEvent(
                timestamp=row[0],
                service=row[1],
                level=row[2],
                message=row[3],
                trace_id=row[4],
                logger=row[5],
                method=row[6],
                exception=row[7],
                raw=row[8],
            )
            rendered = event.raw or event.to_line()
            lower_line = rendered.lower()
            score = sum(1 for term in query_terms if term in lower_line)
            if score > 0:
                scored_lines.append((score, rendered))

        return [line for _, line in sorted(scored_lines, reverse=True)[:limit]]

    def count(self) -> int:
        with self._connect() as connection:
            row = connection.execute("SELECT COUNT(*) FROM live_logs").fetchone()
        return int(row[0]) if row else 0


def parse_kafka_log_event(payload: str) -> LogEvent:
    """Parse a JSON log event produced by a sample Spring Boot app."""
    data = json.loads(payload)
    return LogEvent(
        timestamp=str(data.get("timestamp", "")),
        service=str(data.get("service", "unknown-service")),
        level=str(data.get("level", "INFO")),
        message=str(data.get("message", "")),
        trace_id=_optional_string(data.get("trace_id")),
        logger=_optional_string(data.get("logger")),
        method=_optional_string(data.get("method")),
        exception=_optional_string(data.get("exception")),
        raw=payload,
    )


def _optional_string(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None
