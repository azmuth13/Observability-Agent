from backend.api import routes


def test_chat_returns_observability_metadata(client, monkeypatch) -> None:
    def fake_run_agent(query: str) -> dict:
        assert query == "Why is CPU high?"
        return {
            "answer": "CPU is elevated due to possible GC pressure.",
            "intent": "metrics",
            "retrieved_context": "Source: jvm.md\nGC pressure guidance",
            "tool_context": "CPU: 87%",
            "tools_used": ["get_metrics"],
            "retrieval_source": "local",
            "retrieval_hit": True,
            "evidence_found": True,
            "llm_enabled": False,
            "total_latency_ms": 12.5,
            "stage_latencies_ms": {
                "classify_query": 0.2,
                "retrieve_context": 1.1,
                "execute_tools": 0.3,
                "generate_answer": 0.4,
            },
        }

    monkeypatch.setattr(routes, "run_agent", fake_run_agent)

    response = client.post("/api/chat", json={"query": "Why is CPU high?"})

    assert response.status_code == 200
    body = response.json()
    assert body["answer"] == "CPU is elevated due to possible GC pressure."
    assert body["intent"] == "metrics"
    assert body["tools_used"] == ["get_metrics"]
    assert body["retrieval_source"] == "local"
    assert body["retrieval_hit"] is True
    assert body["evidence_found"] is True
    assert body["llm_enabled"] is False
    assert body["latency_ms"] == 12.5
    assert body["stage_latencies_ms"]["retrieve_context"] == 1.1
    assert body["request_id"]
    assert response.headers["x-request-id"] == body["request_id"]


def test_chat_returns_graceful_error_when_agent_fails(client, monkeypatch) -> None:
    def fake_run_agent(query: str) -> dict:
        raise RuntimeError("boom")

    monkeypatch.setattr(routes, "run_agent", fake_run_agent)

    response = client.post("/api/chat", json={"query": "Check logs"})

    assert response.status_code == 200
    body = response.json()
    assert "unable to complete the request" in body["answer"].lower()
    assert body["error"] == "agent_execution_failed"
    assert body["request_id"]
    assert isinstance(body["latency_ms"], float)


def test_chat_returns_connection_specific_error_for_llm_network_failures(client, monkeypatch) -> None:
    def fake_run_agent(query: str) -> dict:
        raise RuntimeError("Connection error: Temporary failure in name resolution")

    monkeypatch.setattr(routes, "run_agent", fake_run_agent)

    response = client.post("/api/chat", json={"query": "Check logs"})

    assert response.status_code == 200
    body = response.json()
    assert "could not reach" in body["answer"]
    assert body["error"] == "llm_connection_failed"


def test_chat_returns_auth_specific_error_for_llm_auth_failures(client, monkeypatch) -> None:
    def fake_run_agent(query: str) -> dict:
        raise RuntimeError("401 Unauthorized: invalid api key")

    monkeypatch.setattr(routes, "run_agent", fake_run_agent)

    response = client.post("/api/chat", json={"query": "Check logs"})

    assert response.status_code == 200
    body = response.json()
    assert "could not authenticate" in body["answer"]
    assert body["error"] == "llm_auth_failed"
