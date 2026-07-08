# AGENTS.md

Tool-agnostic dev conventions for anyone or anything writing code in this repo.
This is a sibling to [`CLAUDE.md`](CLAUDE.md), not a replacement for it —
`CLAUDE.md` is the authoritative source for architecture rules, tech stack,
and design language. This file exists so non-Claude tools have somewhere to
look; it points at `CLAUDE.md` rather than duplicating it, since two copies
of the same rules drift.

**Read `CLAUDE.md` first.** Every rule in it applies regardless of which tool
you're using to write code.

## Repo layout

```
web/                          React 19 + Vite + TypeScript frontend
services/experience-api/      .NET 10 — work history, skills, CV data
services/persona-api/         Python + FastAPI — non-CV persona content
services/agent-api/           Python + FastAPI — the "Ask Tal" chat agent
tests/                        Per-service test projects
infra/terraform/              IaC for Azure Container Apps + Cloudflare Pages
.github/workflows/            Path-filtered CI/CD per service
docker-compose.yml            Local multi-service run
CLAUDE.md                     Architecture rules — read this first
ROADMAP.md                    Milestone tracker
```

Each service is independent: own language, own dependencies, own Dockerfile,
own README. There is no `common/` or `shared/` directory. If you're tempted
to create one, stop — see `CLAUDE.md` rule 3.

## Running services locally

```bash
docker compose up          # all services, wired together
```

To run one service in isolation, see that service's own `README.md` — each
one documents its local run command, required environment variables, and
default ports.

## Tests

| Service | Location | Command |
|---|---|---|
| `experience-api` | `tests/experience-api/ExperienceApi.Tests/` | `dotnet test tests/experience-api/ExperienceApi.Tests/` |
| `persona-api` | `services/persona-api/tests/` | `uv run pytest` (from that directory) |
| `agent-api` | `services/agent-api/tests/` | `uv run pytest` (from that directory) |
| `web` | co-located with source | see `web/README.md` |

Tests are mocked at each service's external boundary (HTTP clients, the
Anthropic SDK client). No test suite makes live calls to another service or
to a real LLM.

## When extending

1. Identify which service the feature belongs to. If it doesn't fit any
   existing service, ask whether a new one is justified — see `CLAUDE.md`'s
   "When extending" section.
2. Bump that service's version (returned by `/health` and `/version`).
3. Update `CLAUDE.md` if the change introduces a new convention (a new
   pattern for rate limiting, a new kind of ephemeral state, etc.) — not
   every feature needs this, but a pattern other work will reuse does.
4. Update root `README.md` only if the architecture's shape changes (a new
   service, a new external dependency, a new deployment target). Most
   features don't need this.
5. Never add a database, queue, or cache without explicit human approval.
   Never share code between services. These are the two mistakes this repo
   exists to avoid — see `CLAUDE.md` for why.
