# agent-api

The "Ask Tal" assistant. A small service that runs a tool-using conversation
with Claude Haiku 4.5 on behalf of visitors.

## Stack

- Python 3.13 + FastAPI + Anthropic SDK
- Rate limiting: slowapi (per-IP)
- Model: `claude-haiku-4-5` ($1/M input, $5/M output)

## Design contract

The agent has **only** the tools defined in `app/tools.py`. It cannot do anything
else. Tools map to read-only HTTP calls against `experience-api` and `persona-api`.

The agent has no state. The client sends the last 10 turns as `history`. No
conversation is persisted server-side.

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness + reports whether `ANTHROPIC_API_KEY` is set |
| GET | `/version` | Plain-text semver |
| POST | `/chat` | `{message, history}` → `{reply, tools_used}` |

## Rate limits

- 10 requests per IP per hour
- 30 requests per IP per day
- `max_tokens=512` per call
- `message` field capped at 500 characters
- Conversation history capped at 10 turns

Realistic worst case at full quota saturation: a few dollars per month.
Realistic actual case: under $2/month.

## Run locally

The easiest path is `docker compose up` from the repo root — it wires all
services together with the correct URLs.

To run this service in isolation:

```bash
cp ../../.env.example .env
# edit .env — set ANTHROPIC_API_KEY, EXPERIENCE_API_URL, PERSONA_API_URL
uv sync
uv run uvicorn app.main:app --reload --port 8080
# or
docker build -t agent-api . && docker run -p 5003:8080 --env-file .env agent-api
```

`EXPERIENCE_API_URL` and `PERSONA_API_URL` must point to running instances of
those services. For local standalone use `http://localhost:5001` and
`http://localhost:5002`.

## Testing

```bash
uv run pytest
```

## Environment

| Var | Required | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes (or service returns 503) | — |
| `EXPERIENCE_API_URL` | yes | `http://experience-api:8080` |
| `PERSONA_API_URL` | yes | `http://persona-api:8080` |
| `ALLOWED_ORIGINS` | no | `http://localhost:5173` |
| `PORT` | no | `8080` |
