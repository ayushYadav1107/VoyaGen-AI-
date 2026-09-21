import pytest

import backend as b


def test_json_from_llm_extracts_object_from_noise():
    assert b._json_from_llm('sure! {"allowed": false, "reason": "x"} done') == {
        "allowed": False,
        "reason": "x",
    }


def test_json_from_llm_rejects_missing_object():
    with pytest.raises(ValueError):
        b._json_from_llm("no json here")


def test_retry_delay_prefers_provider_hint_and_caps():
    assert b._retry_delay("Please try again in 3.5s", 0) == 4.0
    assert b._retry_delay("try again in 500s", 0) == 65.0
    assert b._retry_delay("boom", 1) == 4.0  # exponential fallback


def test_split_trailing_partial_drops_cut_off_line():
    assert b._split_trailing_partial("| a | b |\n| c |") == "| a | b |"
    assert b._split_trailing_partial("single") == "single"


def test_fit_sections_respects_budget_and_skips_empty():
    out = b._fit_sections([("A", "x" * 5000, 1), ("B", None, 1), ("C", "short", 1)], 1000)
    assert "B:" not in out and "C:\nshort" in out
    assert len(out) < 1200


def test_routing_follows_fixed_order_and_skips_unselected():
    state = {"selected_agents": ["weather_agent", "flight_agent"]}
    assert b.route_from_supervisor(state) == "flight_agent"
    assert b.route_after_agent("flight_agent")(state) == "weather_agent"
    assert b.route_after_agent("weather_agent")(state) == "itinerary_agent"


def test_routing_blocked_request_short_circuits():
    state = {"guardrail_allowed": False, "selected_agents": ["flight_agent"]}
    assert b.route_from_supervisor(state) == "guardrail_blocked"


def test_supervisor_blocks_off_topic(monkeypatch):
    monkeypatch.setattr(b, "_llm_text", lambda *a, **k: '{"allowed": false, "reason": "not travel"}')
    out = b.supervisor_agent({"user_query": "write my homework"})
    assert out["guardrail_allowed"] is False
    assert out["selected_agents"] == []
    assert out["final_response"] == "not travel"


def test_guardrail_fails_open_on_bad_model_output(monkeypatch):
    calls = iter(["garbage", '{"selected_agents": ["hotel_agent"]}'])
    monkeypatch.setattr(b, "_llm_text", lambda *a, **k: next(calls))
    out = b.supervisor_agent({"user_query": "hotels in Goa"})
    assert out.get("guardrail_allowed", True) is True
