from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterator, Literal

from logos_arena_backend.llm_provider import generate as llm_generate
from logos_arena_backend.store import (
    append_round_and_summary,
    get_debate,
    save_debate_report,
    update_debate_status,
)


ROUND_TYPES = ["opening", "rebuttal", "closing"]


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
    config = record.get("config_json", {})
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

    mediator_style_parts: list[str] = []
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


def _generate_round(
    question: str,
    round_index: int,
    system_prompt_debater: str,
    rounds_so_far: list[dict[str, Any]],
) -> dict[str, Any]:
    if round_index == 0:
        pro_user_prompt = (
            "Você é o debatedor a favor (Pro).\n"
            f"Tese: {question}\n\n"
            "Faça uma fala de abertura apresentando os principais argumentos "
            "a favor da tese, em até 4 tópicos numerados + 1 parágrafo curto "
            "de conclusão."
        )
        con_user_prompt = (
            "Você é o debatedor contra (Con).\n"
            f"Tese: {question}\n\n"
            "Faça uma fala de abertura apresentando os principais argumentos "
            "contra a tese, em até 4 tópicos numerados + 1 parágrafo curto "
            "de conclusão."
        )
    elif round_index == 1:
        opening_round = rounds_so_far[0]
        opening_pro_text = opening_round["messages"][0]["content"]
        opening_con_text = opening_round["messages"][1]["content"]
        pro_user_prompt = (
            "Você é o debatedor a favor (Pro).\n"
            f"Tese: {question}\n\n"
            "Abaixo está a fala de abertura do lado Contra (Con). "
            "Faça uma réplica focada em refutar os pontos principais, "
            "sem repetir toda a sua abertura.\n\n"
            "=== Abertura do lado Contra ===\n"
            f"{opening_con_text}\n\n"
            "Responda em até 4 tópicos numerados, apontando especificamente "
            "quais premissas ou interpretações você considera fracas ou "
            "questionáveis, e conclua com 1 parágrafo curto."
        )
        con_user_prompt = (
            "Você é o debatedor contra (Con).\n"
            f"Tese: {question}\n\n"
            "Abaixo está a fala de abertura do lado Pro (a favor). "
            "Faça uma réplica focada em refutar os pontos principais, "
            "sem repetir toda a sua abertura.\n\n"
            "=== Abertura do lado Pro ===\n"
            f"{opening_pro_text}\n\n"
            "Responda em até 4 tópicos numerados, apontando especificamente "
            "quais premissas ou interpretações você considera fracas ou "
            "questionáveis, e conclua com 1 parágrafo curto."
        )
    elif round_index == 2:
        pro_user_prompt = (
            "Você é o debatedor a favor (Pro).\n"
            f"Tese: {question}\n\n"
            "Com base na sua própria abertura e réplica, e também na posição "
            "do lado Contra, faça um fechamento curto.\n\n"
            "Resuma em até 3 bullets os pontos que você considera mais fortes "
            "a favor da tese e finalize com 1 parágrafo curto reforçando por "
            "que o público deveria concordar com você."
        )
        con_user_prompt = (
            "Você é o debatedor contra (Con).\n"
            f"Tese: {question}\n\n"
            "Com base na sua própria abertura e réplica, e também na posição "
            "do lado Pro, faça um fechamento curto.\n\n"
            "Resuma em até 3 bullets os pontos que você considera mais fortes "
            "contra a tese e finalize com 1 parágrafo curto reforçando por "
            "que o público deveria concordar com você."
        )
    else:
        raise ValueError(f"Round index inválido: {round_index}")

    pro_response = llm_generate(
        role="debater",
        messages=[
            {"role": "system", "content": system_prompt_debater},
            {"role": "user", "content": pro_user_prompt},
        ],
    )
    con_response = llm_generate(
        role="debater",
        messages=[
            {"role": "system", "content": system_prompt_debater},
            {"role": "user", "content": con_user_prompt},
        ],
    )

    return {
        "index": round_index,
        "type": ROUND_TYPES[round_index],
        "messages": [
            {"role": "debater_a", "content": _extract_content(pro_response)},
            {"role": "debater_b", "content": _extract_content(con_response)},
        ],
    }


def _generate_step_summary(question: str, round_data: dict[str, Any]) -> str:
    pro_text = round_data["messages"][0]["content"]
    con_text = round_data["messages"][1]["content"]
    round_type = round_data["type"]

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
                    f"Round: {round_type}\n\n"
                    f"Argumentos do lado Pro:\n{pro_text}\n\n"
                    f"Argumentos do lado Con:\n{con_text}\n\n"
                    "Escreva um resumo de qualidade deste round em 2 a 4 frases, "
                    "apontando forças argumentativas e possíveis falhas lógicas de cada lado."
                ),
            },
        ],
    )
    return _extract_content(response)


def _chunk_text(text: str, chunk_size: int = 28) -> list[str]:
    words = text.split()
    if not words:
        return [""]
    chunks: list[str] = []
    for i in range(0, len(words), chunk_size):
        piece = " ".join(words[i : i + chunk_size]).strip()
        if piece:
            chunks.append(f"{piece} ")
    return chunks


def _rounds_as_text(rounds: list[dict[str, Any]]) -> str:
    return "\n\n".join(
        [
            (
                f"Round {round_info['index']} ({round_info['type']}):\n"
                f"Pro: {round_info['messages'][0]['content']}\n"
                f"Con: {round_info['messages'][1]['content']}"
            )
            for round_info in rounds
        ]
    )


def _generate_mediator_report(
    question: str,
    rounds: list[dict[str, Any]],
    mediator_system_prompt: str,
) -> str:
    mediator_user_prompt = (
        f"Você é o mediador de um debate sobre a tese: {question}.\n\n"
        "Abaixo estão os rounds do debate (lado Pro e lado Con):\n\n"
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


def run_next_step(debate_id: str) -> DebateStepResult:
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
    rounds = record.get("rounds", [])
    report = record.get("report", {}) or {}
    system_prompt_debater, mediator_system_prompt = _build_system_prompts(record)

    try:
        if len(rounds) < 3:
            if status == "draft":
                update_debate_status(debate_id, "running")
            round_index = len(rounds)
            round_data = _generate_round(
                question=question,
                round_index=round_index,
                system_prompt_debater=system_prompt_debater,
                rounds_so_far=rounds,
            )
            step_summary = _generate_step_summary(question=question, round_data=round_data)
            append_round_and_summary(debate_id=debate_id, round_data=round_data, step_summary=step_summary)
            return DebateStepResult(
                step_type="round",
                round_index=round_index,
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


def run_next_step_stream(debate_id: str) -> Iterator[dict[str, Any]]:
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
    rounds = record.get("rounds", [])
    report = record.get("report", {}) or {}
    system_prompt_debater, mediator_system_prompt = _build_system_prompts(record)

    try:
        if len(rounds) < 3:
            if status == "draft":
                update_debate_status(debate_id, "running")
            round_index = len(rounds)
            round_type = ROUND_TYPES[round_index]
            yield {"event": "phase", "data": {"phase": "round_start", "round_index": round_index, "round_type": round_type}}

            round_data = _generate_round(
                question=question,
                round_index=round_index,
                system_prompt_debater=system_prompt_debater,
                rounds_so_far=rounds,
            )

            pro_text = round_data["messages"][0]["content"]
            con_text = round_data["messages"][1]["content"]

            yield {
                "event": "message_start",
                "data": {"target": "debater_a", "round_index": round_index, "round_type": round_type},
            }
            for chunk in _chunk_text(pro_text):
                yield {"event": "message_chunk", "data": {"target": "debater_a", "chunk": chunk}}
            yield {"event": "message_end", "data": {"target": "debater_a"}}

            yield {
                "event": "message_start",
                "data": {"target": "debater_b", "round_index": round_index, "round_type": round_type},
            }
            for chunk in _chunk_text(con_text):
                yield {"event": "message_chunk", "data": {"target": "debater_b", "chunk": chunk}}
            yield {"event": "message_end", "data": {"target": "debater_b"}}

            yield {"event": "phase", "data": {"phase": "summary_start", "round_index": round_index}}
            step_summary = _generate_step_summary(question=question, round_data=round_data)
            yield {"event": "message_start", "data": {"target": "step_summary", "round_index": round_index}}
            for chunk in _chunk_text(step_summary, chunk_size=24):
                yield {"event": "message_chunk", "data": {"target": "step_summary", "chunk": chunk}}
            yield {"event": "message_end", "data": {"target": "step_summary"}}

            append_round_and_summary(debate_id=debate_id, round_data=round_data, step_summary=step_summary)
            yield {
                "event": "step_done",
                "data": {
                    "step_type": "round",
                    "round_index": round_index,
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
        yield {"event": "phase", "data": {"phase": "mediation_start"}}
        report_content = _generate_mediator_report(
            question=question,
            rounds=rounds,
            mediator_system_prompt=mediator_system_prompt,
        )
        yield {"event": "message_start", "data": {"target": "report"}}
        for chunk in _chunk_text(report_content, chunk_size=32):
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
    """Executa o debate completo (3 rounds + mediação) de forma síncrona.

    Atualiza o status (draft -> running -> completed/failed),
    chama o LLM para Pro/Con em cada round e para o mediador,
    e persiste rounds + relatório em memória via store.
    """
    record = get_debate(debate_id)
    if record is None:
        raise ValueError("Debate not found")

    if record["status"] != "draft":
        return DebateRunResult(debate_id=debate_id, status=record["status"])

    try:
        for _ in range(4):
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
