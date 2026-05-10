"""Tool definitions for the Ask Tal agent.

These are the only side effects the LLM can produce. Each tool maps to a small
function that calls one of the data services. The agent has no direct access
to anything else.
"""

from __future__ import annotations

import os
from typing import Any

import httpx

EXPERIENCE_API_URL = os.environ.get("EXPERIENCE_API_URL", "http://experience-api:8080")
PERSONA_API_URL = os.environ.get("PERSONA_API_URL", "http://persona-api:8080")
SITE_BASE_URL = os.environ.get("SITE_BASE_URL", "http://localhost:5173")

TIMEOUT = httpx.Timeout(5.0, connect=3.0)


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
            "Retrieve content from Tal's non-CV side: storytelling, tabletop roleplaying, "
            "scenario design, reading, hobbies. Use this when the user asks about Tal as a "
            "person beyond his professional work."
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
]


async def dispatch(tool_name: str, tool_input: dict[str, Any]) -> dict[str, Any]:
    """Execute one tool call and return its result.

    Errors are returned as data, not raised — the LLM should see what failed and
    react sensibly rather than the chat blowing up.
    """
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        try:
            if tool_name == "get_profile":
                r = await client.get(f"{EXPERIENCE_API_URL}/profile")
                r.raise_for_status()
                return {"profile": r.json()}

            if tool_name == "get_work_experience":
                r = await client.get(f"{EXPERIENCE_API_URL}/experience")
                r.raise_for_status()
                experience = r.json()
                company = (tool_input.get("company") or "").lower().strip()
                if company:
                    experience = [
                        role for role in experience
                        if company in role.get("company", "").lower()
                    ]
                return {"experience": experience}

            if tool_name == "get_technical_skills":
                r = await client.get(f"{EXPERIENCE_API_URL}/skills")
                r.raise_for_status()
                return {"skills": r.json()}

            if tool_name == "get_persona_topic":
                topic = tool_input.get("topic", "all")
                path = "/persona" if topic == "all" else f"/persona/{topic}"
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
                    "url": f"{EXPERIENCE_API_URL}/cv-pdf",
                    "filename": "Tal_Shterzer_CV.pdf",
                    "note": "Direct download link for the latest CV PDF.",
                }

            if tool_name == "get_contact_info":
                return {
                    "email": "shterzer@gmail.com",
                    "linkedin": "https://linkedin.com/in/talshterzer",
                    "note": "Prefer LinkedIn for first contact unless email is more convenient.",
                }

            return {"error": f"Unknown tool: {tool_name}"}

        except httpx.HTTPError as exc:
            return {"error": f"Tool {tool_name} failed: {type(exc).__name__}: {exc}"}
