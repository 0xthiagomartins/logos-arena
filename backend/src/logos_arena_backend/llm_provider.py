from typing import Any, Literal, Optional

from litellm import completion


Role = Literal["debater", "mediator"]


def generate(
    role: Role,
    messages: list[dict[str, str]],
    max_tokens: int = 1024,
    tools: Optional[list[dict[str, Any]]] = None,
) -> dict[str, Any]:
    """
    Wrapper mínimo de LLM usando LiteLLM.

    MVP: usa apenas o modelo gpt-4o-mini via OPENAI_API_KEY.
    """
    # LiteLLM lê OPENAI_API_KEY do ambiente (.env.example mostra a var esperada)
    response = completion(
        model="gpt-4o-mini",
        messages=messages,
        max_tokens=max_tokens,
        tools=tools,
    )
    return response

