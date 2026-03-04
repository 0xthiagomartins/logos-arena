from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlmodel import Session, select

from logos_arena_backend.db import engine
from logos_arena_backend.models import Debate, Report, Round
from logos_arena_backend.schemas.debate import CreateDebateRequest


def _now_iso(dt: datetime | None = None) -> str:
    value = dt or datetime.now(timezone.utc)
    return value.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")


def _debate_to_record(
    debate: Debate,
    *,
    rounds: list[Round] | None = None,
    report: Report | None = None,
) -> dict[str, Any]:
    rounds = rounds or []
    return {
        "id": debate.id,
        "title": debate.title,
        "question": debate.question,
        "status": debate.status,
        "owner_user_id": debate.owner_user_id,
        "owner_client_id": debate.owner_client_id,
        "config_json": debate.config_json or {},
        "current_round_index": debate.current_round_index,
        "created_at": _now_iso(debate.created_at),
        "updated_at": _now_iso(debate.updated_at),
        "rounds": [
            {
                "index": r.index,
                "type": r.type,
                "messages": r.messages or [],
            }
            for r in sorted(rounds, key=lambda x: x.index)
        ],
        "round_summaries": [
            r.step_summary or "" for r in sorted(rounds, key=lambda x: x.index)
        ],
        "report": {"content_md": report.content_md} if report else {},
    }


def create_debate(
    req: CreateDebateRequest,
    *,
    owner_user_id: str | None = None,
    owner_client_id: str | None = None,
) -> dict[str, Any]:
    config = req.resolve_config()
    debate_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    debate = Debate(
        id=debate_id,
        title=req.title,
        question=req.question,
        status="draft",
        owner_user_id=owner_user_id,
        owner_client_id=owner_client_id if owner_user_id is None else None,
        config_json=config.model_dump(),
        current_round_index=0,
        created_at=now,
        updated_at=now,
    )

    with Session(engine) as session:
        session.add(debate)
        session.commit()
        session.refresh(debate)

    return _debate_to_record(debate, rounds=[], report=None)


def get_debate(debate_id: str) -> dict[str, Any] | None:
    with Session(engine) as session:
        debate = session.get(Debate, debate_id)
        if debate is None:
            return None
        rounds = list(session.exec(select(Round).where(Round.debate_id == debate_id)))
        report = session.exec(
            select(Report).where(Report.debate_id == debate_id),
        ).first()
        return _debate_to_record(debate, rounds=rounds, report=report)


def has_used_anonymous_trial(client_id: str) -> bool:
    """Retorna True se já existir algum debate anônimo para este client_id."""

    with Session(engine) as session:
        statement = select(Debate).where(
            Debate.owner_user_id.is_(None),
            Debate.owner_client_id == client_id,
        )
        existing = session.exec(statement).first()
        return existing is not None


def delete_debate(debate_id: str) -> bool:
    with Session(engine) as session:
        debate = session.get(Debate, debate_id)
        if debate is None:
            return False

        # Remover rounds e report associados (sem cascata automática).
        rounds_result = session.exec(select(Round).where(Round.debate_id == debate_id))
        for r in rounds_result:
            session.delete(r)
        report = session.exec(select(Report).where(Report.debate_id == debate_id)).first()
        if report is not None:
            session.delete(report)

        session.delete(debate)
        session.commit()
        return True


def update_debate_status(debate_id: str, status: str) -> None:
    with Session(engine) as session:
        debate = session.get(Debate, debate_id)
        if debate is None:
            return
        debate.status = status
        debate.updated_at = datetime.now(timezone.utc)
        session.add(debate)
        session.commit()


def save_debate_rounds_and_report(
    debate_id: str,
    rounds: list[dict[str, Any]],
    report: dict[str, Any],
) -> None:
    """Mantido para compatibilidade; não é usado no fluxo passo a passo atual."""

    with Session(engine) as session:
        debate = session.get(Debate, debate_id)
        if debate is None:
            return

        # Substitui rounds existentes.
        existing_rounds = session.exec(
            select(Round).where(Round.debate_id == debate_id),
        ).all()
        for r in existing_rounds:
            session.delete(r)

        for r in rounds:
            session.add(
                Round(
                    id=str(uuid.uuid4()),
                    debate_id=debate_id,
                    index=int(r["index"]),
                    type=str(r["type"]),
                    messages=list(r.get("messages", [])),
                    step_summary=None,
                ),
            )

        existing_report = session.exec(
            select(Report).where(Report.debate_id == debate_id),
        ).first()
        content_md = str(report.get("content_md", ""))
        if existing_report is None:
            session.add(
                Report(
                    id=str(uuid.uuid4()),
                    debate_id=debate_id,
                    content_md=content_md,
                    created_at=datetime.now(timezone.utc),
                ),
            )
        else:
            existing_report.content_md = content_md
            session.add(existing_report)

        debate.current_round_index = len(rounds)
        debate.updated_at = datetime.now(timezone.utc)
        session.add(debate)
        session.commit()


def append_round_and_summary(
    debate_id: str,
    round_data: dict[str, Any],
    step_summary: str,
) -> None:
    with Session(engine) as session:
        debate = session.get(Debate, debate_id)
        if debate is None:
            return

        new_round = Round(
            id=str(uuid.uuid4()),
            debate_id=debate_id,
            index=int(round_data["index"]),
            type=str(round_data["type"]),
            messages=list(round_data.get("messages", [])),
            step_summary=step_summary,
        )
        session.add(new_round)

        debate.current_round_index = max(debate.current_round_index, new_round.index + 1)
        debate.updated_at = datetime.now(timezone.utc)
        session.add(debate)

        session.commit()


def save_debate_report(debate_id: str, report: dict[str, Any]) -> None:
    content_md = str(report.get("content_md", ""))
    with Session(engine) as session:
        debate = session.get(Debate, debate_id)
        if debate is None:
            return

        existing = session.exec(
            select(Report).where(Report.debate_id == debate_id),
        ).first()
        if existing is None:
            session.add(
                Report(
                    id=str(uuid.uuid4()),
                    debate_id=debate_id,
                    content_md=content_md,
                    created_at=datetime.now(timezone.utc),
                ),
            )
        else:
            existing.content_md = content_md
            session.add(existing)

        debate.updated_at = datetime.now(timezone.utc)
        session.add(debate)
        session.commit()


def get_debate_rounds(debate_id: str) -> list[dict[str, Any]]:
    with Session(engine) as session:
        rounds = session.exec(
            select(Round).where(Round.debate_id == debate_id),
        ).all()
        return [
            {
                "index": r.index,
                "type": r.type,
                "messages": r.messages or [],
            }
            for r in sorted(rounds, key=lambda x: x.index)
        ]


def get_debate_round_summaries(debate_id: str) -> list[str]:
    with Session(engine) as session:
        rounds = session.exec(
            select(Round).where(Round.debate_id == debate_id),
        ).all()
        return [r.step_summary or "" for r in sorted(rounds, key=lambda x: x.index)]


def get_debate_report(debate_id: str) -> dict[str, Any]:
    with Session(engine) as session:
        report = session.exec(
            select(Report).where(Report.debate_id == debate_id),
        ).first()
        if report is None:
            return {}
        return {"content_md": report.content_md}


def list_debates(page: int = 1, per_page: int = 20) -> tuple[list[dict[str, Any]], int]:
    with Session(engine) as session:
        all_ids = session.exec(select(Debate.id)).all()
        total = len(all_ids)
        statement = (
            select(Debate)
            .order_by(Debate.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
        )
        debates = session.exec(statement).all()
        return (
            [
                _debate_to_record(d, rounds=[], report=None)
                for d in debates
            ],
            total,
        )

