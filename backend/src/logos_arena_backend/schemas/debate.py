from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


class MediatorPrefs(BaseModel):
    explain_like_12yo: bool = False
    rigor_formal: bool = True
    point_out_fallacies: bool = True
    steelman_other_side: bool = False


class DebateConfig(BaseModel):
    question: str
    language: str = "pt-BR"
    rounds: list[str] = Field(default_factory=lambda: ["opening", "rebuttal", "closing"])
    first_speaker: Literal["pro", "con"] = "pro"
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


class RunDebateResponse(BaseModel):
    job_id: str
    status: str


class RoundMessage(BaseModel):
    role: str
    content: str


class RoundResponse(BaseModel):
    index: int
    type: str
    messages: list[RoundMessage] = Field(default_factory=list)


class DebateRoundsResponse(BaseModel):
    rounds: list[RoundResponse] = Field(default_factory=list)
    round_summaries: list[str] = Field(default_factory=list)


class ReportResponse(BaseModel):
    content_md: str = ""


class StepRequest(BaseModel):
    """Body opcional para POST /debates/{id}/step e /step/stream."""
    action: Literal["extend", "next"] = "next"
    extend: bool | None = None

    @model_validator(mode="after")
    def _normalize_legacy_extend(self) -> "StepRequest":
        # Compatibilidade retroativa: payload antigo {"extend": true/false}.
        if self.extend is not None:
            self.action = "extend" if self.extend else "next"
        return self


class StepRoundResponse(BaseModel):
    step_type: str = "round"
    round_index: int
    round: RoundResponse
    step_summary: str


class StepMediationResponse(BaseModel):
    step_type: str = "mediation"
    report: ReportResponse
    status: str
