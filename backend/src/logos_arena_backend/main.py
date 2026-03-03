import json

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

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
    list_debates,
)
from logos_arena_backend.orchestrator import (
    DebateStepError,
    run_debate as orchestrate_run,
    run_next_step as orchestrate_next_step,
    run_next_step_stream as orchestrate_next_step_stream,
)

app = FastAPI(title="LogosArena Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _error_payload(message: str, code: str) -> dict[str, str]:
    return {"detail": message, "code": code}


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/debates", response_model=DebateResponse, status_code=201, tags=["debates"])
def post_debates(body: CreateDebateRequest) -> DebateResponse:
    record = create_debate(body)
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


@app.get("/debates", response_model=DebateListResponse, tags=["debates"])
def get_debates_list(page: int = 1, per_page: int = 20) -> DebateListResponse:
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


@app.get("/debates/{debate_id}", response_model=DebateResponse, tags=["debates"])
def get_debate_by_id(debate_id: str) -> DebateResponse:
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


@app.delete("/debates/{debate_id}", status_code=204, tags=["debates"])
def delete_debate_endpoint(debate_id: str) -> None:
    deleted = delete_debate(debate_id)
    if not deleted:
        raise HTTPException(
            status_code=404,
            detail=_error_payload(message="Debate não encontrado.", code="DEBATE_NOT_FOUND"),
        )


@app.post(
    "/debates/{debate_id}/run",
    response_model=RunDebateResponse,
    status_code=202,
    tags=["debates"],
)
def run_debate_endpoint(debate_id: str) -> RunDebateResponse:
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

    # MVP: execução síncrona; retornamos o status final (completed/failed),
    # embora a spec original mencione "queued".
    result = orchestrate_run(debate_id)
    return RunDebateResponse(job_id=result.debate_id, status=result.status)


@app.post(
    "/debates/{debate_id}/step",
    response_model=StepRoundResponse | StepMediationResponse,
    tags=["debates"],
)
def run_debate_step_endpoint(debate_id: str) -> StepRoundResponse | StepMediationResponse:
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


def _sse_event(event: str, data: dict[str, object]) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@app.post("/debates/{debate_id}/step/stream", tags=["debates"])
def run_debate_step_stream_endpoint(debate_id: str) -> StreamingResponse:
    def _event_generator():
        try:
            for item in orchestrate_next_step_stream(debate_id):
                yield _sse_event(item["event"], item["data"])
            yield _sse_event("done", {"ok": True})
        except DebateStepError as exc:
            yield _sse_event("error", _error_payload(message=exc.message, code=exc.code))
        except Exception:
            yield _sse_event(
                "error",
                _error_payload(message="Falha inesperada ao executar step.", code="STEP_STREAM_FAILED"),
            )

    return StreamingResponse(
        _event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


@app.get("/debates/{debate_id}/rounds", response_model=DebateRoundsResponse, tags=["debates"])
def get_debate_rounds_endpoint(debate_id: str) -> DebateRoundsResponse:
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


@app.get("/debates/{debate_id}/report", response_model=ReportResponse, tags=["debates"])
def get_debate_report_endpoint(debate_id: str) -> ReportResponse:
    record = get_debate(debate_id)
    if record is None:
        raise HTTPException(
            status_code=404,
            detail=_error_payload(message="Debate não encontrado.", code="DEBATE_NOT_FOUND"),
        )
    # MVP: se o debate ainda não rodou (ou falhou sem relatório), retornamos 200 com content_md vazio.
    report = get_debate_report(debate_id)
    return ReportResponse(content_md=report.get("content_md", ""))


@app.get("/debates/{debate_id}/events", tags=["debates"])
def get_debate_events_endpoint(debate_id: str) -> None:
    record = get_debate(debate_id)
    if record is None:
        raise HTTPException(
            status_code=404,
            detail=_error_payload(message="Debate não encontrado.", code="DEBATE_NOT_FOUND"),
        )
    raise HTTPException(
        status_code=501,
        detail=_error_payload(
            message="SSE ainda não implementado neste MVP.",
            code="DEBATE_EVENTS_NOT_IMPLEMENTED",
        ),
    )
