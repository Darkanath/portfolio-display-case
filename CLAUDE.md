# Portfolio Display Case — Project Rules

This repository is Tal Shterzer's professional portfolio. It exists to demonstrate
microservices architecture, polyglot development, cloud-native deployment, and
AI integration to potential employers and collaborators.

The architecture is itself part of the message. Honor it.

## Architecture rules — DO NOT VIOLATE

1. **Three independent services.** `experience-api`, `persona-api`, `agent-api`.
   The frontend calls each directly. No service-to-service calls **except**
   from `agent-api`, which is allowed to call the other two as part of its
   tool-calling behavior.
2. **No shared database.** Data lives as JSON files inside each service's
   container image. The "schema" is the JSON file. The "migration" is a git commit.
3. **No shared code.** No `common/` or `shared/` library. If two services need the
   same logic, duplicate it. Duplication is preferred over coupling.
4. **No secrets in the frontend.** The Anthropic API key lives only in `agent-api`'s
   environment. The frontend never sees it.
5. **No databases, queues, or caches added without explicit human approval.**
   The point of this project is restraint.

## Tech stack — fixed

| Component | Stack |
|---|---|
| `web/` | React 19 + Vite + TypeScript + Tailwind CSS |
| `services/experience-api/` | .NET 10 minimal API, C# |
| `services/persona-api/` | Python 3.13 + FastAPI + uv |
| `services/agent-api/` | Python 3.13 + FastAPI + uv + Anthropic SDK |
| Container host | Azure Container Apps (Consumption plan, scale-to-zero) |
| Image registry | GitHub Container Registry (ghcr.io) |
| Frontend host | Cloudflare Pages |
| IaC | Terraform |
| CI/CD | GitHub Actions, path-filtered per service, OIDC federated auth to Azure |

If a fallback is needed: .NET 9 for the .NET service is acceptable. Python 3.12
is acceptable. Anything else requires human approval.

## Service conventions

Every service MUST expose:

- `GET /health` → `{"status": "ok", "service": "<name>", "version": "<semver>"}` (200)
- `GET /version` → plain text semver (e.g. `1.2.3`)

Every service:

- Logs structured JSON, single line per event, to stdout
- Listens on the port set by environment variable `PORT` (default 8080)
- Never writes to disk outside `/tmp`
- Has a `Dockerfile` that produces an image runnable as a non-root user
- Has a `README.md` explaining what it does and how to run it locally

### agent-api CV-tailoring — in-memory state & single replica

The CV-tailoring feature keeps two **per-process, in-memory** stores in
`agent-api`: a single-use, `/tmp`-backed download-token store (~10-minute TTL)
and a per-tool sliding-window rate limiter. These are ephemeral process state,
**not** a database, queue, or cache — they don't fall under the rule-5 approval
gate — but they assume a single process. **agent-api must stay at
`maxReplicas: 1`** (`infra/terraform/main.tf`); on more than one replica a token
minted on one replica 404s on another and the per-IP counter can be bypassed.

Per-tool in-memory rate limiting (a module-level dict in `tools.py`) is the
accepted pattern for an expensive tool branch — distinct from, and independent
of, the route-level `slowapi` limit on `/chat`.

## Frontend conventions

- TypeScript strict mode, no `any` without justifying comment
- Tailwind for styling, no CSS-in-JS libraries
- API base URLs come from `VITE_EXPERIENCE_API`, `VITE_PERSONA_API`, `VITE_AGENT_API`
- No client-side state library in v1 (React state + URL state is enough)
- Accessibility: every interactive element keyboard-reachable, color contrast ≥ AA

## Design language

- Body: Inter
- Display headings: Instrument Serif
- Mono: JetBrains Mono
- Accent color: teal-500 (`#14b8a6`), used sparingly
- Dark mode is the default; light mode available via toggle
- Motion is subtle: fade-up on scroll, soft hover lifts, no parallax, no scroll-jacking

## Things to never do in this repo

- Add a database, message queue, or cache
- Share code between services via a `common`/`shared` library
- Commit secrets, `.env` files with real values, or API keys
- Put secrets in frontend code, including via Vite env vars that get bundled
- Add features without bumping the version returned by `/health`
- Add a JavaScript backend to "match the frontend stack" — the polyglot is the point
- Replace JSON files with a database "for flexibility" — the point is restraint
- Introduce a heavyweight CSS framework or UI kit — Tailwind + handwritten components

## Cost discipline

This project must run for under $5/month at typical traffic. Before adding any
Azure resource that costs money outside the free grant, document the expected
monthly cost in `infra/terraform/COSTS.md`.

## When extending

When asked to add a feature:

1. First identify which service it belongs to. If it doesn't fit any, ask whether
   a new service is justified rather than overloading an existing one.
2. Update the relevant service's `version` in `/health` and `/version`.
3. Update this file if a new convention is introduced.
4. Update the root `README.md` if the architecture changes shape.

## Voice for user-facing copy

Tal speaks in clear, direct sentences. No marketing language. No "We're passionate
about...". No "Welcome to my portfolio!". Show, don't tell. The architecture is
the demo; the words are scaffolding.
