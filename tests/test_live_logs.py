from backend.live_logs.store import LiveLogStore, LogEvent
from backend.tools.log_tool import search_logs_tool


def test_live_log_store_searches_recent_rows(tmp_path) -> None:
    db_path = tmp_path / "recent_logs.db"
    store = LiveLogStore(db_path=db_path, max_rows=10)
    store.append(
        LogEvent(
            timestamp="2026-04-03T10:00:00Z",
            service="checkout-service",
            level="ERROR",
            message="Payment failed due to timeout",
            trace_id="abc123",
        )
    )

    results = store.search(["timeout", "payment"], limit=5)

    assert results
    assert "abc123" in results[0]


def test_search_logs_tool_prefers_live_logs_when_enabled(monkeypatch, tmp_path) -> None:
    db_path = tmp_path / "recent_logs.db"
    store = LiveLogStore(db_path=db_path, max_rows=10)
    store.append(
        LogEvent(
            timestamp="2026-04-03T10:01:00Z",
            service="checkout-service",
            level="ERROR",
            message="java.lang.OutOfMemoryError: Java heap space",
            trace_id="live123",
        )
    )

    monkeypatch.setattr("backend.tools.log_tool.LiveLogStore", lambda: store)

    settings = search_logs_tool.func.__globals__["get_settings"]()
    monkeypatch.setattr(settings, "enable_live_logs", True)

    result = search_logs_tool.invoke({"query": "out of memory error", "limit": 3})

    assert "live123" in result
