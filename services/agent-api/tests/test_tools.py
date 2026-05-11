"""Unit tests for agent-api tools dispatch — focused on URL construction safety."""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


def _make_http_ctx(status_code: int = 200, json_data: dict | None = None):
    """Return (ctx_manager, mock_client) for patching httpx.AsyncClient."""
    response = MagicMock()
    response.status_code = status_code
    response.json.return_value = json_data or {}
    response.raise_for_status = MagicMock()

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=response)

    ctx = MagicMock()
    ctx.__aenter__ = AsyncMock(return_value=mock_client)
    ctx.__aexit__ = AsyncMock(return_value=None)
    return ctx, mock_client


@pytest.mark.asyncio
async def test_get_persona_topic_url_encodes_slashes():
    """Slashes in the topic value are percent-encoded — prevents path traversal."""
    from app.tools import dispatch

    ctx, mock_client = _make_http_ctx()
    with patch("app.tools.httpx.AsyncClient", return_value=ctx):
        await dispatch("get_persona_topic", {"topic": "foo/bar"})

    called_url = mock_client.get.call_args[0][0]
    assert "foo%2Fbar" in called_url
    # Raw slash must not appear after the first path segment
    path = called_url.split("://", 1)[-1].split("/", 1)[-1]
    assert "foo/bar" not in path


@pytest.mark.asyncio
async def test_get_persona_topic_encodes_path_traversal():
    """Path-traversal sequences (../) in the topic are percent-encoded."""
    from app.tools import dispatch

    ctx, mock_client = _make_http_ctx()
    with patch("app.tools.httpx.AsyncClient", return_value=ctx):
        await dispatch("get_persona_topic", {"topic": "../../admin"})

    called_url = mock_client.get.call_args[0][0]
    # The raw traversal sequence must not reach the URL path
    path = called_url.split("://", 1)[-1].split("/", 1)[-1]
    assert "../" not in path


@pytest.mark.asyncio
async def test_get_persona_topic_all_bypasses_encoding():
    """The special 'all' sentinel maps to /persona, not /persona/all."""
    from app.tools import dispatch

    ctx, mock_client = _make_http_ctx()
    with patch("app.tools.httpx.AsyncClient", return_value=ctx):
        await dispatch("get_persona_topic", {"topic": "all"})

    called_url = mock_client.get.call_args[0][0]
    assert called_url.endswith("/persona")


@pytest.mark.asyncio
async def test_unknown_tool_returns_error_dict():
    """An unrecognised tool name returns a structured error, not an exception."""
    from app.tools import dispatch

    ctx, _ = _make_http_ctx()
    with patch("app.tools.httpx.AsyncClient", return_value=ctx):
        result = await dispatch("does_not_exist", {})

    assert "error" in result
    assert "does_not_exist" in result["error"]
