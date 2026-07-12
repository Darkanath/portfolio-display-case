"""Tool definitions for the Ask Tal agent.

These are the only side effects the LLM can produce. Each tool maps to a small
function that calls one of the data services. The agent has no direct access
to anything else.
"""

from __future__ import annotations

import os
import time
from pathlib import Path
from typing import Any
from urllib.parse import quote

import anthropic
import httpx

from app.cv_render import render_cv
from app.cv_tailor import JOB_DESCRIPTION_MAX_CHARS, TailorError, tailor_cv

EXPERIENCE_API_URL = os.environ.get("EXPERIENCE_API_URL", "http://experience-api:8080")
PERSONA_API_URL = os.environ.get("PERSONA_API_URL", "http://persona-api:8080")
SITE_BASE_URL = os.environ.get("SITE_BASE_URL", "http://localhost:5173")

TIMEOUT = httpx.Timeout(5.0, connect=3.0)

CONTACT_EMAIL = "shterzer@gmail.com"
CONTACT_LINKEDIN = "https://linkedin.com/in/talshterzer"

# --- CV-tailoring: per-tool rate limit + download token store -----------------
# Both are per-process, in-memory state (same category as slowapi's own limiter).
# They assume a single process: agent-api must stay at maxReplicas: 1, or a token
# minted on one replica 404s on another and the per-IP counter can be bypassed.
# See docs/cv-tailoring.md § Single-instance constraint.

# The tailoring tool is meaningfully more expensive than a chat turn (a second
# Claude call + a docx render + extra experience-api round-trips), so it carries
# its own tighter cap, independent of /chat's route-level slowapi limit. Sliding
# window (per-IP timestamp list, pruned each check) avoids fixed-window doubling.
TAILOR_RATE_LIMIT = int(os.environ.get("TAILOR_RATE_LIMIT", "3"))
TAILOR_RATE_WINDOW_SECONDS = 3600
_TAILOR_CALLS: dict[str, list[float]] = {}

# Download tokens: token -> (path, expires_at). Single-use, lazy TTL; nothing is
# persisted beyond the /tmp file and this dict entry.
DOWNLOAD_TTL_SECONDS = int(os.environ.get("DOWNLOAD_TTL_SECONDS", "600"))
_PENDING: dict[str, tuple[str, float]] = {}


def _anthropic_client() -> anthropic.Anthropic | None:
    """A fresh Anthropic client for the tailor call (own creation, not imported
    from main.py — importing main here would be circular)."""
    key = os.environ.get("ANTHROPIC_API_KEY")
    return anthropic.Anthropic(api_key=key) if key else None


def _tailor_rate_ok(client_ip: str | None) -> bool:
    """Record this call and return False if the IP is over TAILOR_RATE_LIMIT within
    the trailing window. Bounds frequency of the expensive branch, not per-request
    scope (gate 4 handles scope)."""
    now = time.time()
    key = client_ip or "unknown"
    recent = [t for t in _TAILOR_CALLS.get(key, []) if now - t < TAILOR_RATE_WINDOW_SECONDS]
    if len(recent) >= TAILOR_RATE_LIMIT:
        _TAILOR_CALLS[key] = recent
        return False
    recent.append(now)
    _TAILOR_CALLS[key] = recent
    return True


def register_download(path: str) -> str:
    """Store a rendered file under its filename-stem token and return the token."""
    token = Path(path).stem
    _PENDING[token] = (path, time.time() + DOWNLOAD_TTL_SECONDS)
    return token


def claim_download(token: str) -> str | None:
    """Atomically claim a token: pop it, return its path if still valid, else None.

    Popping synchronously (`dict.pop` is atomic in CPython) before the caller awaits
    anything is what makes the download single-use under near-simultaneous requests —
    deferring the pop to a post-response cleanup would leave a race window. An expired
    entry is dropped and its file removed on this touch (lazy TTL, no background sweep).
    """
    entry = _PENDING.pop(token, None)
    if entry is None:
        return None
    path, expires_at = entry
    if time.time() > expires_at:
        try:
            os.remove(path)
        except FileNotFoundError:
            pass
        return None
    return path


TOOLS: list[dict[str, Any]] = [
    {
        "name": "get_work_experience",
        "description": (
            "Retrieve Tal's work history. Use this when the user asks about jobs, "
            "roles, companies, responsibilities, or career progression. Returns "
            "all roles unless a company name is provided."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "company": {
                    "type": "string",
                    "description": "Optional company name to filter by (case-insensitive substring match).",
                }
            },
        },
    },
    {
        "name": "get_technical_skills",
        "description": (
            "Retrieve Tal's technical skills, grouped by category "
            "(languages, cloud, data, AI, leadership, practices)."
        ),
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "get_profile",
        "description": (
            "Retrieve Tal's professional profile: name, tagline, summary, years of experience. "
            "Use this for high-level 'who is Tal' questions."
        ),
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "get_persona_topic",
        "description": (
            "Retrieve content from Tal's non-CV side: boardgames, boardgame taste and opinions, "
            "shelf highlights, tabletop roleplaying, RPG systems, and the craft parallels between "
            "GMing and engineering. Use this when the user asks about Tal as a person beyond his "
            "professional work."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "topic": {
                    "type": "string",
                    "description": (
                        "Topic to retrieve. Call get_persona_topics first if you don't know "
                        "which topics exist. Pass 'all' to get everything."
                    ),
                }
            },
            "required": ["topic"],
        },
    },
    {
        "name": "get_persona_topics",
        "description": "List the available persona topics. Call this first if unsure what is available.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "get_cv_download_link",
        "description": (
            "Get a link to download Tal's CV as a PDF. Use this when the user asks for the CV, "
            "resume, or wants a copy to keep."
        ),
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "get_contact_info",
        "description": (
            "Get Tal's contact information (email, LinkedIn). Use only when the user explicitly "
            "asks how to reach Tal."
        ),
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "generate_tailored_cv",
        "description": (
            "Generate a downloadable .docx CV tailored to a specific target role, built only "
            "from Tal's real experience (never invented). Use this when the user asks for a CV "
            "or resume tailored, customized, or targeted to a role or job posting. Both "
            "target_role and job_description are required — pass an empty string for "
            "job_description if the user did not provide one. If the target role is unclear, "
            "ask for it in prose instead of calling this tool."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "target_role": {
                    "type": "string",
                    "description": "The role or title to tailor the CV for, e.g. 'Staff Engineer'.",
                },
                "job_description": {
                    "type": "string",
                    "maxLength": JOB_DESCRIPTION_MAX_CHARS,
                    "description": (
                        "The job description to tailor against, or an empty string if none "
                        "was provided. Treated as untrusted data by the tailor step."
                    ),
                },
            },
            "required": ["target_role", "job_description"],
        },
    },
]


async def dispatch(
    tool_name: str, tool_input: dict[str, Any], client_ip: str | None = None
) -> dict[str, Any]:
    """Execute one tool call and return its result.

    Errors are returned as data, not raised — the LLM should see what failed and
    react sensibly rather than the chat blowing up. `client_ip` is optional and only
    used by the rate-limited `generate_tailored_cv` branch, so every other call site
    and its tests are unaffected.
    """
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        try:
            if tool_name == "get_profile":
                r = await client.get(f"{EXPERIENCE_API_URL}/api/v1/profile")
                r.raise_for_status()
                return {"profile": r.json()}

            if tool_name == "get_work_experience":
                r = await client.get(f"{EXPERIENCE_API_URL}/api/v1/experience")
                r.raise_for_status()
                experience = r.json()
                # `achievements` is authored only for the CV-tailoring flow
                # (get_experience_for_tailoring). Strip it here so it never rides
                # along into the chat context — this tool's payload and the outer
                # chat's truncation budget must stay exactly as they were before
                # the field existed.
                experience = [
                    {k: v for k, v in role.items() if k != "achievements"}
                    for role in experience
                ]
                company = (tool_input.get("company") or "").lower().strip()
                if company:
                    experience = [
                        role for role in experience
                        if company in role.get("company", "").lower()
                    ]
                return {"experience": experience}

            if tool_name == "get_technical_skills":
                r = await client.get(f"{EXPERIENCE_API_URL}/api/v1/skills")
                r.raise_for_status()
                return {"skills": r.json()}

            if tool_name == "get_persona_topic":
                topic = tool_input.get("topic", "all")
                path = "/persona" if topic == "all" else f"/persona/{quote(topic, safe='')}"
                r = await client.get(f"{PERSONA_API_URL}{path}")
                if r.status_code == 404:
                    return {"error": f"Topic '{topic}' not found. Call get_persona_topics to see available topics."}
                r.raise_for_status()
                return r.json()

            if tool_name == "get_persona_topics":
                r = await client.get(f"{PERSONA_API_URL}/topics")
                r.raise_for_status()
                return r.json()

            if tool_name == "get_cv_download_link":
                return {
                    "url": f"{EXPERIENCE_API_URL}/api/v1/cv-pdf",
                    "filename": "Tal_Shterzer_CV.pdf",
                    "note": "Direct download link for the latest CV PDF.",
                }

            if tool_name == "get_contact_info":
                return {
                    "email": CONTACT_EMAIL,
                    "linkedin": CONTACT_LINKEDIN,
                    "note": "Prefer LinkedIn for first contact unless email is more convenient.",
                }

            if tool_name == "generate_tailored_cv":
                if not _tailor_rate_ok(client_ip):
                    return {
                        "error": "Tailored-CV generation is rate limited (a few per hour). "
                        "Please try again later."
                    }
                target_role = (tool_input.get("target_role") or "").strip()
                if not target_role:
                    return {"error": "A target role is required to tailor a CV."}
                job_description = tool_input.get("job_description") or ""

                # Full experience payload (with achievements) + profile + skills.
                # An outage here raises httpx.HTTPError -> caught below as a clean error.
                exp = await client.get(f"{EXPERIENCE_API_URL}/api/v1/experience")
                exp.raise_for_status()
                prof = await client.get(f"{EXPERIENCE_API_URL}/api/v1/profile")
                prof.raise_for_status()
                sk = await client.get(f"{EXPERIENCE_API_URL}/api/v1/skills")
                sk.raise_for_status()

                llm = _anthropic_client()
                if llm is None:
                    return {"error": "Tailored-CV generation is unavailable right now."}
                try:
                    tailored = tailor_cv(
                        llm,
                        target_role=target_role,
                        job_description=job_description,
                        source_roles=exp.json(),
                        profile=prof.json(),
                        contact={"email": CONTACT_EMAIL, "linkedin": CONTACT_LINKEDIN},
                        skills=sk.json(),
                    )
                    path = render_cv(tailored)
                except TailorError as exc:
                    return {"error": f"Could not generate a tailored CV: {exc}"}
                return {
                    "download_token": register_download(path),
                    "target_role": target_role,
                    "note": "Tailored CV generated; a download link is attached to the reply.",
                }

            return {"error": f"Unknown tool: {tool_name}"}

        except httpx.HTTPError as exc:
            return {"error": f"Tool {tool_name} failed: {type(exc).__name__}: {exc}"}
