# syntax=docker/dockerfile:1.7

FROM python:3.13-slim AS base
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

# Install uv from the official image
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Install dependencies first for better layer caching
COPY pyproject.toml ./
RUN uv pip install --system --no-cache .

# Run as non-root
RUN groupadd --system --gid 1001 app \
 && useradd --system --uid 1001 --gid app app

COPY --chown=app:app . .

USER app
EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
