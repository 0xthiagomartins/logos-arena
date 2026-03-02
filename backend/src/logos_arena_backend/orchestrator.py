from __future__ import annotations

from dataclasses import dataclass

from logos_arena_backend.llm_provider import generate as llm_generate
from logos_arena_backend.store import get_debate, update_debate_status


@dataclass
class DebateRunResult:
    debate_id: str
    status: str


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

    # Round 1: opening (Pro e Con)
    llm_generate(
        role="debater",
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": f"Debata a favor da tese: {question} (round: opening)",
            },
        ],
    )
    llm_generate(
        role="debater",
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": f"Debata contra a tese: {question} (round: opening)",
            },
        ],
    )

    # Round 2: rebuttal (Pro e Con)
    llm_generate(
        role="debater",
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": f"Faça a réplica a favor da tese: {question} (round: rebuttal)",
            },
        ],
    )
    llm_generate(
        role="debater",
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": f"Faça a réplica contra a tese: {question} (round: rebuttal)",
            },
        ],
    )

    # Round 3: closing (Pro e Con)
    llm_generate(
        role="debater",
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": f"Faça o fechamento a favor da tese: {question} (round: closing)",
            },
        ],
    )
    llm_generate(
        role="debater",
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": f"Faça o fechamento contra a tese: {question} (round: closing)",
            },
        ],
    )

    # Mediação final
    llm_generate(
        role="mediator",
        messages=[
            {"role": "system", "content": "Você é um mediador imparcial de debates."},
            {
                "role": "user",
                "content": f"Faça uma síntese final e um veredito para o debate sobre: {question}.",
            },
        ],
    )

    # Marca como completed
    update_debate_status(debate_id, "completed")

    return DebateRunResult(debate_id=debate_id, status="completed")

