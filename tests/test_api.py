from fastapi.testclient import TestClient

import app as app_module

client = TestClient(app_module.app)


def test_health():
    assert client.get("/health").json()["status"] == "ok"


def test_empty_message_rejected():
    r = client.post("/api/travel", json={"message": "   "})
    assert r.status_code == 400 and r.json()["success"] is False


def test_rejection_requires_feedback():
    r = client.post("/api/travel/approve", json={"thread_id": "t", "approved": False, "feedback": ""})
    assert r.status_code == 400


def test_travel_returns_agent_result(monkeypatch):
    monkeypatch.setattr(app_module, "run_travel_agent", lambda **k: {"thread_id": "t1"})
    r = client.post("/api/travel", json={"message": "Plan Goa trip"})
    assert r.json() == {"success": True, "thread_id": "t1"}
