"""persona-api — the non-CV side of Tal: storytelling, RPGs, hobbies."""

from __future__ import annotations

import json
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse

SERVICE_NAME = "persona-api"
SERVICE_VERSION = "0.1.0"

DATA_PATH = Path(__file__).parent.parent / "data" / "persona.json"
PERSONA_DATA: dict = json.loads(DATA_PATH.read_text(encoding="utf-8"))

app = FastAPI(title=SERVICE_NAME, version=SERVICE_VERSION)

allowed_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in allowed_origins],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": SERVICE_NAME, "version": SERVICE_VERSION}


@app.get("/version", response_class=PlainTextResponse)
def version() -> str:
    return SERVICE_VERSION


@app.get("/persona")
def persona_all() -> dict:
    return PERSONA_DATA


@app.get("/persona/{topic}")
def persona_topic(topic: str) -> dict:
    if topic not in PERSONA_DATA:
        raise HTTPException(status_code=404, detail=f"Unknown topic: {topic}")
    return {topic: PERSONA_DATA[topic]}


@app.get("/topics")
def topics() -> dict:
    return {"topics": list(PERSONA_DATA.keys())}
