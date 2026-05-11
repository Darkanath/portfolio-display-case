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

## Milestone 3 — The Ask Tal agent (1–2 days)

The agent service is already coded. What's left:

- [ ] Set `ANTHROPIC_API_KEY` in `.env` and verify `/health` reports `agent_available: true`
- [ ] Manually test the agent via curl (see below)
- [ ] Build the chat UI: floating button in bottom-right, slide-out panel
- [ ] Wire it to `POST /chat`, maintain last 10 turns of history in React state
- [ ] Empty-state suggestions ("What does Tal do at SmartLinx?", "What kind of teams has Tal led?")
- [ ] Show "tools used" subtly, as a transparency signal — proves the agent isn't making things up

```bash
curl -X POST http://localhost:5003/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What companies has Tal worked at?", "history": []}'
```

**Acceptance:** a visitor can chat with the agent and ask for the CV, getting a
real download link in the response.

## Milestone 4 — Ship it (½–1 day)

- [ ] Push the repo public to GitHub
- [ ] Enable GitHub Container Registry, make image visibility public
- [ ] Configure Azure OIDC federated credentials (one-time, see `infra/terraform/AUTH.md` — TODO)
- [ ] `terraform init && terraform apply` from `infra/terraform/`
- [ ] First deploys happen on next push to main (path-filtered workflows trigger automatically)
- [ ] Deploy the frontend to Cloudflare Pages (point at the GitHub repo)
- [ ] Update `ALLOWED_ORIGINS` in Terraform with the Pages URL
- [ ] Re-apply Terraform
- [ ] Verify the live site works end-to-end

**Acceptance:** you can send the public URL to someone, they can browse, ask
the agent something, and download the CV.

## Milestone 5 — Polish (ongoing)

- [ ] OpenGraph + Twitter card meta tags so LinkedIn previews look good
- [ ] Sitemap + robots.txt
- [ ] Real favicon
- [ ] Replace placeholder persona content with real storytelling/RPG content
- [ ] Add a "Team Decisions" section if you want the leadership-stories piece later
- [ ] Add an interactive RPG scenario demo if you want that piece later
- [ ] Custom domain via Cloudflare Registrar (~$12/year)
- [ ] LinkedIn + CV updates with the live URL

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
