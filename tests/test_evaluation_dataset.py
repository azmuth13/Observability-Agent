import json
from pathlib import Path


def test_evaluation_dataset_has_expected_shape() -> None:
    dataset_path = Path(__file__).resolve().parents[1] / "evaluation" / "sample_queries.json"

    payload = json.loads(dataset_path.read_text(encoding="utf-8"))

    assert payload
    for item in payload:
        assert item["id"]
        assert item["query"]
        assert item["expected_intent"] in {"logs", "metrics", "docs"}
        assert isinstance(item["expected_tool_path"], list)
        assert item["expected_evidence_type"]
