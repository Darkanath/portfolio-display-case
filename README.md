# Portfolio Display Case

This repository is itself a demonstration. The code, architecture, and operational
choices are deliberate signals about how I think and work.

**Live site:** _(coming soon)_

## What this is

A three-service microservices application backing a single-page portfolio.

```
┌─────────────────────────────────────────────────────────────┐
│  Cloudflare Pages                                           │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  web (React + Vite + TypeScript)                    │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────┬──────────────┬──────────────┬───────────────────┘
           │              │              │
           ▼              ▼              ▼
   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
   │ experience- │ │  persona-   │ │   agent-    │
   │     api     │ │     api     │ │     api     │
   │   (.NET 10) │ │  (Python)   │ │  (Python +  │
   │             │ │             │ │  Anthropic) │
   └─────────────┘ └─────────────┘ └─────────────┘
            Azure Container Apps (scale-to-zero)
```

The frontend talks to each service directly. The agent talks to the other two
server-side as part of its tool-calling. There is no shared database, no shared
code, and no inter-service messaging beyond that. Each service can be deployed,
scaled, and reasoned about independently. This is what "microservices" is
supposed to mean.

## Why three different stacks

The polyglot is deliberate:

- **.NET 10** for the experience API: it's my primary stack, and the CV data
  has the clearest schema, so a strongly-typed minimal API is the natural fit.
- **Python + FastAPI** for the persona API: simpler service, less ceremony,
  and a chance to show I'm comfortable outside .NET.
- **Python + FastAPI + Anthropic SDK** for the agent API: Python's LLM ecosystem
  is the most mature, so this is where Python earns its keep.

Match the tool to the problem.

## Running locally

```bash
docker compose up
```

Then visit http://localhost:5173.

You'll need an Anthropic API key in `.env` for the agent service to work:

```bash
cp .env.example .env
# edit .env, set ANTHROPIC_API_KEY
```

The frontend and the two data APIs work fine without the agent — the chat
panel will just be disabled.

## Costs

| Item | Cost |
|---|---|
| Cloudflare Pages | $0 |
| Azure Container Apps (free grant: 180k vCPU-s, 360k GiB-s, 2M req/mo) | $0 at portfolio traffic |
| GitHub Container Registry (public repo) | $0 |
| Anthropic API (Haiku 4.5, rate-limited) | < $5/mo expected |
| Custom domain | $0 (using free `.pages.dev` subdomain) |
| **Total** | **< $5/mo** |

A senior engineer's portfolio shouldn't cost more than their lunch.

## Repo layout

```
.
├── web/                     React SPA
├── services/
│   ├── experience-api/      .NET 10 — work experience, skills
│   ├── persona-api/         Python — storytelling, RPG scenarios, hobbies
│   └── agent-api/           Python + Anthropic — "Ask Tal" chat
├── infra/terraform/         Azure infrastructure-as-code
├── .github/workflows/       Per-service CI/CD, path-filtered
├── docker-compose.yml       Local development
└── CLAUDE.md                Conventions for AI-assisted work in this repo
```

## How this was built

Most of this repository was implemented using Claude Code, working from the
conventions in [`CLAUDE.md`](./CLAUDE.md). The `CLAUDE.md` file is the most
important leadership artifact in the repo: it sets the standards an AI agent
must follow, in the same way I'd set standards for a human engineer.

## Contact

- LinkedIn: [linkedin.com/in/talshterzer](https://linkedin.com/in/talshterzer)
- Email: shterzer@gmail.com