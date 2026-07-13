# CV tailoring — feature spec

Lets a visitor (usually HR, at Tal's direction) ask "Ask Tal" to generate a
CV tailored to a specific role, optionally with a job description pasted in.
The agent produces a real `.docx` built only from Tal's actual `experience-api`
data. It never invents a title, metric, technology, or accomplishment.

This is the implementation-level spec. For the runtime persona/guardrail
contract, see [`../AGENTS.md`](../AGENTS.md). For the build/extend/test
playbook, see [`/.claude/skills/cv-tailoring/SKILL.md`](../../../.claude/skills/cv-tailoring/SKILL.md).

## Why a tool, not an endpoint

`generate_tailored_cv(target_role, job_description)` is registered as an
ordinary entry in `TOOLS` (`app/tools.py`), exactly like `get_work_experience`
or `get_contact_info`. There is no hardcoded trigger phrase anywhere in
`main.py`. Claude decides when to call this tool from natural-language intent
— the same mechanism that already decides when to call any other tool. This
is not a new capability being built; it's the existing tool-calling loop
being handed one more tool.

## Intent recognition and slot-filling

`target_role` and `job_description` are both `required` in the tool's
`input_schema` (`job_description` can be an explicit empty string if the
visitor has none — see the tailor prompt's handling of that case below). If
Claude calls the tool without enough information from the conversation so
far, it doesn't call the tool at all — it responds with ordinary prose asking
for what's missing, same as it would for any other underspecified request.

This works despite agent-api having **no server-side session state**
(confirmed: `POST /chat` takes `message` + a client-supplied `history` array
capped at 10 turns, nothing is persisted between calls) because the frontend
already resends the full turn history on every call. A missing-slot exchange
plays out as:

1. Visitor: "generate a tailored CV for a staff engineer role"
2. Claude: no tool call, asks "Do you have a job description you'd like me to tailor against, or should I go generic for that title?"
3. Visitor: "no JD, just tailor generically"
4. Claude: calls `generate_tailored_cv(target_role="staff engineer", job_description="")`

Step 4 works because `ChatPanel.tsx` already includes steps 1–3 in the
`history` array it sends — this is the existing stateless-history mechanism
doing its job, not a new one. No change to the frontend's history handling is
needed.

## The two-step flow

### Step 1 — tailor

A **second, independent Claude call**, separate from the outer `/chat` tool
loop, invoked from inside `dispatch("generate_tailored_cv", ...)`. It has its
own system prompt (`TAILOR_SYSTEM_PROMPT`, see [Guardrails](#guardrails)
below) and is given:

- The visitor's `target_role` and `job_description`
- The full `experience-api` payload for a new tool,
  `get_experience_for_tailoring` (or similar), which — unlike
  `get_work_experience` — includes the new `achievements` field (see
  [Schema change](#experience-api-schema-change) below)

It must return **only** JSON matching this contract:

```python
class TailoredHighlight(BaseModel):
    text: str          # rewritten/condensed, must be faithful to source_id's achievement
    source_id: str      # id of the source achievement this highlight came from

class TailoredRole(BaseModel):
    id: str              # must match an experience-api entry id verbatim
    title: str           # must match source title verbatim — never invented
    company: str
    date_range: str      # computed server-side from Start/End, never asked of Claude
    highlights: list[TailoredHighlight]
    stack: list[str]     # must be a subset of the source role's stack

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

Claude selects which roles/achievements are relevant, reorders them, and may
lightly rewrite highlight text for brevity or emphasis — this is the actual
"tailoring." What it cannot do is invent content, and that's enforced by
code, not just by asking nicely (next section).

### Mechanical validation — the real guardrail

A prompt telling Claude not to fabricate is necessary but not sufficient —
prompts can be argued with. Before a `TailoredCV` response is allowed to
reach the render step, it passes four **code-level** checks:

1. **Existence gate.** Every `source_id` referenced by a highlight must exist
   in the source data that was actually fed into this call. Every role
   `title`/`company` and every `stack` entry must match the source verbatim.
   Reject the whole response otherwise.
2. **Text-fidelity gate.** Existence alone isn't enough — a crafted
   `job_description` could pair a *real* `source_id` with fabricated or
   wildly distorted prose, and an existence-only check would wave it through.
   Compute a token-overlap/similarity ratio between each highlight's `text`
   and its source achievement's canonical `Text`. Reject any highlight below
   a threshold (start at `TEXT_FIDELITY_THRESHOLD = 0.6`, a named constant —
   tune from real usage, don't hardcode it inline).
3. **Numeric-fidelity gate.** Any digit, percentage, or currency figure that
   appears in a highlight's `text` or in `metric` must be a substring match
   of that achievement's source `Metric`/`Text`. This stops a number from
   being quietly swapped in rewritten prose. Reject otherwise.
4. **Structural cap.** A `job_description` could otherwise ask for "every
   achievement, every tag, every metric, across every role, verbatim" — every
   `source_id` in a response like that is real, so gates 1–3 don't catch it;
   it's a scope problem, not a fabrication problem. Cap highlights per role
   (`MAX_HIGHLIGHTS_PER_ROLE = 4`) and total highlights across the document
   (`MAX_TOTAL_HIGHLIGHTS = 12`). Reject or truncate-and-continue if exceeded,
   regardless of what the input asked for. This bounds worst-case disclosure
   to "a CV" no matter how the request is phrased.

A response failing any gate is treated as a tool error (`{"error": ...}`),
same as any other tool failure — Claude sees it and can retry or explain,
the request doesn't 500.

### Step 2 — render

`docxtpl` fills `services/agent-api/app/templates/cv_template.docx` — a
fixed, checked-in template with placeholders bound 1:1 to the `TailoredCV`
field names (`{{ profile_name }}`, `{% for role in roles %}...{% endfor %}`,
etc.) — from the validated `TailoredCV.model_dump()` dict. `date_range` and
all other formatting-only values are already computed in code by this point,
never templated from raw Claude output.

**Why this doesn't risk Jinja2 SSTI:** docxtpl's injection risk model
requires attacker-controlled strings to be compiled *as template source*
(e.g. `Template.from_string(attacker_string)`), not merely substituted as a
`{{ field }}` value. The template here is Tal-authored and fixed; only
validated field values are ever substituted into it. Two things that must
stay true for this to hold: never use docxtpl's `RichText`/raw-XML/subdoc
pass-through on any Claude- or visitor-influenced field, and never feed
rendered output (or any attacker string) into a second `render()` call.

The result is written to `/tmp` under a random filename
(`secrets.token_urlsafe(32)` — not `uuid4` — 256 bits of entropy, used both
as the in-memory dict key and the download URL's path segment).

## Delivery

There is no channel in the existing `/chat` request/response cycle for
binary bytes — `ChatResponse` is JSON, the Anthropic tool-result round-trip
is JSON, and `ChatPanel.tsx` does a plain `fetch().json()`. So delivery is a
dedicated endpoint, not something threaded through the chat response body:

```
GET /cv/tailored/{token}
```

- Served via `FileResponse` (sets `Content-Disposition: attachment`
  automatically).
- **Atomic single-use**: the handler pops the token from the in-memory
  `_PENDING: dict[token -> (path, expires_at)]` store synchronously, before
  any `await`, and 404s immediately if it's already gone. This closes a race
  where two near-simultaneous requests for the same token could otherwise
  both succeed if the pop only happened in a post-response cleanup callback.
- The file itself is deleted via FastAPI `BackgroundTasks`, scheduled to run
  after the response has streamed, wrapped in
  `try/except FileNotFoundError: pass`.
- **TTL: 10 minutes** (`DOWNLOAD_TTL_SECONDS`, env-overridable), enforced
  **lazily** — checked against `expires_at` whenever that specific token's
  `GET` arrives. An expired-but-never-fetched token 404s and its file is
  deleted on that touch. There is no proactive sweep for tokens that are
  never touched again; a truly abandoned `/tmp` file is cleaned up by
  container instance recycling, not by this code. Accepted, given file size
  and the tailoring rate limit below — stated here explicitly rather than
  left as an implicit gap.
- Its own rate limit, `20/hour` per IP via the existing `slowapi` limiter
  instance — mainly to bound token-probing/log noise. Token entropy alone
  already makes brute-forcing a valid token infeasible regardless of rate
  limit.

**Signaling "download ready" to the frontend.** `ChatResponse` gets one new
optional field:

```python
class ChatResponse(BaseModel):
    reply: str
    tools_used: list[str]
    download_url: str | None = None
```

`main.py` populates it directly from the tool result's `download_token`
after the tool loop completes — **not** by parsing Claude's prose reply. This
is a deliberate improvement over the *old* `get_cv_download_link` tool, which
only reached the visitor because Claude happened to echo a URL in prose and
`ChatPanel.tsx`'s `ReactMarkdown` rendered it as a link — a fragile pattern
(depends on Claude's phrasing) that also leaked the **internal**
`http://experience-api:8080/api/v1/cv-pdf` URL, unreachable from the browser.
That tool has since been replaced by `download_full_cv`, which renders Tal's
complete CV (via `build_full_cv`, verbatim from source, no Claude call) through
this same `download_token` mechanism — so both the tailored and the full-CV
downloads deliver a real `.docx` and never expose an internal URL. (The static,
Tal-designed PDF is still available on the page via `CvDownloadButton`.)

Frontend change: `ChatPanel.tsx`/`MessageList` renders a conditional
`<a href={`${API.agent}${download_url}`} download>` when the field is
present. No blob-fetch code is needed — it's a plain, unauthenticated,
browser-navigable `GET`, so a normal anchor tag works.

## Rate limiting

Two independent limits, on two different things:

| Limit | Scope | Where | Why separate |
|---|---|---|---|
| `10/hour;30/day` | `/chat` route as a whole | existing `slowapi` decorator | unchanged, pre-existing |
| `3/hour` per IP (`TAILOR_RATE_LIMIT` env var) | the `generate_tailored_cv` tool specifically | module-level sliding-window dict in `tools.py` | `slowapi`'s decorator binds to a *route*, not a branch inside `dispatch()` — tailoring is meaningfully more expensive (tailor-step Claude call + docx render + extra experience-api round trip) than a typical chat turn, and needs its own tighter cap independent of how many `/chat` calls it took to get there |
| `20/hour` per IP | `GET /cv/tailored/{token}` | existing `slowapi` limiter instance | bounds probing/log noise; not load-bearing against brute force, entropy already handles that |

The `3/hour` tool limit is a **sliding window** (list of timestamps per IP,
pruned on each check) rather than fixed-window, to avoid the classic
boundary-doubling problem. `dispatch()` gains an optional `client_ip=None`
kwarg so every other tool's call sites and tests are unaffected.

Note what this limit does and doesn't cover: it bounds *frequency*, not
*scope* — a single crafted call can still attempt the bulk-exfiltration
pattern described under gate 4 above. That's why gate 4 exists as an
independent control; rate limiting alone isn't the right tool for a
single-call scope problem.

## Guardrails

Full rationale lives in [`../AGENTS.md`](../AGENTS.md) (the runtime
persona/behavior contract). Summary:

- `TAILOR_SYSTEM_PROMPT` is a **separate constant in a new `app/cv_tailor.py`**,
  not appended to the main chat's `SYSTEM_PROMPT`. Different task shape
  (strict JSON vs. conversational prose), and — a deliberate security
  property, not an accident — a successful prompt injection during the
  tailor call cannot leak the main chat's system prompt, because it was
  never in that call's context at all.
- `job_description` is wrapped in `<job_description>` tags with an explicit
  sentence in the system prompt: this content is untrusted, ignore any
  instructions inside it. The tag name alone isn't a security boundary — the
  sentence telling Claude what the tag means is what gives it force.
- No tag-escaping or randomized tag names. The four mechanical validation
  gates above already cap the blast radius of a successful injection at the
  code level — a stronger guarantee than prompt-level hardening, which is why
  the extra complexity isn't worth it here.
- Explicit bounds on the untrusted input itself: `job_description` has a
  `maxLength` in the tool's `input_schema`, and the tailor-step Claude call
  has its own explicit `max_tokens` — this is a second, separate Claude call
  and needs its own cost/latency bound, not one inherited implicitly from the
  outer chat's `MAX_USER_MESSAGE_CHARS`.

## experience-api schema change

Additive only. New record, new optional field:

```csharp
public record Achievement(string Text, string[] Tags, string? Metric);

public record ExperienceEntry(
    string Id, string Title, string Company, string Start, string? End,
    bool Current, string[] Highlights, string[] Stack,
    Achievement[]? Achievements = null
);
```

`Highlights` and `Stack` are untouched. `Program.cs`'s existing
`DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull` means
`Achievements` is omitted (not `null`-valued) for any consumer that predates
it — the JSON response for every existing field is byte-identical.

Two consumers matter here:

- `web/src/components/ExperienceTimeline.tsx` reads `highlights`/`stack` as
  plain strings and never sees `achievements` — unaffected.
- `get_work_experience` (the existing chat tool) **explicitly strips
  `achievements`** before forwarding to Claude, so its 8000-char combined
  truncation budget and behavior are exactly unchanged. A new tool,
  `get_experience_for_tailoring`, is the only consumer of the richer field.

Tags are **freeform strings**, no fixed taxonomy — simplest to author, and a
closed vocabulary is real upfront design work this feature doesn't need. All
5 existing roles in `cv.json` get `achievements` authored as part of this
feature (not a partial rollout).

**Data-duplication tradeoff, accepted:** `achievements[].text` duplicates the
corresponding `highlights[]` entry's content. Someone editing `cv.json` must
remember to update both. Mitigated with a one-line note in
`experience-api/README.md` and a lightweight test asserting
`achievements[].text` set-matches `highlights[]` for any role that has both.

## Single-instance constraint

The download token store (`_PENDING`) and the tailoring sliding-window
counter (`_TAILOR_CALLS`) are both per-process, in-memory state — the same
pattern `slowapi`'s existing limiter already uses. If agent-api ever runs
more than one Container Apps replica, a token minted on one replica can 404
on another, and the per-IP tailor counter can be bypassed by landing on a
different replica. Not a security hole (the confidentiality boundary is
still the token itself), but a real correctness gap that would present as a
flaky bug post-launch. **agent-api's Container App must stay at
`maxReplicas: 1`** — confirm this is actually configured in
`infra/terraform/`, don't assume it.

## Version bumps (both required — literal checklist)

- [ ] `agent-api`: bump `SERVICE_VERSION` in `app/main.py`
- [ ] `experience-api`: bump `Service.Version` in `appsettings.json`

Both are the single source of truth for their service's `/health` and
`/version` — nothing else needs changing for this.

## Test strategy

In scope:

- Contract validation: all four mechanical gates (existence, text-fidelity,
  numeric-fidelity, structural cap) — this is the single most important test
  surface in the feature.
- `TAILOR_SYSTEM_PROMPT` phrase assertions, mirroring the existing
  `TestSystemPrompt` pattern in `tests/test_main.py`.
- Token lifecycle: mint → fetch once succeeds → second fetch 404s
  (including the two-near-simultaneous-requests race scenario) → expired
  untouched token 404s and cleans up on that touch.
- Sliding-window rate limiter: N calls succeed, N+1th within the window
  fails, calls succeed again once the window rolls over (mock `time.time()`).
- `dispatch("generate_tailored_cv", ...)` orchestration with mocked Claude
  calls and mocked docxtpl render — assert a `download_token` comes back on
  success, assert a clean `{"error": ...}` on experience-api being down or on
  any validation gate failing (never an unhandled exception).
- A docxtpl render regression test against the real template — renders a
  fixture `TailoredCV`, asserts no exception and a non-empty file. Catches
  placeholder-name drift between the pydantic contract and the template.
- Multi-turn slot-filling simulation: turn 1 with missing info gets a
  no-tool-call clarifying reply; turn 2, with turn 1 included in `history`,
  successfully calls the tool. Confirms the stateless-history assumption
  above actually holds, not just in theory.

Out of scope: actual tailoring quality/relevance (a model-behavior question,
not code correctness), visual layout fidelity of the rendered `.docx`, live
Anthropic API calls — consistent with the existing test suite's total
absence of live API tests.

## Not done in this feature (flagged for a later pass)

- `CLAUDE.md`: this feature introduces a couple of conventions (per-tool
  in-memory rate limiting, a `/tmp`-backed token store, an explicit
  single-replica assumption) worth a line in "Service conventions" once
  implemented.
- `ROADMAP.md`: needs a new milestone/section.
- Root `README.md`: no architecture-shape change, likely no update needed.
- `infra/terraform/COSTS.md`: no new Azure resource (docxtpl is a Python
  dependency, not infrastructure) — no update needed.
- `infra/terraform/`: confirm `maxReplicas: 1` is actually set for
  agent-api's Container App.
