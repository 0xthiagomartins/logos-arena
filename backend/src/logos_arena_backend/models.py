from __future__ import annotations

"""SQLModel database tables for persistence.

These models define how data is stored and queried in the database
and are intentionally separate from API schemas (see `schemas/`), which
represent the JSON contract exposed to clients.
"""

from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


class Debate(SQLModel, table=True):
    id: str = Field(primary_key=True, index=True)
    title: str
    question: str
    status: str = Field(default="draft", index=True)
    owner_user_id: Optional[str] = Field(default=None, index=True)
    owner_client_id: Optional[str] = Field(default=None, index=True)
    config_json: dict[str, Any] = Field(
        sa_column=Column(JSON, nullable=False, server_default="{}"),
    )
    current_round_index: int = Field(default=0)
    created_at: datetime = Field(default_factory=_now_utc)
    updated_at: datetime = Field(default_factory=_now_utc)


class Round(SQLModel, table=True):
    id: str = Field(primary_key=True, index=True)
    debate_id: str = Field(foreign_key="debate.id", index=True)
    index: int
    type: str
    messages: list[dict[str, Any]] = Field(
        sa_column=Column(JSON, nullable=False, server_default="[]"),
    )
    step_summary: Optional[str] = None


class Report(SQLModel, table=True):
    id: str = Field(primary_key=True, index=True)
    debate_id: str = Field(foreign_key="debate.id", unique=True, index=True)
    content_md: str
    created_at: datetime = Field(default_factory=_now_utc)

