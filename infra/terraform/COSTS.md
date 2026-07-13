# Cost expectations

## Free, always

- Cloudflare Pages — frontend hosting
- GitHub Container Registry (public repo) — image storage

## Free at portfolio traffic, within Azure's permanent free grant

Per subscription per month, Azure Container Apps Consumption plan provides:

- 180,000 vCPU-seconds
- 360,000 GiB-seconds
- 2,000,000 requests

Three services, each 0.25 vCPU / 0.5 GiB, scaling to zero when idle, will not
come close to those limits at portfolio traffic levels (estimated < 1,000 page
views per month). Cold-start is acceptable for this use case.

## Paid (and unavoidable)

- **Log Analytics workspace**: minimal at portfolio traffic, but not zero.
  Expect under $1/month. Acceptable for visibility.
- **Anthropic API**: two paths, both rate-limited.
  - *Chat* (`/chat`) runs on Haiku 4.5 ($1/M input, $5/M output), rate-limited to
    ~1000 requests/day globally — worst case ~$3.50/day if fully saturated,
    realistic case under $2/month.
  - *CV tailoring* (`generate_tailored_cv`) runs a second call on Opus 4.8
    ($5/M input, $25/M output), capped at 3/hour per IP — roughly $0.05 per
    tailored CV, so a handful per day is cents. The full-CV download
    (`download_full_cv`) is generated deterministically with **no** model call.
  - Combined, expected well under $5/month at portfolio traffic.

## Avoided on purpose

- **No Azure Container Registry** — using ghcr.io instead, free for public repos
- **No database** — data lives as JSON inside container images
- **No managed identity / Key Vault** for v1 — secrets go directly into Container
  App secret store. Acceptable for portfolio scope. Upgrade to Key Vault when
  the project grows.
- **No CDN/Front Door** — Cloudflare Pages includes a CDN; Azure Container Apps
  is fronted by its built-in ingress

## Total expected: under $5/month
