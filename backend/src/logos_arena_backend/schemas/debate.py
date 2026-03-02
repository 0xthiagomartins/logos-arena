from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class MediatorPrefs(BaseModel):
    explain_like_12yo: bool = False
    rigor_formal: bool = True
    point_out_fallacies: bool = True
    steelman_other_side: bool = False


class DebateConfig(BaseModel):
    question: str
    language: str = "pt-BR"
    rounds: list[str] = Field(default_factory=lambda: ["opening", "rebuttal", "closing"])
    max_tokens_per_message: int = 1024
    debater_profiles: list[str] = Field(default_factory=list)
    mediator_prefs: MediatorPrefs = Field(default_factory=MediatorPrefs)


class CreateDebateRequest(BaseModel):
    title: str
    question: str
    config: DebateConfig | None = None

    def resolve_config(self) -> DebateConfig:
        if self.config is not None:
            return self.config
        return DebateConfig(question=self.question)


class DebateResponse(BaseModel):
    id: str
    status: str
    title: str
    question: str
    config_json: dict[str, Any]
    current_round_index: int = 0
    created_at: str
    updated_at: str


class DebateListItem(BaseModel):
    id: str
    title: str
    question: str
    status: str
    created_at: str


class DebateListResponse(BaseModel):
    items: list[DebateListItem]
    total: int
    page: int
    per_page: int
