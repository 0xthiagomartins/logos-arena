from __future__ import annotations

from typing import Any, Iterator

from fastapi import HTTPException

from logos_arena_backend.auth import AuthValidationError, get_clerk_user_id
from logos_arena_backend.orchestrator import (
    DebateStepError,
    run_debate as orchestrate_run,
    run_next_step as orchestrate_next_step,
    run_next_step_stream as orchestrate_next_step_stream,
)
from logos_arena_backend.schemas.debate import (
    CreateDebateRequest,
    DebateListItem,
    DebateListResponse,
    DebateRoundsResponse,
    DebateResponse,
    ReportResponse,
    RoundResponse,
    RunDebateResponse,
    StepMediationResponse,
    StepRoundResponse,
)
from logos_arena_backend.store import (
    create_debate,
    delete_debate,
    get_debate,
    get_debate_report,
    get_debate_round_summaries,
    get_debate_rounds,
    has_used_anonymous_trial,
    list_debates,
)


def _error_payload(message: str, code: str) -> dict[str, str]:
    return {"detail": message, "code": code}


def create_debate_service(
    body: CreateDebateRequest,
    authorization_header: str | None,
    client_id_header: str | None,
) -> DebateResponse:
    try:
        user_id = get_clerk_user_id(authorization_header)
    except AuthValidationError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail=_error_payload(message=exc.message, code=exc.code),
        ) from exc

    client_id = (client_id_header or "").strip()
    if user_id is None:
        if not client_id:
            raise HTTPException(
                status_code=400,
                detail=_error_payload(
                    message="Header X-Client-Id é obrigatório para uso anônimo.",
                    code="ANON_CLIENT_ID_REQUIRED",
                ),
            )
        if has_used_anonymous_trial(client_id):
            raise HTTPException(
                status_code=401,
                detail=_error_payload(
                    message="Seu teste grátis já foi usado. Faça login para criar novos debates.",
                    code="AUTH_REQUIRED_AFTER_TRIAL",
                ),
            )

    record = create_debate(
        body,
        owner_user_id=user_id,
        owner_client_id=client_id if user_id is None else None,
    )
    return DebateResponse(
        id=record["id"],
        status=record["status"],
        title=record["title"],
        question=record["question"],
        config_json=record["config_json"],
        current_round_index=record["current_round_index"],
        created_at=record["created_at"],
        updated_at=record["updated_at"],
    )


def list_debates_service(page: int = 1, per_page: int = 20) -> DebateListResponse:
    if page < 1 or per_page < 1 or per_page > 100:
        raise HTTPException(
            status_code=400,
            detail=_error_payload(
                message="page e per_page devem ser positivos; per_page máx 100",
                code="INVALID_PAGINATION",
            ),
        )
    items, total = list_debates(page=page, per_page=per_page)
    return DebateListResponse(
        items=[
            DebateListItem(
                id=d["id"],
                title=d["title"],
                question=d["question"],
                status=d["status"],
                created_at=d["created_at"],
            )
            for d in items
        ],
        total=total,
        page=page,
        per_page=per_page,
    )


def get_debate_service(debate_id: str) -> DebateResponse:
    record = get_debate(debate_id)
    if record is None:
        raise HTTPException(
            status_code=404,
            detail=_error_payload(message="Debate não encontrado.", code="DEBATE_NOT_FOUND"),
        )
    return DebateResponse(
        id=record["id"],
        status=record["status"],
        title=record["title"],
        question=record["question"],
        config_json=record["config_json"],
        current_round_index=record["current_round_index"],
        created_at=record["created_at"],
        updated_at=record["updated_at"],
    )


def delete_debate_service(debate_id: str) -> None:
    deleted = delete_debate(debate_id)
    if not deleted:
        raise HTTPException(
            status_code=404,
            detail=_error_payload(message="Debate não encontrado.", code="DEBATE_NOT_FOUND"),
        )


def run_debate_service(debate_id: str) -> RunDebateResponse:
    record = get_debate(debate_id)
    if record is None:
        raise HTTPException(
            status_code=404,
            detail=_error_payload(message="Debate não encontrado.", code="DEBATE_NOT_FOUND"),
        )
    if record["status"] != "draft":
        raise HTTPException(
            status_code=409,
            detail=_error_payload(message="Debate não está em draft.", code="DEBATE_NOT_DRAFT"),
        )

    result = orchestrate_run(debate_id)
    return RunDebateResponse(job_id=result.debate_id, status=result.status)


def run_next_step_service(debate_id: str) -> StepRoundResponse | StepMediationResponse:
    try:
        result = orchestrate_next_step(debate_id)
    except DebateStepError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail=_error_payload(message=exc.message, code=exc.code),
        ) from exc

    if result.step_type == "round":
        if result.round is None or result.round_index is None:
            raise HTTPException(
                status_code=500,
                detail=_error_payload(
                    message="Step de round retornou payload inválido.",
                    code="INTERNAL_STEP_PAYLOAD_ERROR",
                ),
            )
        return StepRoundResponse(
            step_type="round",
            round_index=result.round_index,
            round=RoundResponse(**result.round),
            step_summary=result.step_summary or "",
        )
    return StepMediationResponse(
        step_type="mediation",
        report=ReportResponse(**(result.report or {})),
        status=result.status or "completed",
    )


def get_rounds_service(debate_id: str) -> DebateRoundsResponse:
    record = get_debate(debate_id)
    if record is None:
        raise HTTPException(
            status_code=404,
            detail=_error_payload(message="Debate não encontrado.", code="DEBATE_NOT_FOUND"),
        )
    raw_rounds = get_debate_rounds(debate_id)
    round_summaries = get_debate_round_summaries(debate_id)
    return DebateRoundsResponse(
        rounds=[RoundResponse(**r) for r in raw_rounds],
        round_summaries=round_summaries,
    )


def get_report_service(debate_id: str) -> ReportResponse:
    record = get_debate(debate_id)
    if record is None:
        raise HTTPException(
            status_code=404,
            detail=_error_payload(message="Debate não encontrado.", code="DEBATE_NOT_FOUND"),
        )
    report = get_debate_report(debate_id)
    return ReportResponse(content_md=report.get("content_md", ""))


def run_next_step_stream_service(debate_id: str) -> Iterator[dict[str, Any]]:
    """Wrapper around orchestrate_next_step_stream to keep DebateStepError surface."""

    try:
        yield from orchestrate_next_step_stream(debate_id)
    except DebateStepError as exc:
        # A camada de API decide como representar esse erro (SSE / HTTP).
        raise HTTPException(
            status_code=exc.status_code,
            detail=_error_payload(message=exc.message, code=exc.code),
        ) from exc

