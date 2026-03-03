[![Logos Arena](https://raw.githubusercontent.com/0xthiagomartins/logos-arena/refs/heads/main/assets/banner.gif)](https://raw.githubusercontent.com/0xthiagomartins/logos-arena/refs/heads/main/assets/banner.gif)

**Structured AI-powered debate engine** for controversial and complex questions. Two sides, fixed rounds, a mediator agent, and explainable outcomes.

![Status](https://img.shields.io/badge/status-in%20development-yellow) ![Backend](https://img.shields.io/badge/backend-FastAPI-009688) ![Frontend](https://img.shields.io/badge/frontend-Next.js%2015-000000) ![LLM](https://img.shields.io/badge/LLM-LiteLLM%20%7C%20OpenAI-412991)

---

## What it is

LogosArena turns polarising questions into **structured debates**: Pro vs Con, multiple rounds (opening → rebuttal → closing), and a **mediator** that summarises and scores the arguments. You get a final report instead of a single opaque answer.

---

## Tech stack

| Layer    | Stack |
|----------|--------|
| Backend  | FastAPI (Python 3.14+), LiteLLM, in-memory store (MVP) |
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS |
| LLM      | OpenAI `gpt-4o-mini` (MVP); multi-model later |

---

## Quick start

**Backend**

```bash
cd backend
uv sync
cp .env.example .env   # set OPENAI_API_KEY + Clerk vars
uv run uvicorn logos_arena_backend.main:app --reload
```

API: `http://localhost:8000` — see [context/specs/03-api-persistence.md](context/specs/03-api-persistence.md) for endpoints.

**Frontend**

```bash
cd frontend
cp .env.example .env   # NEXT_PUBLIC_API_URL + NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
npm install
npm run dev
```

App: `http://localhost:3000`.

### Auth + anonymous trial rule (MVP)

- Anonymous users can create only **1 debate per client/device**.
- After the first anonymous debate, creating a new debate requires login/signup via Clerk.
- Backend enforces the same rule using `X-Client-Id` + Clerk token validation.
- Backend env for Clerk: `CLERK_ISSUER` (or `CLERK_JWKS_URL`).

---

## Vision

Move from ad-hoc AI chat to **structured, logic-driven debates** with traceable reasoning and explainable outcomes.
