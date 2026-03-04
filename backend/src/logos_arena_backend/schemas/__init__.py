"""Pydantic schemas used at the API boundary (request/response JSON).

These models describe how data enters and leaves the HTTP layer and stay
decoupled from persistence concerns (see `models.py` for SQLModel tables).
"""

from logos_arena_backend.schemas.debate import (
    CreateDebateRequest,
    DebateConfig,
    DebateListItem,
    DebateListResponse,
    DebateResponse,
    MediatorPrefs,
    RunDebateResponse,
)

__all__ = [
    "CreateDebateRequest",
    "DebateConfig",
    "DebateListItem",
    "DebateListResponse",
    "DebateResponse",
    "MediatorPrefs",
    "RunDebateResponse",
]
