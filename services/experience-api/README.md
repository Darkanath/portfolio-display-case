# experience-api

The professional-side service: work experience, technical skills, education,
and the source of truth for CV data.

## Stack

- .NET 10 Web API (MVC controllers, URL-based versioning via Asp.Versioning.Mvc)
- Data: `data/cv.json` (baked into the container image)
- No database, no external dependencies
- Version: see `appsettings.json` → `Service.Version`

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness probe. Returns `{status, service, version}` |
| GET | `/version` | Plain-text semver |
| GET | `/api/v1/profile` | Name, tagline, summary |
| GET | `/api/v1/experience` | Array of past and current roles |
| GET | `/api/v1/skills` | Skills grouped by category |
| GET | `/api/v1/military` | Military service entries |
| GET | `/api/v1/cv-pdf` | Returns the CV as a downloadable PDF (when bundled) |

## Run locally

```bash
dotnet run
# or
docker build -t experience-api . && docker run -p 5001:8080 experience-api
```

## How to update the CV

Edit `data/cv.json`, bump `Service.Version` in `appsettings.json`, commit, push.
CI/CD will build and deploy a new revision.

The "schema" is the JSON file. The "migration" is the git commit.

If a role has both `highlights` and `achievements`, keep `achievements[].text`
mirroring the corresponding `highlights[]` entry — `achievements` adds
`tags`/`metric` for the CV-tailoring feature in `agent-api`, but the two
arrays should still agree on content. A test asserts they stay in sync; see
[`services/agent-api/docs/cv-tailoring.md`](../agent-api/docs/cv-tailoring.md)
for why this duplication exists.

## Testing

Unit and integration tests live in `tests/experience-api/ExperienceApi.Tests/`
(run from the repo root):

```bash
dotnet test tests/experience-api/ExperienceApi.Tests/
```
