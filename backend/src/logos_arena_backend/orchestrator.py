from __future__ import annotations

from dataclasses import dataclass
import time
from typing import Any, Iterator, Literal

from logos_arena_backend.llm_provider import generate as llm_generate
from logos_arena_backend.store import (
    append_round_and_summary,
    get_debate,
    save_debate_report,
    set_debate_extended_rebuttals,
    update_debate_status,
)


@dataclass
class DebateRunResult:
    debate_id: str
    status: str


@dataclass
class DebateStepResult:
    step_type: Literal["round", "mediation"]
    round_index: int | None = None
    round: dict[str, Any] | None = None
    step_summary: str | None = None
    report: dict[str, Any] | None = None
    status: str | None = None


@dataclass
class DebateStepError(Exception):
    status_code: int
    code: str
    message: str


def _extract_content(response: Any) -> str:
    if hasattr(response, "model_dump"):
        response = response.model_dump()
    if not isinstance(response, dict):
        return str(response)

    choices = response.get("choices", [])
    if not choices:
        return ""

    message = choices[0].get("message", {})
    content = message.get("content", "")

    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                text = block.get("text", "")
                if text:
                    parts.append(text)
        return "\n".join(parts).strip()

    return str(content).strip()


def _build_system_prompts(record: dict[str, Any]) -> tuple[str, str]:
    config = record.get("config_json", {}) or {}
    mediator_prefs = config.get("mediator_prefs", {}) or {}

    explain_like_12yo = bool(mediator_prefs.get("explain_like_12yo", False))
    rigor_formal = bool(mediator_prefs.get("rigor_formal", True))
    point_out_fallacies = bool(mediator_prefs.get("point_out_fallacies", True))
    steelman_other_side = bool(mediator_prefs.get("steelman_other_side", False))

    debater_style_parts: list[str] = []
    if explain_like_12yo:
        debater_style_parts.append("explique de forma simples, como para alguém de 12 anos.")
    if rigor_formal:
        debater_style_parts.append("mantenha bom rigor lógico, deixando claras premissas e conclusões.")
    if point_out_fallacies:
        debater_style_parts.append("evite falácias lógicas e ataque ideias, não pessoas.")
    debater_style = " ".join(debater_style_parts)

    system_prompt_debater = (
        "Você é um agente de debate em português. "
        "Estruture suas respostas de forma clara e objetiva. "
        f"{debater_style}"
    ).strip()

    mediator_style_parts = []
    if explain_like_12yo:
        mediator_style_parts.append("explique de forma acessível, como para alguém de 12 anos.")
    if rigor_formal:
        mediator_style_parts.append("mantenha rigor lógico e explicite o encadeamento dos argumentos.")
    if point_out_fallacies:
        mediator_style_parts.append("aponte possíveis falácias ou fraquezas de raciocínio de cada lado.")
    if steelman_other_side:
        mediator_style_parts.append("quando possível, apresente a versão mais forte (steelman) de cada lado.")
    mediator_style = " ".join(mediator_style_parts)

    mediator_system_prompt = (
        "Você é um mediador imparcial de debates em português. "
        f"{mediator_style}"
    ).strip()

    return system_prompt_debater, mediator_system_prompt


def _turn_type(turn_index: int, extended: bool) -> str:
    """Retorna opening, rebuttal ou closing para o turn_index dado."""
    if turn_index < 2:
        return "opening"
    if turn_index < 4:
        return "rebuttal"
    if extended:
        if turn_index < 6:
            return "rebuttal"
        return "closing"
    return "closing"


def _speaker(turn_index: int) -> str:
    """debater_a = Pro (par), debater_b = Con (ímpar)."""
    return "debater_a" if turn_index % 2 == 0 else "debater_b"


def _history_from_rounds(rounds: list[dict[str, Any]]) -> list[dict[str, str]]:
    """Lista de {role, content} em ordem, um por round (cada round tem 1 mensagem)."""
    out: list[dict[str, str]] = []
    for r in sorted(rounds, key=lambda x: x["index"]):
        msgs = r.get("messages") or []
        if msgs:
            out.append({"role": msgs[0]["role"], "content": msgs[0]["content"]})
    return out


def _generate_turn(
    question: str,
    turn_index: int,
    history: list[dict[str, str]],
    system_prompt_debater: str,
    extended: bool,
) -> dict[str, Any]:
    """Gera uma única fala (um turno). Retorna { role, content } e tipo do turno."""
    turn_type = _turn_type(turn_index, extended)
    speaker = _speaker(turn_index)

    if turn_type == "opening":
        if speaker == "debater_a":
            user_prompt = (
                "Você é o debatedor a favor (Pro).\n"
                f"Tese: {question}\n\n"
                "Faça uma fala de abertura apresentando os principais argumentos "
                "a favor da tese, em até 4 tópicos numerados + 1 parágrafo curto de conclusão."
            )
        else:
            user_prompt = (
                "Você é o debatedor contra (Con).\n"
                f"Tese: {question}\n\n"
                "Faça uma fala de abertura apresentando os principais argumentos "
                "contra a tese, em até 4 tópicos numerados + 1 parágrafo curto de conclusão."
            )
    elif turn_type == "rebuttal":
        # Quem fala agora responde ao que o outro já disse (histórico).
        other_side = "Pro (a favor)" if speaker == "debater_b" else "Contra (Con)"
        history_text = "\n\n".join(
            f"Fala {i+1} ({'Pro' if h['role'] == 'debater_a' else 'Con'}):\n{h['content']}"
            for i, h in enumerate(history)
        )
        user_prompt = (
            f"Você é o debatedor {'a favor (Pro)' if speaker == 'debater_a' else 'contra (Con)'}.\n"
            f"Tese: {question}\n\n"
            "Abaixo estão as falas anteriores do debate, em ordem.\n\n"
            f"{history_text}\n\n"
            "Faça uma réplica focada em refutar os pontos principais do outro lado, "
            "em até 4 tópicos numerados + 1 parágrafo curto. Aponte premissas fracas ou questionáveis."
        )
    else:
        # closing
        history_text = "\n\n".join(
            f"Fala {i+1} ({'Pro' if h['role'] == 'debater_a' else 'Con'}):\n{h['content']}"
            for i, h in enumerate(history)
        )
        user_prompt = (
            f"Você é o debatedor {'a favor (Pro)' if speaker == 'debater_a' else 'contra (Con)'}.\n"
            f"Tese: {question}\n\n"
            "Abaixo está o debate até agora:\n\n"
            f"{history_text}\n\n"
            "Faça um fechamento curto: resuma em até 3 bullets os pontos mais fortes do seu lado "
            "e finalize com 1 parágrafo reforçando por que o público deveria concordar com você."
        )

    response = llm_generate(
        role="debater",
        messages=[
            {"role": "system", "content": system_prompt_debater},
            {"role": "user", "content": user_prompt},
        ],
    )
    content = _extract_content(response)
    return {"role": speaker, "content": content}


def _generate_step_summary(question: str, round_data: dict[str, Any]) -> str:
    """Resumo de qualidade para um único turno (uma mensagem)."""
    msgs = round_data.get("messages") or []
    if not msgs:
        return ""
    single = msgs[0]
    role_label = "Pro" if single["role"] == "debater_a" else "Con"
    round_type = round_data.get("type", "round")

    response = llm_generate(
        role="mediator",
        messages=[
            {
                "role": "system",
                "content": (
                    "Você é um avaliador de qualidade argumentativa em debates. "
                    "Responda em português com objetividade."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Tese: {question}\n"
                    f"Momento: {round_type} – fala do lado {role_label}\n\n"
                    f"Fala:\n{single['content']}\n\n"
                    "Escreva um resumo de qualidade em 2 a 4 frases: "
                    "forças argumentativas e possíveis falhas lógicas."
                ),
            },
        ],
    )
    return _extract_content(response)


def _chunk_text(text: str, chunk_size: int = 6) -> list[str]:
    words = text.split()
    if not words:
        return [""]
    chunks: list[str] = []
    for i in range(0, len(words), chunk_size):
        piece = " ".join(words[i : i + chunk_size]).strip()
        if piece:
            chunks.append(f"{piece} ")
    return chunks


def _iter_typed_chunks(text: str, chunk_size: int = 6, delay_seconds: float = 0.035) -> Iterator[str]:
    for chunk in _chunk_text(text, chunk_size=chunk_size):
        yield chunk
        time.sleep(delay_seconds)


def _rounds_as_text(rounds: list[dict[str, Any]]) -> str:
    """Formato para o mediador: cada round tem 1 mensagem."""
    lines: list[str] = []
    for r in sorted(rounds, key=lambda x: x["index"]):
        msgs = r.get("messages") or []
        t = r.get("type", "round")
        if msgs:
            m = msgs[0]
            label = "Pro" if m["role"] == "debater_a" else "Con"
            lines.append(f"Turno {r['index'] + 1} ({t}) – {label}:\n{m['content']}")
    return "\n\n".join(lines)


def _generate_mediator_report(
    question: str,
    rounds: list[dict[str, Any]],
    mediator_system_prompt: str,
) -> str:
    mediator_user_prompt = (
        f"Você é o mediador de um debate sobre a tese: {question}.\n\n"
        "Abaixo estão os turnos do debate (cada fala em ordem):\n\n"
        f"{_rounds_as_text(rounds)}\n\n"
        "Produza uma síntese final em Markdown seguindo EXATAMENTE esta estrutura:\n"
        "1. **Resumo dos argumentos do lado Pro** (em bullets).\n"
        "2. **Resumo dos argumentos do lado Contra** (em bullets).\n"
        "3. **Análise crítica** comparando forças e fraquezas de cada lado.\n"
        "4. **Conclusão**:\n"
        "   - Em UMA linha, escreva `final_outcome: pro`, `final_outcome: con`, "
        "`final_outcome: inconclusivo` ou `final_outcome: depende`.\n"
        "   - Em seguida, explique em 2–3 frases por que você escolheu esse desfecho.\n"
    )
    report_response = llm_generate(
        role="mediator",
        messages=[
            {"role": "system", "content": mediator_system_prompt},
            {"role": "user", "content": mediator_user_prompt},
        ],
    )
    return _extract_content(report_response)


def _total_turns(extended: bool) -> int:
    return 8 if extended else 6


def run_next_step(debate_id: str, *, extend: bool = False) -> DebateStepResult:
    record = get_debate(debate_id)
    if record is None:
        raise DebateStepError(status_code=404, code="DEBATE_NOT_FOUND", message="Debate não encontrado.")

    status = record.get("status", "")
    if status in {"completed", "failed"}:
        raise DebateStepError(
            status_code=409,
            code="DEBATE_ALREADY_FINISHED",
            message="Debate já finalizado; não há próximo step.",
        )
    if status not in {"draft", "running"}:
        raise DebateStepError(
            status_code=409,
            code="DEBATE_NOT_DRAFT",
            message="Debate não está em estado executável.",
        )

    question = record["question"]
    config = record.get("config_json") or {}
    extended_rebuttals = bool(config.get("extended_rebuttals", False))
    rounds = record.get("rounds", [])
    report = record.get("report", {}) or {}
    system_prompt_debater, mediator_system_prompt = _build_system_prompts(record)

    # Se estamos exatamente após a réplica do Con (4 turnos) e o usuário pediu aprofundar, ativar flag
    if extend and len(rounds) == 4 and not extended_rebuttals:
        set_debate_extended_rebuttals(debate_id)
        extended_rebuttals = True
        record = get_debate(debate_id) or record
        config = record.get("config_json") or {}

    total = _total_turns(extended_rebuttals)
    turn_index = len(rounds)

    try:
        if turn_index < total:
            if status == "draft":
                update_debate_status(debate_id, "running")

            history = _history_from_rounds(rounds)
            single_message = _generate_turn(
                question=question,
                turn_index=turn_index,
                history=history,
                system_prompt_debater=system_prompt_debater,
                extended=extended_rebuttals,
            )
            turn_type = _turn_type(turn_index, extended_rebuttals)

            round_data = {
                "index": turn_index,
                "type": turn_type,
                "messages": [single_message],
            }
            step_summary = _generate_step_summary(question=question, round_data=round_data)
            append_round_and_summary(debate_id=debate_id, round_data=round_data, step_summary=step_summary)
            return DebateStepResult(
                step_type="round",
                round_index=turn_index,
                round=round_data,
                step_summary=step_summary,
                status="running",
            )

        if report.get("content_md"):
            raise DebateStepError(
                status_code=409,
                code="DEBATE_ALREADY_FINISHED",
                message="Debate já finalizado; não há próximo step.",
            )

        if status == "draft":
            update_debate_status(debate_id, "running")
        record = get_debate(debate_id) or record
        rounds = record.get("rounds", [])
        report_content = _generate_mediator_report(
            question=question,
            rounds=rounds,
            mediator_system_prompt=mediator_system_prompt,
        )
        save_debate_report(debate_id=debate_id, report={"content_md": report_content})
        update_debate_status(debate_id, "completed")
        return DebateStepResult(
            step_type="mediation",
            report={"content_md": report_content},
            status="completed",
        )
    except DebateStepError:
        raise
    except Exception:
        update_debate_status(debate_id, "failed")
        raise


def run_next_step_stream(debate_id: str, *, extend: bool = False) -> Iterator[dict[str, Any]]:
    record = get_debate(debate_id)
    if record is None:
        raise DebateStepError(status_code=404, code="DEBATE_NOT_FOUND", message="Debate não encontrado.")

    status = record.get("status", "")
    if status in {"completed", "failed"}:
        raise DebateStepError(
            status_code=409,
            code="DEBATE_ALREADY_FINISHED",
            message="Debate já finalizado; não há próximo step.",
        )
    if status not in {"draft", "running"}:
        raise DebateStepError(
            status_code=409,
            code="DEBATE_NOT_DRAFT",
            message="Debate não está em estado executável.",
        )

    question = record["question"]
    config = record.get("config_json") or {}
    extended_rebuttals = bool(config.get("extended_rebuttals", False))
    rounds = record.get("rounds", [])
    report = record.get("report", {}) or {}

    if extend and len(rounds) == 4 and not extended_rebuttals:
        set_debate_extended_rebuttals(debate_id)
        extended_rebuttals = True
        record = get_debate(debate_id) or record

    total = _total_turns(extended_rebuttals)
    turn_index = len(rounds)
    system_prompt_debater, mediator_system_prompt = _build_system_prompts(record)

    try:
        if turn_index < total:
            if status == "draft":
                update_debate_status(debate_id, "running")

            turn_type = _turn_type(turn_index, extended_rebuttals)
            speaker = _speaker(turn_index)
            yield {
                "event": "phase",
                "data": {
                    "phase": "round_start",
                    "round_index": turn_index,
                    "round_type": turn_type,
                    "speaker": speaker,
                },
            }

            history = _history_from_rounds(rounds)
            single_message = _generate_turn(
                question=question,
                turn_index=turn_index,
                history=history,
                system_prompt_debater=system_prompt_debater,
                extended=extended_rebuttals,
            )

            content = single_message["content"]
            yield {"event": "message_start", "data": {"target": speaker, "round_index": turn_index, "round_type": turn_type}}
            for chunk in _iter_typed_chunks(content, chunk_size=4, delay_seconds=0.04):
                yield {"event": "message_chunk", "data": {"target": speaker, "chunk": chunk}}
            yield {"event": "message_end", "data": {"target": speaker}}

            round_data = {
                "index": turn_index,
                "type": turn_type,
                "messages": [single_message],
            }
            yield {"event": "phase", "data": {"phase": "summary_start", "round_index": turn_index}}
            step_summary = _generate_step_summary(question=question, round_data=round_data)
            yield {"event": "message_start", "data": {"target": "step_summary", "round_index": turn_index}}
            for chunk in _iter_typed_chunks(step_summary, chunk_size=5, delay_seconds=0.035):
                yield {"event": "message_chunk", "data": {"target": "step_summary", "chunk": chunk}}
            yield {"event": "message_end", "data": {"target": "step_summary"}}

            append_round_and_summary(debate_id=debate_id, round_data=round_data, step_summary=step_summary)
            yield {
                "event": "step_done",
                "data": {
                    "step_type": "round",
                    "round_index": turn_index,
                    "round": round_data,
                    "step_summary": step_summary,
                    "status": "running",
                },
            }
            return

        if report.get("content_md"):
            raise DebateStepError(
                status_code=409,
                code="DEBATE_ALREADY_FINISHED",
                message="Debate já finalizado; não há próximo step.",
            )

        if status == "draft":
            update_debate_status(debate_id, "running")
        record = get_debate(debate_id) or record
        rounds = record.get("rounds", [])
        yield {"event": "phase", "data": {"phase": "mediation_start"}}
        report_content = _generate_mediator_report(
            question=question,
            rounds=rounds,
            mediator_system_prompt=mediator_system_prompt,
        )
        yield {"event": "message_start", "data": {"target": "report"}}
        for chunk in _iter_typed_chunks(report_content, chunk_size=7, delay_seconds=0.03):
            yield {"event": "message_chunk", "data": {"target": "report", "chunk": chunk}}
        yield {"event": "message_end", "data": {"target": "report"}}

        save_debate_report(debate_id=debate_id, report={"content_md": report_content})
        update_debate_status(debate_id, "completed")
        yield {
            "event": "step_done",
            "data": {
                "step_type": "mediation",
                "report": {"content_md": report_content},
                "status": "completed",
            },
        }
    except DebateStepError:
        raise
    except Exception:
        update_debate_status(debate_id, "failed")
        raise


def run_debate(debate_id: str) -> DebateRunResult:
    """Executa o debate completo (6 ou 8 turnos + mediação) de forma síncrona."""
    record = get_debate(debate_id)
    if record is None:
        raise ValueError("Debate not found")

    if record["status"] != "draft":
        return DebateRunResult(debate_id=debate_id, status=record["status"])

    try:
        while True:
            result = run_next_step(debate_id)
            if result.step_type == "mediation":
                break

        final_record = get_debate(debate_id)
        final_status = "completed" if final_record is None else final_record.get("status", "completed")
        return DebateRunResult(debate_id=debate_id, status=final_status)
    except DebateStepError as exc:
        if exc.code == "DEBATE_ALREADY_FINISHED":
            final_record = get_debate(debate_id)
            final_status = "completed" if final_record is None else final_record.get("status", "completed")
            return DebateRunResult(debate_id=debate_id, status=final_status)
        raise
    except Exception:
        update_debate_status(debate_id, "failed")
        raise
