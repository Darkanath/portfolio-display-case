"""M5 tests — CV-tailoring delivery: the generate_tailored_cv dispatch branch, the
per-tool sliding-window rate limiter, the single-use download token store, and the
GET /cv/tailored/{token} endpoint.

The slowapi route limiter is disabled for this file (autouse fixture) so the
download-endpoint tests don't accrue against the shared per-process 'testclient'
counter; the tool's own limiter is tested directly via _tailor_rate_ok.
"""
import json
import time
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

from app import main, tools
from app.tools import claim_download, dispatch, register_download

client = TestClient(app=main.app)


EXP = [
    {
        "id": "smartlinx", "title": "Cloud Architect", "company": "SmartLinx",
        "start": "2025-01", "end": "2026-06", "current": False,
        "stack": ["C#", "Azure"],
        "achievements": [
            {"text": "Re-platformed a monolith onto Azure for 10,000 users.",
             "metric": "10,000 users", "tags": ["azure"]},
        ],
    },
]
PROFILE = {"name": "Tal Shterzer", "tagline": "Engineering Manager", "summary": "17+ years."}
SKILLS = {"languages": ["C#"], "cloud": ["Azure"]}

GOOD_TAILOR_JSON = json.dumps({
    "target_role": "Staff Engineer",
    "generated_summary": "Architect and manager.",
    "roles": [{
        "id": "smartlinx", "title": "Cloud Architect", "company": "SmartLinx", "stack": ["C#"],
        "highlights": [
            {"text": "Re-platformed a monolith onto Azure for 10,000 users.", "source_id": "smartlinx"},
        ],
    }],
    "skills": ["C#", "Azure"],
})
BAD_TAILOR_JSON = json.dumps({  # cites a role that doesn't exist -> existence gate fails
    "target_role": "Staff Engineer", "generated_summary": "x",
    "roles": [{"id": "not-real", "title": "Cloud Architect", "company": "SmartLinx",
               "stack": [], "highlights": []}],
    "skills": [],
})


@pytest.fixture(autouse=True)
def _isolated_state():
    tools._TAILOR_CALLS.clear()
    tools._PENDING.clear()
    prev = main.limiter.enabled
    main.limiter.enabled = False  # ignore slowapi route limits in this file
    yield
    main.limiter.enabled = prev
    tools._TAILOR_CALLS.clear()
    tools._PENDING.clear()


def _experience_http(by_path, error=None):
    """AsyncClient ctx whose .get returns different JSON per URL path (or raises)."""
    async def _get(url, *a, **k):
        if error is not None:
            raise error
        resp = MagicMock()
        resp.status_code = 200
        resp.raise_for_status = MagicMock()
        # endswith, not substring: the hostname 'experience-api' would otherwise
        # collide with the '/experience' key for every URL.
        resp.json.return_value = next((d for k, d in by_path.items() if url.endswith(k)), {})
        return resp

    mock_client = AsyncMock()
    mock_client.get = _get
    ctx = MagicMock()
    ctx.__aenter__ = AsyncMock(return_value=mock_client)
    ctx.__aexit__ = AsyncMock(return_value=None)
    return ctx


def _llm(json_text):
    c = MagicMock()
    c.messages.create.return_value = SimpleNamespace(
        content=[SimpleNamespace(type="text", text=json_text)]
    )
    return c


class TestSlidingWindowRateLimiter:
    def test_allows_up_to_limit_then_blocks(self, monkeypatch):
        now = [1000.0]
        monkeypatch.setattr(tools.time, "time", lambda: now[0])
        ip = "1.2.3.4"
        for _ in range(tools.TAILOR_RATE_LIMIT):
            assert tools._tailor_rate_ok(ip) is True
        assert tools._tailor_rate_ok(ip) is False

    def test_is_per_ip(self, monkeypatch):
        now = [1000.0]
        monkeypatch.setattr(tools.time, "time", lambda: now[0])
        for _ in range(tools.TAILOR_RATE_LIMIT):
            tools._tailor_rate_ok("1.1.1.1")
        assert tools._tailor_rate_ok("1.1.1.1") is False
        assert tools._tailor_rate_ok("2.2.2.2") is True  # different IP unaffected

    def test_window_rolls_over(self, monkeypatch):
        now = [1000.0]
        monkeypatch.setattr(tools.time, "time", lambda: now[0])
        ip = "3.3.3.3"
        for _ in range(tools.TAILOR_RATE_LIMIT):
            tools._tailor_rate_ok(ip)
        assert tools._tailor_rate_ok(ip) is False
        now[0] += tools.TAILOR_RATE_WINDOW_SECONDS + 1
        assert tools._tailor_rate_ok(ip) is True  # old timestamps pruned


class TestTokenStore:
    def test_register_then_single_claim(self, tmp_path):
        f = tmp_path / "abc.docx"
        f.write_bytes(b"data")
        token = register_download(str(f))
        assert token == "abc"
        assert claim_download(token) == str(f)  # first claim wins
        assert claim_download(token) is None     # second is gone (race-safe)

    def test_expired_claim_returns_none_and_removes_file(self, tmp_path):
        f = tmp_path / "old.docx"
        f.write_bytes(b"data")
        token = register_download(str(f))
        path, _ = tools._PENDING[token]
        tools._PENDING[token] = (path, time.time() - 1)  # already expired
        assert claim_download(token) is None
        assert not f.exists()

    def test_unknown_token(self):
        assert claim_download("does-not-exist") is None


class TestDownloadEndpoint:
    def test_download_then_gone(self, tmp_path):
        f = tmp_path / "dl1.docx"
        f.write_bytes(b"PK\x03\x04 fake docx bytes")
        register_download(str(f))

        r1 = client.get("/cv/tailored/dl1")
        assert r1.status_code == 200
        assert r1.content == b"PK\x03\x04 fake docx bytes"
        assert "attachment" in r1.headers.get("content-disposition", "").lower()
        assert not f.exists()  # BackgroundTask deleted it after streaming

        assert client.get("/cv/tailored/dl1").status_code == 404  # single use

    def test_expired_download_404s_and_cleans(self, tmp_path):
        f = tmp_path / "dl2.docx"
        f.write_bytes(b"data")
        register_download(str(f))
        path, _ = tools._PENDING["dl2"]
        tools._PENDING["dl2"] = (path, time.time() - 1)

        assert client.get("/cv/tailored/dl2").status_code == 404
        assert not f.exists()

    def test_unknown_token_404(self):
        assert client.get("/cv/tailored/nope").status_code == 404


class TestGenerateTailoredCvDispatch:
    @pytest.mark.asyncio
    async def test_success_returns_and_registers_download_token(self):
        ctx = _experience_http({"/experience": EXP, "/profile": PROFILE, "/skills": SKILLS})
        with (
            patch("app.tools.httpx.AsyncClient", return_value=ctx),
            patch("app.tools._anthropic_client", return_value=_llm(GOOD_TAILOR_JSON)),
            patch("app.tools.render_cv", return_value="/tmp/tok_success.docx"),
        ):
            result = await dispatch(
                "generate_tailored_cv",
                {"target_role": "Staff Engineer", "job_description": ""},
                client_ip="9.9.9.1",
            )
        assert result["download_token"] == "tok_success"
        assert result["target_role"] == "Staff Engineer"
        assert "tok_success" in tools._PENDING

    @pytest.mark.asyncio
    async def test_gate_failure_returns_clean_error_and_never_renders(self):
        ctx = _experience_http({"/experience": EXP, "/profile": PROFILE, "/skills": SKILLS})
        with (
            patch("app.tools.httpx.AsyncClient", return_value=ctx),
            patch("app.tools._anthropic_client", return_value=_llm(BAD_TAILOR_JSON)),
            patch("app.tools.render_cv") as render,
        ):
            result = await dispatch(
                "generate_tailored_cv",
                {"target_role": "X", "job_description": ""},
                client_ip="9.9.9.2",
            )
        assert "error" in result
        assert "download_token" not in result
        render.assert_not_called()

    @pytest.mark.asyncio
    async def test_experience_api_down_returns_clean_error(self):
        ctx = _experience_http({}, error=httpx.ConnectError("down"))
        with patch("app.tools.httpx.AsyncClient", return_value=ctx):
            result = await dispatch(
                "generate_tailored_cv",
                {"target_role": "X", "job_description": ""},
                client_ip="9.9.9.3",
            )
        assert "error" in result
        assert "download_token" not in result

    @pytest.mark.asyncio
    async def test_missing_target_role_returns_error(self):
        result = await dispatch(
            "generate_tailored_cv",
            {"target_role": "   ", "job_description": ""},
            client_ip="9.9.9.4",
        )
        assert "error" in result

    @pytest.mark.asyncio
    async def test_rate_limited_short_circuits_before_calling_claude(self):
        ip = "9.9.9.5"
        for _ in range(tools.TAILOR_RATE_LIMIT):
            assert tools._tailor_rate_ok(ip) is True  # exhaust the window
        with patch("app.tools._anthropic_client") as llm:
            result = await dispatch(
                "generate_tailored_cv",
                {"target_role": "X", "job_description": ""},
                client_ip=ip,
            )
        assert "error" in result
        llm.assert_not_called()


class TestDownloadFullCvDispatch:
    @pytest.mark.asyncio
    async def test_returns_download_token_no_claude_call(self):
        ctx = _experience_http({"/experience": EXP, "/profile": PROFILE, "/skills": SKILLS})
        with (
            patch("app.tools.httpx.AsyncClient", return_value=ctx),
            patch("app.tools.render_cv", return_value="/tmp/full_tok.docx"),
            patch("app.tools._anthropic_client") as llm,
        ):
            result = await dispatch("download_full_cv", {}, client_ip="9.9.9.20")
        assert result["download_token"] == "full_tok"
        assert "error" not in result
        llm.assert_not_called()  # full CV is deterministic, no tailoring call

    @pytest.mark.asyncio
    async def test_experience_api_down_returns_clean_error(self):
        ctx = _experience_http({}, error=httpx.ConnectError("down"))
        with patch("app.tools.httpx.AsyncClient", return_value=ctx):
            result = await dispatch("download_full_cv", {}, client_ip="9.9.9.21")
        assert "error" in result
        assert "download_token" not in result


class TestChatDownloadWiring:
    def test_download_url_populated_and_raw_token_not_fed_to_claude(self):
        tool_block = SimpleNamespace(
            type="tool_use", id="toolu_1", name="generate_tailored_cv",
            input={"target_role": "Staff Engineer", "job_description": ""},
        )
        first = SimpleNamespace(stop_reason="tool_use", content=[tool_block])
        second = SimpleNamespace(
            stop_reason="end_turn",
            content=[SimpleNamespace(type="text", text="Here is your tailored CV.")],
        )
        mock_llm = MagicMock()
        mock_llm.messages.create.side_effect = [first, second]

        with (
            patch("app.main._get_client", return_value=mock_llm),
            patch(
                "app.main.dispatch", new_callable=AsyncMock,
                return_value={"download_token": "wired-token", "target_role": "Staff Engineer",
                              "note": "Tailored CV generated; a download link is attached to the reply."},
            ),
        ):
            resp = client.post(
                "/chat", json={"message": "tailor a CV for staff engineer", "history": []}
            )

        assert resp.status_code == 200
        assert resp.json()["download_url"] == "/cv/tailored/wired-token"

        # The raw token must not have been handed back to Claude in the tool result.
        fed = mock_llm.messages.create.call_args_list[1].kwargs["messages"][-1]["content"][0]["content"]
        assert "wired-token" not in fed
        assert "download link is attached" in fed
