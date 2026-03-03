import os
from dataclasses import dataclass
from threading import Lock

import jwt
from jwt import PyJWKClient


@dataclass
class AuthValidationError(Exception):
    status_code: int
    code: str
    message: str


_jwk_client_lock = Lock()
_jwk_client: PyJWKClient | None = None
_jwk_client_url: str | None = None


def _resolve_jwks_url() -> str | None:
    configured = os.getenv("CLERK_JWKS_URL")
    if configured:
        return configured
    issuer = os.getenv("CLERK_ISSUER")
    if issuer:
        return f"{issuer.rstrip('/')}/.well-known/jwks.json"
    return None


def _get_jwk_client(jwks_url: str) -> PyJWKClient:
    global _jwk_client, _jwk_client_url
    with _jwk_client_lock:
        if _jwk_client is None or _jwk_client_url != jwks_url:
            _jwk_client = PyJWKClient(jwks_url)
            _jwk_client_url = jwks_url
        return _jwk_client


def _extract_bearer_token(authorization_header: str | None) -> str | None:
    if authorization_header is None:
        return None
    raw = authorization_header.strip()
    if not raw:
        return None
    if not raw.lower().startswith("bearer "):
        raise AuthValidationError(
            status_code=401,
            code="AUTH_INVALID_TOKEN",
            message="Header Authorization inválido.",
        )
    token = raw[7:].strip()
    if not token:
        raise AuthValidationError(
            status_code=401,
            code="AUTH_INVALID_TOKEN",
            message="Token de autenticação ausente.",
        )
    return token


def get_clerk_user_id(authorization_header: str | None) -> str | None:
    token = _extract_bearer_token(authorization_header)
    if token is None:
        return None

    jwks_url = _resolve_jwks_url()
    if not jwks_url:
        raise AuthValidationError(
            status_code=500,
            code="AUTH_MISCONFIGURED",
            message="Autenticação não configurada no backend (CLERK_JWKS_URL/CLERK_ISSUER).",
        )

    try:
        jwk_client = _get_jwk_client(jwks_url)
        signing_key = jwk_client.get_signing_key_from_jwt(token)
        issuer = os.getenv("CLERK_ISSUER")
        if issuer:
            issuer = issuer.rstrip("/")
        decode_options = {
            "verify_aud": False,
            "verify_iss": bool(issuer),
        }
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options=decode_options,
            issuer=issuer,
        )
    except Exception as exc:  # noqa: BLE001
        raise AuthValidationError(
            status_code=401,
            code="AUTH_INVALID_TOKEN",
            message="Token de autenticação inválido ou expirado.",
        ) from exc

    user_id = payload.get("sub")
    if not isinstance(user_id, str) or not user_id:
        raise AuthValidationError(
            status_code=401,
            code="AUTH_INVALID_TOKEN",
            message="Token sem identificador de usuário válido.",
        )
    return user_id
