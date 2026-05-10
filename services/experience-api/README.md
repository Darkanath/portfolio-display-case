# experience-api

The professional-side service: work experience, technical skills, education,
and the source of truth for CV data.

## Stack

- .NET 10 minimal API
- Data: `data/cv.json` (baked into the container image)
- No database, no external dependencies

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness probe. Returns `{status, service, version}` |
| GET | `/version` | Plain-text semver |
| GET | `/profile` | Name, tagline, summary |
| GET | `/experience` | Array of past and current roles |
| GET | `/skills` | Skills grouped by category |
| GET | `/cv-pdf` | Returns the CV as a downloadable PDF (when bundled) |

## Run locally

```bash
dotnet run
# or
docker build -t experience-api . && docker run -p 5001:8080 experience-api
```

## How to update the CV

Edit `data/cv.json`, bump the version in `Program.cs` (the `ServiceVersion`
constant), commit, push. CI/CD will build and deploy a new revision.

The "schema" is the JSON file. The "migration" is the git commit.
