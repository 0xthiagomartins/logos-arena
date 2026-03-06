from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from logos_arena_backend.api.debates import router as debates_router
from logos_arena_backend.db import init_db

app = FastAPI(title="LogosArena Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(debates_router)


@app.on_event("startup")
def _on_startup() -> None:
    init_db()


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}
