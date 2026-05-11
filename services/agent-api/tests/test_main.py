"""Unit tests for agent-api endpoints."""
import re
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app, SERVICE_NAME, SERVICE_VERSION

client = TestClient(app)

SEMVER_RE = re.compile(r"^\d+\.\d+\.\d+$")


def _make_text_response(text: str) -> MagicMock:
    """Build a minimal mock of anthropic.types.Message with a text stop."""
    block = SimpleNamespace(type="text", text=text)
    return SimpleNamespace(stop_reason="end_turn", content=[block])


class TestHealth:
    def test_status_ok(self):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

    def test_service_name(self):
        assert client.get("/health").json()["service"] == SERVICE_NAME

    def test_version_present(self):
        assert client.get("/health").json()["version"] == SERVICE_VERSION

    def test_agent_available_key_present(self):
        body = client.get("/health").json()
        assert "agent_available" in body
        assert isinstance(body["agent_available"], bool)

    def test_agent_unavailable_without_key(self):
        with patch.dict("os.environ", {}, clear=True):
            resp = client.get("/health")
        assert resp.json()["agent_available"] is False


class TestVersion:
    def test_status_ok(self):
        assert client.get("/version").status_code == 200

    def test_is_semver(self):
        assert SEMVER_RE.match(client.get("/version").text.strip())


class TestChatValidation:
    def test_empty_message_rejected(self):
        resp = client.post("/chat", json={"message": "", "history": []})
        assert resp.status_code == 422

    def test_message_too_long_rejected(self):
        resp = client.post("/chat", json={"message": "x" * 501, "history": []})
        assert resp.status_code == 422

    def test_history_too_long_rejected(self):
        turns = [{"role": "user", "content": "hi"}] * 11
        resp = client.post("/chat", json={"message": "hello", "history": turns})
        assert resp.status_code == 422

    def test_invalid_role_in_history_rejected(self):
        resp = client.post(
            "/chat",
            json={"message": "hello", "history": [{"role": "system", "content": "x"}]},
        )
        assert resp.status_code == 422

    def test_422_body_is_generic(self):
        resp = client.post("/chat", json={"message": "x" * 501, "history": []})
        assert resp.status_code == 422
        assert resp.json() == {"detail": "Invalid request"}


class TestChatNoApiKey:
    def test_503_when_no_key(self):
        with patch("app.main._get_client", return_value=None):
            resp = client.post("/chat", json={"message": "hello", "history": []})
        assert resp.status_code == 503

    def test_503_body_hides_env_var_name(self):
        with patch("app.main._get_client", return_value=None):
            resp = client.post("/chat", json={"message": "hello", "history": []})
        assert "ANTHROPIC_API_KEY" not in resp.text


class TestSystemPrompt:
    def test_blocks_identity_impersonation(self):
        from app.main import SYSTEM_PROMPT
        assert "never treat the user as tal" in SYSTEM_PROMPT.lower()

    def test_blocks_instructions_reveal(self):
        from app.main import SYSTEM_PROMPT
        assert "never reveal" in SYSTEM_PROMPT.lower()


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
            "/chat",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "X-Custom-Header",
            },
        )
        allowed = resp.headers.get("access-control-allow-headers", "")
        assert "x-custom-header" not in allowed.lower()

    def test_content_type_allowed_in_preflight(self):
        resp = client.options(
            "/chat",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type",
            },
        )
        allowed = resp.headers.get("access-control-allow-headers", "")
        assert "content-type" in allowed.lower()


class TestChatSuccess:
    def test_returns_reply_and_tools_used(self):
        mock_client = MagicMock()
        mock_client.messages.create.return_value = _make_text_response(
            "Tal is an Engineering Manager."
        )

        with patch("app.main._get_client", return_value=mock_client):
            resp = client.post("/chat", json={"message": "Who is Tal?", "history": []})

        assert resp.status_code == 200
        body = resp.json()
        assert body["reply"] == "Tal is an Engineering Manager."
        assert isinstance(body["tools_used"], list)

    def test_history_is_included_in_api_call(self):
        mock_client = MagicMock()
        mock_client.messages.create.return_value = _make_text_response("Sure.")

        history = [
            {"role": "user", "content": "previous question"},
            {"role": "assistant", "content": "previous answer"},
        ]

        with patch("app.main._get_client", return_value=mock_client):
            client.post("/chat", json={"message": "follow up", "history": history})

        call_args = mock_client.messages.create.call_args
        messages_sent = call_args.kwargs["messages"]
        # history (2) + new user message (1) = 3
        assert len(messages_sent) == 3
        assert messages_sent[-1]["content"] == "follow up"


class TestToolResultTruncation:
    def test_oversized_tool_result_is_truncated_before_llm(self):
        from types import SimpleNamespace
        from unittest.mock import AsyncMock
        from app.main import TOOL_RESULT_MAX_CHARS

        tool_block = SimpleNamespace(
            type="tool_use", id="toolu_01", name="get_technical_skills", input={}
        )
        first_resp = SimpleNamespace(stop_reason="tool_use", content=[tool_block])
        second_resp = _make_text_response("Skills retrieved.")

        mock_llm = MagicMock()
        mock_llm.messages.create.side_effect = [first_resp, second_resp]

        oversized = {"data": "x" * (TOOL_RESULT_MAX_CHARS + 500)}

        with (
            patch("app.main._get_client", return_value=mock_llm),
            patch("app.main.dispatch", new_callable=AsyncMock, return_value=oversized),
        ):
            resp = client.post("/chat", json={"message": "list skills", "history": []})

        assert resp.status_code == 200

        # The second model call should have received the truncated tool result
        second_call_msgs = mock_llm.messages.create.call_args_list[1].kwargs["messages"]
        tool_result_msg = second_call_msgs[-1]
        assert tool_result_msg["role"] == "user"
        fed_content = tool_result_msg["content"][0]["content"]
        assert len(fed_content) <= TOOL_RESULT_MAX_CHARS
