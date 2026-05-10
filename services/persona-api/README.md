# persona-api

The non-CV side of Tal: storytelling, tabletop roleplaying, scenario design,
and whatever else doesn't belong on a resume but says something real about
how I think.

## Stack

- Python 3.13 + FastAPI
- Package manager: `uv`
- Data: `data/persona.json` (baked into the container image)

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness probe |
| GET | `/version` | Plain-text semver |
| GET | `/topics` | List available persona topics |
| GET | `/persona` | All persona content |
| GET | `/persona/{topic}` | Content for one topic |

## Run locally

```bash
uv sync
uv run uvicorn app.main:app --reload --port 8080
# or
docker build -t persona-api . && docker run -p 5002:8080 persona-api
```
