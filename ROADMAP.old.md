# Build Roadmap

Designed for incremental, vertical-slice delivery. Each milestone is shippable
and provides immediate value, so you can stop at any point and still have
something worth showing.

## Milestone 1 — Hello, monorepo ✅ (this starter pack)

You're already here. The skeleton runs four services that respond to `/health`.
The frontend renders the live status of all three APIs.

**Acceptance:** `docker compose up`, visit http://localhost:5173, see your name
at the top and three green dots in the status section.

## Milestone 2 — Real data on the page ✅

Wire up the rest of the CV data:

- [x] Experience timeline section (`/experience` from experience-api)
- [x] Skills grid section (`/skills` from experience-api)
- [x] Persona section (`/persona` from persona-api)
- [x] CV download button (`/cv-pdf` from experience-api — `data/cv.pdf` bundled)
- [x] Mobile responsive at 375px width

**Acceptance:** the page tells your full professional story without the agent,
and looks intentional on phone and desktop.

## Milestone 3 — The Ask Tal agent ✅

The agent service is already coded. What's left:

- [x] Set `ANTHROPIC_API_KEY` in `.env` and verify `/health` reports `agent_available: true`
- [x] Manually test the agent via curl (see below)
- [x] Build the chat UI: floating button in bottom-right, slide-out panel
- [x] Wire it to `POST /chat`, maintain last 10 turns of history in React state
- [x] Empty-state suggestions ("What kind of teams has Tal led?", "Tell me about Tal's experience with Azure.", "What does Tal do outside of work?")
- [x] Show "tools used" subtly, as a transparency signal — proves the agent isn't making things up

```bash
curl -X POST http://localhost:5003/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What companies has Tal worked at?", "history": []}'
```

**Acceptance:** a visitor can chat with the agent and ask for the CV, getting a
real download link in the response.

## Milestone 4 — Ship it ✅

- [x] Push the repo public to GitHub
- [x] Enable GitHub Container Registry, make image visibility public
- [x] Configure Azure OIDC federated credentials (App Registration `2009e768-482a-4a1c-bb9c-b389ef160bed`, federated to `main` branch)
- [x] Terraform remote state in Azure Blob Storage (`pdctfstate` / `tfstate` container, `westeurope`)
- [x] `terraform init && terraform apply` — three Container Apps live in `westeurope`
- [x] GitHub Actions workflows for all three services (`experience-api.yml`, `persona-api.yml`, `agent-api.yml`)
- [x] Deploy the frontend to Cloudflare Pages (`https://portfolio-display-case.pages.dev`)
- [x] Update `ALLOWED_ORIGINS` in Terraform with the Pages URL
- [x] Verify the live site works end-to-end — all three `/health` endpoints return `ok`

**Acceptance:** ✅ The site is live. All three services healthy. Agent returns answers.

Live URLs:
- Frontend: `https://talshterzer.dev`
- `experience-api`: `https://experience-api.salmonglacier-dcaafea0.westeurope.azurecontainerapps.io`
- `persona-api`: `https://persona-api.salmonglacier-dcaafea0.westeurope.azurecontainerapps.io`
- `agent-api`: `https://agent-api.salmonglacier-dcaafea0.westeurope.azurecontainerapps.io`

**Loose ends (finish before M5):**
- [x] Add GitHub Actions secrets (`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`)
- [x] Verify GHCR packages are set to public visibility
- [x] Update `README.md` live site URL (currently says "coming soon")
- [x] ~~Connect Cloudflare Pages to GitHub repo in dashboard for auto-deploy~~ — dropped: CI already deploys via `wrangler pages deploy` on push to `main`, which achieves the same outcome

## Milestone 5 — Polish

### CI/CD & reliability ✅
- [x] `web.yml` — build, test, deploy to Cloudflare Pages on push to `main`; path-filtered; `workflow_dispatch` for manual runs
- [x] `experience-api.yml` / `persona-api.yml` / `agent-api.yml` — Docker build → GHCR push → Azure Container App update; OIDC auth; path-filtered per service
- [x] Stable Container App URLs in Terraform output and GitHub variables (revision-suffix bug fixed)
- [ ] Add smoke test step to each service workflow: `curl /health` on the deployed app before marking done — **carried to new ROADMAP.md**

### Frontend UX
- [x] OpenGraph + Twitter card meta tags so LinkedIn/Slack previews render well
- [x] Real favicon (SVG — "TS" initials in teal on dark zinc)
- [x] Sitemap (`/sitemap.xml`) and `robots.txt` static files in `web/public/`
- [x] Chat panel loading state — a pulsing "thinking…" indicator exists; a full skeleton loader is deferred as tech debt, **carried to new ROADMAP.md**
- [ ] Chat panel: error state with retry button — inline error text exists, retry action doesn't — **carried to new ROADMAP.md**
- [ ] Accessibility audit: tab order, focus rings (aria-labels already present on chat controls), colour contrast check in light mode — not yet manually verified — **carried to new ROADMAP.md**

### Content
- [x] Replace placeholder `persona-api` data with real storytelling content — `persona.json` has full RPG/boardgame content, not placeholder
- [x] Update `experience-api` CV data to match current CV exactly (dates, titles, bullet points)
- [x] Verify CV PDF bundled in `experience-api` is the latest version

### Custom domain
- [x] Register domain — `talshterzer.dev` purchased
- [x] Add custom domain to Cloudflare Pages project
- [x] Update `ALLOWED_ORIGINS` in Terraform and re-apply

### Promotion
- [x] LinkedIn profile URL updated to `https://talshterzer.dev`
- [x] CV PDF footer/header updated with live URL — confirmed via embedded PDF links
- [x] Share with target audience

## Milestone 6 — Refinements

### Reliability & ops
- [ ] Smoke test step in each service workflow (duplicate of M5 item above) — **carried to new ROADMAP.md**
- [ ] Dependabot or Renovate for automated dependency updates — **carried to new ROADMAP.md**

### Frontend UX
- [x] Chat panel loading state (duplicate of M5 item above, see note there)
- [ ] Chat panel: error state with retry button (duplicate of M5 item above) — **carried to new ROADMAP.md**
- [ ] Accessibility audit (duplicate of M5 item above) — **carried to new ROADMAP.md**

### Content
- [x] Replace placeholder `persona-api` data with real storytelling content (duplicate of M5 item above)
- [ ] Military service section: add `/military` endpoint to `experience-api`, wire up frontend section — **carried to new ROADMAP.md**

### Promotion
- [x] LinkedIn profile URL updated (duplicate of M5 item above)
- [x] CV PDF footer/header updated (duplicate of M5 item above)
- [x] Share with target audience (duplicate of M5 item above)

**Status: all resolved or carried forward.** See `ROADMAP.md` for the active
roadmap (CV-tailoring extension project + carried-over backlog).

---

## Working with Claude Code on this repo

Always read [`CLAUDE.md`](./CLAUDE.md) at the start of a session. It encodes the
architectural rules. When asking Claude Code to add a feature:

- Identify which service it belongs to first
- Don't let it add shared code between services
- Don't let it add a database
- Bump the relevant service's version when changing behavior
- Ask it to update the relevant `README.md` if conventions change

The most common failure mode will be Claude Code suggesting "let me extract this
into a shared library" — say no every time. Duplication is a feature here.
