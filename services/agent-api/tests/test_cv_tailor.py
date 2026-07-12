"""Unit tests for the CV-tailoring step (app/cv_tailor.py).

The four mechanical validation gates are the feature's actual correctness surface
— a bug here is a fabricated CV, not a UI glitch — so they get the most coverage,
independently and in combination. Plus guardrail-phrase assertions on the tailor
system prompt (mirroring TestSystemPrompt in test_main.py) and a few tailor_cv
orchestration tests with a mocked Claude call.
"""
from copy import deepcopy
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.cv_tailor import (
    JOB_DESCRIPTION_MAX_CHARS,
    MAX_HIGHLIGHTS_PER_ROLE,
    MAX_TOTAL_HIGHLIGHTS,
    TAILOR_SYSTEM_PROMPT,
    TailoredCV,
    TailoredHighlight,
    TailoredRole,
    TailorError,
    tailor_cv,
    validate_tailored_cv,
)

# Four roles so the total-highlights cap (12) can be exceeded without exceeding
# the per-role cap (4) — 4 roles x 4 = 16 > 12.
SOURCE = [
    {
        "id": "smartlinx",
        "title": "Cloud Architect",
        "company": "SmartLinx",
        "start": "2025-01", "end": "2026-06", "current": False,
        "stack": ["C#", "Azure", "React"],
        "achievements": [
            {"text": "Re-platformed a legacy monolith onto Azure for 10,000 concurrent users.",
             "metric": "10,000 concurrent users", "tags": ["azure"]},
            {"text": "Led a team of 11 developers and devops engineers.",
             "metric": "11 developers", "tags": ["leadership"]},
        ],
    },
    {
        "id": "pra-group",
        "title": "Systems Architect",
        "company": "PRA Group",
        "start": "2018-01", "end": "2024-12", "current": False,
        "stack": ["C++", "Oracle"],
        "achievements": [
            {"text": "Cut annual infrastructure cost from $2M to roughly $17K.",
             "metric": "cut annual cost from $2M to roughly $17K", "tags": ["cost"]},
        ],
    },
    {
        "id": "ness",
        "title": "Development Manager",
        "company": "Ness",
        "start": "2012-01", "end": "2016-12", "current": False,
        "stack": ["Java"],
        "achievements": [
            {"text": "Ran a team of 8 across developers, analysts, and QA.",
             "metric": "team of 8", "tags": ["leadership"]},
        ],
    },
    {
        "id": "anyclip",
        "title": "Team Leader",
        "company": "AnyClip",
        "start": "2010-01", "end": "2012-01", "current": False,
        "stack": ["Python"],
        "achievements": [
            {"text": "Led a 9-person engineering team.",
             "metric": "9-person team", "tags": ["leadership"]},
        ],
    },
]

PROFILE = {"name": "Tal Shterzer", "tagline": "Engineering Manager", "summary": "17+ years."}
CONTACT = {"email": "shterzer@gmail.com", "linkedin": "https://linkedin.com/in/talshterzer"}


def _valid_cv() -> TailoredCV:
    """A minimal TailoredCV that passes all four gates against SOURCE."""
    return TailoredCV(
        target_role="Staff Engineer",
        generated_summary="Architect and manager.",
        roles=[
            TailoredRole(
                id="smartlinx", title="Cloud Architect", company="SmartLinx",
                stack=["C#", "Azure"],
                highlights=[
                    TailoredHighlight(
                        text="Re-platformed a legacy monolith onto Azure for 10,000 concurrent users.",
                        source_id="smartlinx"),
                    TailoredHighlight(
                        text="Led a team of 11 developers and devops engineers.",
                        source_id="smartlinx"),
                ],
            ),
            TailoredRole(
                id="pra-group", title="Systems Architect", company="PRA Group",
                stack=["Oracle"],
                highlights=[
                    TailoredHighlight(
                        text="Cut annual infrastructure cost from $2M to roughly $17K.",
                        source_id="pra-group"),
                ],
            ),
        ],
        skills=["C#", "Azure"],
    )


class TestValidCv:
    def test_passes(self):
        validate_tailored_cv(_valid_cv(), SOURCE)  # must not raise

    def test_light_rewrite_passes(self):
        """Condensing/rephrasing a source achievement is allowed — that's the tailoring."""
        cv = _valid_cv()
        cv.roles[0].highlights[0].text = "Re-platformed the monolith onto Azure for 10,000 users."
        validate_tailored_cv(cv, SOURCE)

    def test_comma_stripped_number_passes(self):
        """A rewritten '10000' still matches source '10,000' (comma-normalized)."""
        cv = _valid_cv()
        cv.roles[0].highlights[0].text = (
            "Re-platformed a legacy monolith onto Azure for 10000 concurrent users."
        )
        validate_tailored_cv(cv, SOURCE)


class TestExistenceGate:
    def test_unknown_role_id_rejected(self):
        cv = _valid_cv()
        cv.roles[0].id = "does-not-exist"
        cv.roles[0].highlights[0].source_id = "does-not-exist"
        cv.roles[0].highlights[1].source_id = "does-not-exist"
        with pytest.raises(TailorError, match="not a real experience entry"):
            validate_tailored_cv(cv, SOURCE)

    def test_altered_title_rejected(self):
        cv = _valid_cv()
        cv.roles[0].title = "Chief Executive Officer"
        with pytest.raises(TailorError, match="title does not match"):
            validate_tailored_cv(cv, SOURCE)

    def test_altered_company_rejected(self):
        cv = _valid_cv()
        cv.roles[0].company = "Google"
        with pytest.raises(TailorError, match="company does not match"):
            validate_tailored_cv(cv, SOURCE)

    def test_invented_stack_entry_rejected(self):
        cv = _valid_cv()
        cv.roles[0].stack.append("Kubernetes")  # not in smartlinx source stack
        with pytest.raises(TailorError, match="source stack"):
            validate_tailored_cv(cv, SOURCE)

    def test_cross_role_source_id_rejected(self):
        """A highlight under smartlinx may not cite pra-group's achievement."""
        cv = _valid_cv()
        cv.roles[0].highlights[0].source_id = "pra-group"
        with pytest.raises(TailorError, match="does not match its role"):
            validate_tailored_cv(cv, SOURCE)


class TestTextFidelityGate:
    def test_fabricated_prose_with_real_source_id_rejected(self):
        """Real source_id, invented prose — existence alone would wave this through."""
        cv = _valid_cv()
        cv.roles[0].highlights[0].text = (
            "Directed international peace negotiations between warring nations."
        )
        with pytest.raises(TailorError, match="not faithful"):
            validate_tailored_cv(cv, SOURCE)

    def test_role_without_achievements_fails_closed(self):
        """No achievements to verify against => cannot pass fidelity => rejected."""
        source = deepcopy(SOURCE)
        source[0]["achievements"] = []
        with pytest.raises(TailorError, match="not faithful"):
            validate_tailored_cv(_valid_cv(), source)


class TestNumericFidelityGate:
    def test_swapped_number_rejected(self):
        """Text stays faithful (passes gate 2) but the metric is inflated."""
        cv = _valid_cv()
        cv.roles[0].highlights[1].text = "Led a team of 99 developers and devops engineers."
        with pytest.raises(TailorError, match="number absent from the source"):
            validate_tailored_cv(cv, SOURCE)

    def test_inflated_currency_rejected(self):
        cv = _valid_cv()
        cv.roles[1].highlights[0].text = "Cut annual infrastructure cost from $9M to roughly $17K."
        with pytest.raises(TailorError, match="number absent from the source"):
            validate_tailored_cv(cv, SOURCE)


class TestStructuralCapGate:
    def test_too_many_highlights_in_one_role_rejected(self):
        cv = _valid_cv()
        faithful = cv.roles[0].highlights[0]
        cv.roles[0].highlights = [faithful.model_copy() for _ in range(MAX_HIGHLIGHTS_PER_ROLE + 1)]
        with pytest.raises(TailorError, match=f"max {MAX_HIGHLIGHTS_PER_ROLE}"):
            validate_tailored_cv(cv, SOURCE)

    def test_too_many_total_highlights_rejected(self):
        """16 highlights across 4 roles (4 each) — every id real, only the total is over."""
        roles = []
        for src in SOURCE:
            faithful = TailoredHighlight(text=src["achievements"][0]["text"], source_id=src["id"])
            roles.append(TailoredRole(
                id=src["id"], title=src["title"], company=src["company"],
                highlights=[faithful.model_copy() for _ in range(MAX_HIGHLIGHTS_PER_ROLE)],
            ))
        cv = TailoredCV(target_role="X", generated_summary="Y", roles=roles)
        assert sum(len(r.highlights) for r in cv.roles) > MAX_TOTAL_HIGHLIGHTS
        with pytest.raises(TailorError, match=f"max {MAX_TOTAL_HIGHLIGHTS}"):
            validate_tailored_cv(cv, SOURCE)


class TestGateOrdering:
    def test_existence_checked_before_fidelity(self):
        """A bogus id AND fabricated prose surfaces as the existence failure first."""
        cv = _valid_cv()
        cv.roles[0].id = "ghost"
        cv.roles[0].highlights[0].source_id = "ghost"
        cv.roles[0].highlights[1].source_id = "ghost"
        cv.roles[0].highlights[0].text = "Completely invented accomplishment prose."
        with pytest.raises(TailorError, match="not a real experience entry"):
            validate_tailored_cv(cv, SOURCE)


class TestTailorSystemPrompt:
    def test_forbids_fabrication(self):
        assert "no fabrication" in TAILOR_SYSTEM_PROMPT.lower()
        assert "never invent" in TAILOR_SYSTEM_PROMPT.lower()

    def test_marks_job_description_untrusted(self):
        assert "untrusted" in TAILOR_SYSTEM_PROMPT.lower()
        assert "ignore any instruction" in TAILOR_SYSTEM_PROMPT.lower()

    def test_demands_json_only(self):
        lower = TAILOR_SYSTEM_PROMPT.lower()
        assert "json object" in lower
        assert "no markdown" in lower or "no prose" in lower


def _mock_client(json_text: str) -> MagicMock:
    block = SimpleNamespace(type="text", text=json_text)
    response = SimpleNamespace(content=[block])
    client = MagicMock()
    client.messages.create.return_value = response
    return client


# A raw model response citing real SOURCE data, deliberately with WRONG contact /
# date_range fields to prove the server overwrites them.
_GOOD_RESPONSE = """{
  "target_role": "ignored-echo",
  "generated_summary": "Architect and manager.",
  "contact_email": "fake@evil.test",
  "contact_linkedin": "https://linkedin.com/in/impostor",
  "profile_name": "Someone Else",
  "profile_tagline": "Impostor",
  "roles": [
    {
      "id": "smartlinx", "title": "Cloud Architect", "company": "SmartLinx",
      "date_range": "made up dates",
      "stack": ["C#"],
      "highlights": [
        {"text": "Re-platformed a legacy monolith onto Azure for 10,000 concurrent users.",
         "source_id": "smartlinx"}
      ]
    }
  ],
  "skills": ["C#", "Azure"]
}"""


class TestTailorCall:
    def test_parses_validates_and_injects_authoritative_fields(self):
        client = _mock_client(_GOOD_RESPONSE)
        cv = tailor_cv(
            client, target_role="Staff Engineer", job_description="",
            source_roles=SOURCE, profile=PROFILE, contact=CONTACT,
        )
        # Contact/profile come from source, never from the model.
        assert cv.contact_email == CONTACT["email"]
        assert cv.contact_linkedin == CONTACT["linkedin"]
        assert cv.profile_name == PROFILE["name"]
        assert cv.profile_tagline == PROFILE["tagline"]
        # target_role echoes the request, not the model's field.
        assert cv.target_role == "Staff Engineer"
        # date_range computed server-side from Start/End.
        assert cv.roles[0].date_range == "Jan 2025 – Jun 2026"

    def test_strips_markdown_fences(self):
        client = _mock_client("```json\n" + _GOOD_RESPONSE + "\n```")
        cv = tailor_cv(
            client, target_role="Staff Engineer", job_description="",
            source_roles=SOURCE, profile=PROFILE, contact=CONTACT,
        )
        assert cv.roles[0].id == "smartlinx"

    def test_non_json_output_raises_tailor_error(self):
        client = _mock_client("Sorry, I can't do that.")
        with pytest.raises(TailorError):
            tailor_cv(client, target_role="X", job_description="",
                      source_roles=SOURCE, profile=PROFILE, contact=CONTACT)

    def test_gate_failure_raises_tailor_error(self):
        bad = _GOOD_RESPONSE.replace('"id": "smartlinx"', '"id": "totally-fake"')
        client = _mock_client(bad)
        with pytest.raises(TailorError):
            tailor_cv(client, target_role="X", job_description="",
                      source_roles=SOURCE, profile=PROFILE, contact=CONTACT)

    def test_long_job_description_is_truncated_before_the_call(self):
        client = _mock_client(_GOOD_RESPONSE)
        oversized = "A" * (JOB_DESCRIPTION_MAX_CHARS + 500)
        tailor_cv(client, target_role="X", job_description=oversized,
                  source_roles=SOURCE, profile=PROFILE, contact=CONTACT)
        sent = client.messages.create.call_args.kwargs["messages"][0]["content"]
        assert "A" * JOB_DESCRIPTION_MAX_CHARS in sent
        assert "A" * (JOB_DESCRIPTION_MAX_CHARS + 1) not in sent
