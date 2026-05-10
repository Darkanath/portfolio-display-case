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
- **Anthropic API**: rate-limited to ~1000 chat requests/day globally. At Haiku
  4.5 pricing ($1/M input, $5/M output), worst case ~$3.50/day if fully
  saturated, realistic case under $2/month.

## Avoided on purpose

- **No Azure Container Registry** — using ghcr.io instead, free for public repos
- **No database** — data lives as JSON inside container images
- **No managed identity / Key Vault** for v1 — secrets go directly into Container
  App secret store. Acceptable for portfolio scope. Upgrade to Key Vault when
  the project grows.
- **No CDN/Front Door** — Cloudflare Pages includes a CDN; Azure Container Apps
  is fronted by its built-in ingress

## Total expected: under $5/month
