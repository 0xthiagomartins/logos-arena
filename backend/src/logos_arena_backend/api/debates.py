from __future__ import annotations

import json
from typing import Any, Iterator

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from logos_arena_backend.schemas.debate import (
    CreateDebateRequest,
    DebateListResponse,
    DebateRoundsResponse,
    DebateResponse,
    ReportResponse,
    RunDebateResponse,
    StepMediationResponse,
    StepRequest,
    StepRoundResponse,
)
from logos_arena_backend.services.debates import (
    create_debate_service,
    delete_debate_service,
    get_debate_service,
    get_report_service,
    get_rounds_service,
    list_debates_service,
    run_debate_service,
    run_next_step_service,
    run_next_step_stream_service,
)
from logos_arena_backend.store import get_debate


router = APIRouter(tags=["debates"])


def _sse_event(event: str, data: dict[str, object]) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.post(
    "/debates",
    response_model=DebateResponse,
    status_code=201,
)
def post_debates(body: CreateDebateRequest, request: Request) -> DebateResponse:
    return create_debate_service(
        body=body,
        authorization_header=request.headers.get("Authorization"),
        client_id_header=request.headers.get("X-Client-Id", ""),
    )


@router.get(
    "/debates",
    response_model=DebateListResponse,
)
def get_debates_list(page: int = 1, per_page: int = 20) -> DebateListResponse:
    return list_debates_service(page=page, per_page=per_page)


@router.get(
    "/debates/{debate_id}",
    response_model=DebateResponse,
)
def get_debate_by_id(debate_id: str) -> DebateResponse:
    return get_debate_service(debate_id)


@router.delete(
    "/debates/{debate_id}",
    status_code=204,
)
def delete_debate_endpoint(debate_id: str) -> None:
    delete_debate_service(debate_id)


@router.post(
    "/debates/{debate_id}/run",
    response_model=RunDebateResponse,
    status_code=202,
)
def run_debate_endpoint(debate_id: str) -> RunDebateResponse:
    return run_debate_service(debate_id)


@router.post(
    "/debates/{debate_id}/step",
    response_model=StepRoundResponse | StepMediationResponse,
)
def run_debate_step_endpoint(debate_id: str, body: StepRequest | None = None) -> StepRoundResponse | StepMediationResponse:
    extend = body.extend if body else False
    return run_next_step_service(debate_id, extend=extend)


@router.post(
    "/debates/{debate_id}/step/stream",
)
def run_debate_step_stream_endpoint(debate_id: str, body: StepRequest | None = None) -> StreamingResponse:
    extend = body.extend if body else False

    def _event_generator() -> Iterator[str]:
        try:
            for item in run_next_step_stream_service(debate_id, extend=extend):
                yield _sse_event(item["event"], item["data"])  # type: ignore[index]
            yield _sse_event("done", {"ok": True})
        except HTTPException as exc:
            # Encapsula erro como evento SSE "error".
            detail = exc.detail if isinstance(exc.detail, dict) else {"detail": str(exc.detail), "code": "UNKNOWN"}
            yield _sse_event("error", detail)  # type: ignore[arg-type]
        except Exception:
            yield _sse_event(
                "error",
                {"detail": "Falha inesperada ao executar step.", "code": "STEP_STREAM_FAILED"},
            )

    return StreamingResponse(
        _event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


@router.get(
    "/debates/{debate_id}/rounds",
    response_model=DebateRoundsResponse,
)
def get_debate_rounds_endpoint(debate_id: str) -> DebateRoundsResponse:
    return get_rounds_service(debate_id)


@router.get(
    "/debates/{debate_id}/report",
    response_model=ReportResponse,
)
def get_debate_report_endpoint(debate_id: str) -> ReportResponse:
    return get_report_service(debate_id)


@router.get(
    "/debates/{debate_id}/events",
)
def get_debate_events_endpoint(debate_id: str) -> None:
    record = get_debate(debate_id)
    if record is None:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Debate não encontrado.", "code": "DEBATE_NOT_FOUND"},
        )
    raise HTTPException(
        status_code=501,
        detail={
            "detail": "SSE ainda não implementado neste MVP.",
            "code": "DEBATE_EVENTS_NOT_IMPLEMENTED",
        },
    )

