from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from logos_arena_backend.llm_provider import generate as llm_generate
from logos_arena_backend.store import (
    get_debate,
    save_debate_rounds_and_report,
    update_debate_status,
)


@dataclass
class DebateRunResult:
    debate_id: str
    status: str


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


def run_debate(debate_id: str) -> DebateRunResult:
    """Executa o debate completo (3 rounds + mediação) de forma síncrona.

    MVP: apenas muda o status de draft -> running -> completed e faz
    chamadas de LLM para simular os três rounds, sem ainda persistir
    cada mensagem individualmente.
    """
    record = get_debate(debate_id)
    if record is None:
        raise ValueError("Debate not found")

    if record["status"] != "draft":
        return DebateRunResult(debate_id=debate_id, status=record["status"])

    question = record["question"]

    # Marca como running
    update_debate_status(debate_id, "running")

    system_prompt = (
        "Você é um agente de debate em português. "
        "Estruture suas respostas de forma clara e objetiva."
    )

    rounds_spec = [
        ("opening", "Debata a favor da tese", "Debata contra a tese"),
        ("rebuttal", "Faça a réplica a favor da tese", "Faça a réplica contra a tese"),
        ("closing", "Faça o fechamento a favor da tese", "Faça o fechamento contra a tese"),
    ]
    rounds_output: list[dict[str, Any]] = []

    try:
        for idx, (round_type, pro_prompt, con_prompt) in enumerate(rounds_spec):
            pro_response = llm_generate(
                role="debater",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"{pro_prompt}: {question} (round: {round_type})"},
                ],
            )
            con_response = llm_generate(
                role="debater",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"{con_prompt}: {question} (round: {round_type})"},
                ],
            )

            rounds_output.append(
                {
                    "index": idx,
                    "type": round_type,
                    "messages": [
                        {"role": "debater_a", "content": _extract_content(pro_response)},
                        {"role": "debater_b", "content": _extract_content(con_response)},
                    ],
                }
            )

        rounds_as_text = "\n\n".join(
            [
                (
                    f"Round {round_info['index']} ({round_info['type']}):\n"
                    f"Pro: {round_info['messages'][0]['content']}\n"
                    f"Con: {round_info['messages'][1]['content']}"
                )
                for round_info in rounds_output
            ]
        )

        report_response = llm_generate(
            role="mediator",
            messages=[
                {"role": "system", "content": "Você é um mediador imparcial de debates."},
                {
                    "role": "user",
                    "content": (
                        f"Faça uma síntese final e um veredito para o debate sobre: {question}.\n\n"
                        f"Considere estes rounds:\n{rounds_as_text}"
                    ),
                },
            ],
        )

        save_debate_rounds_and_report(
            debate_id=debate_id,
            rounds=rounds_output,
            report={"content_md": _extract_content(report_response)},
        )
        update_debate_status(debate_id, "completed")
        return DebateRunResult(debate_id=debate_id, status="completed")
    except Exception:
        update_debate_status(debate_id, "failed")
        raise
