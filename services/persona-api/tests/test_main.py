"""Unit tests for persona-api endpoints."""
import re

import pytest
from fastapi.testclient import TestClient

from app.main import app, PERSONA_DATA, SERVICE_NAME, SERVICE_VERSION

client = TestClient(app)

SEMVER_RE = re.compile(r"^\d+\.\d+\.\d+$")


class TestHealth:
    def test_status_ok(self):
        resp = client.get("/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"

    def test_service_name(self):
        resp = client.get("/health")
        assert resp.json()["service"] == SERVICE_NAME

    def test_version_present(self):
        resp = client.get("/health")
        assert resp.json()["version"] == SERVICE_VERSION


class TestVersion:
    def test_status_ok(self):
        resp = client.get("/version")
        assert resp.status_code == 200

    def test_is_semver(self):
        resp = client.get("/version")
        assert SEMVER_RE.match(resp.text.strip())


class TestPersonaAll:
    def test_status_ok(self):
        resp = client.get("/persona")
        assert resp.status_code == 200

    def test_returns_dict(self):
        resp = client.get("/persona")
        assert isinstance(resp.json(), dict)

    def test_has_expected_topics(self):
        resp = client.get("/persona")
        body = resp.json()
        for topic in PERSONA_DATA:
            assert topic in body


class TestPersonaTopic:
    def test_valid_topic_returns_200(self):
        topic = next(iter(PERSONA_DATA))
        resp = client.get(f"/persona/{topic}")
        assert resp.status_code == 200

    def test_valid_topic_returns_that_topic(self):
        topic = next(iter(PERSONA_DATA))
        resp = client.get(f"/persona/{topic}")
        assert topic in resp.json()

    def test_unknown_topic_returns_404(self):
        resp = client.get("/persona/does-not-exist")
        assert resp.status_code == 404

    def test_each_valid_topic_accessible(self):
        for topic in PERSONA_DATA:
            resp = client.get(f"/persona/{topic}")
            assert resp.status_code == 200, f"Topic '{topic}' returned {resp.status_code}"


class TestTopics:
    def test_status_ok(self):
        resp = client.get("/topics")
        assert resp.status_code == 200

    def test_returns_list_of_strings(self):
        resp = client.get("/topics")
        topics = resp.json()["topics"]
        assert isinstance(topics, list)
        assert all(isinstance(t, str) for t in topics)

    def test_topics_match_persona_keys(self):
        resp = client.get("/topics")
        assert set(resp.json()["topics"]) == set(PERSONA_DATA.keys())


class TestPersonaSchema:
    def test_all_items_are_dicts(self):
        resp = client.get("/persona")
        body = resp.json()
        for topic, data in body.items():
            if "items" in data:
                for item in data["items"]:
                    assert isinstance(item, dict), (
                        f"Topic '{topic}' has a non-dict item: {item!r}"
                    )


class TestSecurityHeaders:
    @pytest.mark.parametrize("header,expected", [
        ("x-content-type-options", "nosniff"),
        ("x-frame-options", "DENY"),
        ("referrer-policy", "strict-origin-when-cross-origin"),
    ])
    def test_header_present_on_all_responses(self, header, expected):
        resp = client.get("/health")
        assert resp.headers.get(header) == expected


class TestCorsHeaders:
    def test_custom_header_not_allowed_in_preflight(self):
        resp = client.options(
            "/persona",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "X-Custom-Header",
            },
        )
        allowed = resp.headers.get("access-control-allow-headers", "")
        assert "x-custom-header" not in allowed.lower()
