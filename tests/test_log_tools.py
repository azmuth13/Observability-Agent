from backend.tools.log_tool import analyze_logs_tool, search_logs_tool


def test_search_logs_tool_finds_out_of_memory_evidence() -> None:
    result = search_logs_tool.invoke({"query": "out of memory error", "limit": 3})

    assert "OutOfMemoryError" in result


def test_analyze_logs_tool_extracts_trace_ids_and_timestamps() -> None:
    log_text = (
        "2026-03-15T10:01:17Z ERROR checkout-service java.lang.OutOfMemoryError: Java heap space\n"
        "2026-03-15T10:01:19Z ERROR checkout-service request failed trace_id=abc123 exception=TimeoutError"
    )

    result = analyze_logs_tool.invoke({"log_text": log_text})

    assert "Likely issue types" in result
    assert "2026-03-15T10:01:17Z" in result
    assert "abc123" in result
