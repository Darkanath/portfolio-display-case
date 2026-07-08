---
name: cv-tailoring
description: Build, extend, or test the CV-tailoring feature in agent-api — the tool-calling flow that generates a tailored .docx CV from experience-api data. Use when working on generate_tailored_cv, the tailor/render pipeline, the download endpoint, the achievements schema in experience-api, or their tests.
---

# CV tailoring

Implementation playbook for the CV-tailoring feature. Full spec:
[`services/agent-api/docs/cv-tailoring.md`](../../../services/agent-api/docs/cv-tailoring.md).
Runtime guardrail contract: [`services/agent-api/AGENTS.md`](../../../services/agent-api/AGENTS.md).
This file is the "how do I touch this code" summary; those two are the
"what is this and why" sources of truth — if this file and either of those
disagree, they win, fix this file.

## The shape of the feature

A tool (`generate_tailored_cv`) in `services/agent-api/app/tools.py`'s
`TOOLS`/`dispatch()`, not a public REST endpoint, not a hardcoded trigger
phrase. Two decoupled steps inside `dispatch()`:

1. **Tailor** — a second, independent Claude call (own system prompt, own
   module: `app/cv_tailor.py`) turns `target_role` + `job_description` +
   real experience-api data into a structured JSON contract (`TailoredCV`).
   Guardrail prompt lives here, not in `main.py`'s `SYSTEM_PROMPT` — see
   *why* in `services/agent-api/AGENTS.md`.
2. **Render** — `docxtpl` fills a fixed template
   (`app/templates/cv_template.docx`) from the validated JSON, writes to
   `/tmp` under a random token, nothing persisted beyond a short in-memory
   entry keyed by that token.

Delivery to the browser is a **separate endpoint**
(`GET /cv/tailored/{token}`), not part of `/chat`'s response — `/chat` is
JSON in/out with no binary channel. `main.py` threads a `download_token`
from the tool result into a new `ChatResponse.download_url` field; the
frontend renders it as a plain link. Don't try to stream the file through
the tool-result/chat-response path — it doesn't have one.

## The JSON contract

```python
class TailoredHighlight(BaseModel):
    text: str
    source_id: str

class TailoredRole(BaseModel):
    id: str
    title: str
    company: str
    date_range: str      # computed in code from Start/End — never ask Claude for this
    highlights: list[TailoredHighlight]
    stack: list[str]

class TailoredCV(BaseModel):
    target_role: str
    generated_summary: str
    roles: list[TailoredRole]
    skills: list[str]
    contact_email: str
    contact_linkedin: str
    profile_name: str
    profile_tagline: str
```

`docxtpl` template placeholders bind 1:1 to these field names
(`{{ profile_name }}`, `{% for role in roles %}...{% endfor %}`). If you
rename a pydantic field, rename the matching placeholder in the same commit —
docxtpl raises at render time on a mismatch, which is exactly the regression
test described below catching it.

## The mechanical validation gates — implement all four, not just one

This is the part most likely to be under-built if someone reads "check
`source_id` exists" and stops there. Full rationale in the spec; the four
gates, in the order they should run:

1. **Existence** — every `source_id`/title/company/stack value is real.
2. **Text fidelity** — token-overlap ratio between highlight `text` and the
   source achievement's `Text`, threshold `TEXT_FIDELITY_THRESHOLD = 0.6`
   (named constant, not inline). *Existence of a real `source_id` is not
   sufficient on its own* — a crafted `job_description` can pair a real
   citation with fabricated prose.
3. **Numeric fidelity** — every digit/%/currency figure in the output is a
   substring of the source `Metric`/`Text`.
4. **Structural cap** — `MAX_HIGHLIGHTS_PER_ROLE = 4`,
   `MAX_TOTAL_HIGHLIGHTS = 12`. Closes the "dump everything verbatim" scope
   hole that gates 1–3 don't catch (every id would still be real).

A response failing any gate becomes `{"error": ...}` from `dispatch()` — same
pattern as every other tool failure in this codebase, never an unhandled
exception.

## Rate limiting — two different limiters, don't conflate them

- The tailoring tool itself: `3/hour` per IP, sliding window, in a
  module-level dict in `tools.py`. This is *not* the existing `slowapi`
  `@limiter.limit("10/hour;30/day")` on `/chat` — that binds to the route,
  this binds to one specific expensive branch inside `dispatch()`.
- The download endpoint: `20/hour` per IP via the existing `slowapi`
  instance — a normal route-level decorator, unlike the tool limiter above.

`dispatch()` needs an optional `client_ip=None` kwarg threaded through from
`main.py` (via `get_remote_address(request)`, already imported for slowapi)
so the tailoring branch can check it — keep it optional so every other tool
call site and its existing tests are untouched.

## Download token mechanics

- `secrets.token_urlsafe(32)`, not `uuid4` — this is a capability token, use
  the entropy-appropriate primitive.
- Claim atomically: `dict.pop(token, None)` synchronously, before any
  `await`, at the top of the `GET /cv/tailored/{token}` handler. 404
  immediately if already gone. This is what makes single-use actually
  single-use — deferring the pop to a post-response `BackgroundTasks`
  callback leaves a race window for two near-simultaneous requests.
- Delete the `/tmp` file via `BackgroundTasks` after the response streams,
  `try/except FileNotFoundError: pass`.
- 10-minute TTL, checked lazily on that token's next `GET` — no background
  sweep. An abandoned, never-fetched file relies on container recycling for
  cleanup. This is accepted and documented, not a bug to fix.

## experience-api schema change

Additive only — new nullable `Achievements` array on `ExperienceEntry`,
`Highlights`/`Stack` untouched. Details and the C# shape are in the spec.
Two things to not get wrong:

- The **existing** `get_work_experience` tool must explicitly strip
  `achievements` from what it forwards to Claude — don't let the new field
  silently ride along and eat into that tool's 8000-char truncation budget.
- `achievements[].text` should mirror the corresponding `highlights[]`
  entry when you author `cv.json` content — there's a set-equality test for
  this, keep it passing.

## Test strategy

Write these, in roughly this priority order:

1. The four mechanical validation gates (this is the feature's actual
   correctness surface — a bug here is a fabricated CV, not a UI glitch).
2. `TAILOR_SYSTEM_PROMPT` guardrail-phrase assertions, same style as
   `TestSystemPrompt` in `tests/test_main.py`.
3. Token lifecycle: single successful fetch, second fetch 404s, expired
   fetch 404s and cleans up, two-near-simultaneous-requests race.
4. Sliding-window rate limiter with mocked `time.time()`.
5. `dispatch()` orchestration with mocked Claude calls and mocked docxtpl
   render — success path returns `download_token`; experience-api down, or
   any gate failing, returns a clean `{"error": ...}`.
6. A docxtpl render regression test against the **real** template file —
   catches placeholder/field-name drift as a build-time-ish failure instead
   of a runtime one.
7. Multi-turn slot-filling: turn 1 (missing info) gets a no-tool-call
   clarifying reply; turn 2, with turn 1 in `history`, successfully calls
   the tool.

Don't bother testing: actual tailoring quality/relevance (model behavior,
not code), visual layout of the rendered docx, or anything against a live
Anthropic API — none of this codebase's tests do that, and this feature
shouldn't be the first.

## Constraints inherited from the rest of the repo

- No shared code with `experience-api` — the C# schema and the Python
  contract are two independent things that happen to agree on shape by
  convention, not by import.
- No database, queue, or cache. The token store and rate-limit counters are
  in-process dicts, same category as the existing `slowapi` limiter.
- `agent-api` must stay at `maxReplicas: 1` — both new in-memory stores
  assume a single process. If you're touching `infra/terraform/`, don't
  relax this without redesigning the storage.
- Every write goes to `/tmp`, nothing else, nothing persisted longer than
  the 10-minute TTL.
