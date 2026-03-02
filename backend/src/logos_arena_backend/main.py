from fastapi import FastAPI, HTTPException

from logos_arena_backend.schemas.debate import (
    CreateDebateRequest,
    DebateListItem,
    DebateListResponse,
    DebateResponse,
)
from logos_arena_backend.store import create_debate, get_debate, list_debates

app = FastAPI(title="LogosArena Backend", version="0.1.0")


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
        raise HTTPException(status_code=400, detail="page e per_page devem ser positivos; per_page máx 100")
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
        raise HTTPException(status_code=404, detail="Debate não encontrado.", headers={"X-Code": "DEBATE_NOT_FOUND"})
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

