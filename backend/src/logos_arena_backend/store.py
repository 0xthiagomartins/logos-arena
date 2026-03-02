import uuid
from datetime import datetime, timezone
from typing import Any

from logos_arena_backend.schemas.debate import CreateDebateRequest


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


_debates: dict[str, dict[str, Any]] = {}


def create_debate(req: CreateDebateRequest) -> dict[str, Any]:
    config = req.resolve_config()
    debate_id = str(uuid.uuid4())
    now = _now_iso()
    record = {
        "id": debate_id,
        "title": req.title,
        "question": req.question,
        "status": "draft",
        "config_json": config.model_dump(),
        "current_round_index": 0,
        "created_at": now,
        "updated_at": now,
    }
    _debates[debate_id] = record
    return record


def get_debate(debate_id: str) -> dict[str, Any] | None:
    return _debates.get(debate_id)


def list_debates(page: int = 1, per_page: int = 20) -> tuple[list[dict[str, Any]], int]:
    items = sorted(_debates.values(), key=lambda d: d["created_at"], reverse=True)
    total = len(items)
    start = (page - 1) * per_page
    end = start + per_page
    return items[start:end], total
