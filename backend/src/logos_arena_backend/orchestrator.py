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

    Atualiza o status (draft -> running -> completed/failed),
    chama o LLM para Pro/Con em cada round e para o mediador,
    e persiste rounds + relatório em memória via store.
    """
    record = get_debate(debate_id)
    if record is None:
        raise ValueError("Debate not found")

    if record["status"] != "draft":
        return DebateRunResult(debate_id=debate_id, status=record["status"])

    question = record["question"]
    config = record.get("config_json", {})
    mediator_prefs = config.get("mediator_prefs", {}) or {}

    explain_like_12yo = bool(mediator_prefs.get("explain_like_12yo", False))
    rigor_formal = bool(mediator_prefs.get("rigor_formal", True))
    point_out_fallacies = bool(mediator_prefs.get("point_out_fallacies", True))
    steelman_other_side = bool(mediator_prefs.get("steelman_other_side", False))

    debater_style_parts: list[str] = []
    if explain_like_12yo:
        debater_style_parts.append(
            "explique de forma simples, como para alguém de 12 anos."
        )
    if rigor_formal:
        debater_style_parts.append(
            "mantenha bom rigor lógico, deixando claras premissas e conclusões."
        )
    if point_out_fallacies:
        debater_style_parts.append(
            "evite falácias lógicas e ataque ideias, não pessoas."
        )
    debater_style = " ".join(debater_style_parts)

    system_prompt_debater = (
        "Você é um agente de debate em português. "
        "Estruture suas respostas de forma clara e objetiva. "
        f"{debater_style}"
    ).strip()

    mediator_style_parts: list[str] = []
    if explain_like_12yo:
        mediator_style_parts.append(
            "explique de forma acessível, como para alguém de 12 anos."
        )
    if rigor_formal:
        mediator_style_parts.append(
            "mantenha rigor lógico e explicite o encadeamento dos argumentos."
        )
    if point_out_fallacies:
        mediator_style_parts.append(
            "aponte possíveis falácias ou fraquezas de raciocínio de cada lado."
        )
    if steelman_other_side:
        mediator_style_parts.append(
            "quando possível, apresente a versão mais forte (steelman) de cada lado."
        )
    mediator_style = " ".join(mediator_style_parts)

    # Marca como running
    update_debate_status(debate_id, "running")

    rounds_output: list[dict[str, Any]] = []

    try:
        # Round 0: opening (Pro e Con) — argumentos principais
        opening_pro_response = llm_generate(
            role="debater",
            messages=[
                {"role": "system", "content": system_prompt_debater},
                {
                    "role": "user",
                    "content": (
                        "Você é o debatedor a favor (Pro).\n"
                        f"Tese: {question}\n\n"
                        "Faça uma fala de abertura apresentando os principais argumentos "
                        "a favor da tese, em até 4 tópicos numerados + 1 parágrafo curto "
                        "de conclusão."
                    ),
                },
            ],
        )
        opening_con_response = llm_generate(
            role="debater",
            messages=[
                {"role": "system", "content": system_prompt_debater},
                {
                    "role": "user",
                    "content": (
                        "Você é o debatedor contra (Con).\n"
                        f"Tese: {question}\n\n"
                        "Faça uma fala de abertura apresentando os principais argumentos "
                        "contra a tese, em até 4 tópicos numerados + 1 parágrafo curto "
                        "de conclusão."
                    ),
                },
            ],
        )

        opening_pro_text = _extract_content(opening_pro_response)
        opening_con_text = _extract_content(opening_con_response)

        rounds_output.append(
            {
                "index": 0,
                "type": "opening",
                "messages": [
                    {"role": "debater_a", "content": opening_pro_text},
                    {"role": "debater_b", "content": opening_con_text},
                ],
            }
        )

        # Round 1: rebuttal — cada lado responde diretamente à abertura do outro
        rebuttal_pro_response = llm_generate(
            role="debater",
            messages=[
                {"role": "system", "content": system_prompt_debater},
                {
                    "role": "user",
                    "content": (
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
                    ),
                },
            ],
        )
        rebuttal_con_response = llm_generate(
            role="debater",
            messages=[
                {"role": "system", "content": system_prompt_debater},
                {
                    "role": "user",
                    "content": (
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
                    ),
                },
            ],
        )

        rebuttal_pro_text = _extract_content(rebuttal_pro_response)
        rebuttal_con_text = _extract_content(rebuttal_con_response)

        rounds_output.append(
            {
                "index": 1,
                "type": "rebuttal",
                "messages": [
                    {"role": "debater_a", "content": rebuttal_pro_text},
                    {"role": "debater_b", "content": rebuttal_con_text},
                ],
            }
        )

        # Round 2: closing — cada lado faz um fechamento curto
        closing_pro_response = llm_generate(
            role="debater",
            messages=[
                {"role": "system", "content": system_prompt_debater},
                {
                    "role": "user",
                    "content": (
                        "Você é o debatedor a favor (Pro).\n"
                        f"Tese: {question}\n\n"
                        "Com base na sua própria abertura e réplica, e também na posição "
                        "do lado Contra, faça um fechamento curto.\n\n"
                        "Resuma em até 3 bullets os pontos que você considera mais fortes "
                        "a favor da tese e finalize com 1 parágrafo curto reforçando por "
                        "que o público deveria concordar com você."
                    ),
                },
            ],
        )
        closing_con_response = llm_generate(
            role="debater",
            messages=[
                {"role": "system", "content": system_prompt_debater},
                {
                    "role": "user",
                    "content": (
                        "Você é o debatedor contra (Con).\n"
                        f"Tese: {question}\n\n"
                        "Com base na sua própria abertura e réplica, e também na posição "
                        "do lado Pro, faça um fechamento curto.\n\n"
                        "Resuma em até 3 bullets os pontos que você considera mais fortes "
                        "contra a tese e finalize com 1 parágrafo curto reforçando por "
                        "que o público deveria concordar com você."
                    ),
                },
            ],
        )

        closing_pro_text = _extract_content(closing_pro_response)
        closing_con_text = _extract_content(closing_con_response)

        rounds_output.append(
            {
                "index": 2,
                "type": "closing",
                "messages": [
                    {"role": "debater_a", "content": closing_pro_text},
                    {"role": "debater_b", "content": closing_con_text},
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

        mediator_system_prompt = (
            "Você é um mediador imparcial de debates em português. "
            f"{mediator_style}"
        ).strip()

        mediator_user_prompt = (
            f"Você é o mediador de um debate sobre a tese: {question}.\n\n"
            "Abaixo estão os rounds do debate (lado Pro e lado Con):\n\n"
            f"{rounds_as_text}\n\n"
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
