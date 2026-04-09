def test_debug_status_reports_runtime_flags(client) -> None:
    response = client.get("/api/debug/status")

    assert response.status_code == 200
    body = response.json()
    assert "mock_mode" in body
    assert "use_pinecone" in body
    assert "enable_mcp" in body
    assert "docs_path_exists" in body
    assert "sample_logs_path_exists" in body
    assert "pinecone_configured" in body
    assert "groq_configured" in body
