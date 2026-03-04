import os

from sqlmodel import SQLModel, create_engine


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./logos_arena.db")

connect_args: dict[str, object] = {}
if DATABASE_URL.startswith("sqlite"):
    # Necessário para uso com FastAPI em modo multithread.
    connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, echo=False, connect_args=connect_args)


def init_db() -> None:
    """Inicializa as tabelas no banco (idempotente)."""

    SQLModel.metadata.create_all(engine)

