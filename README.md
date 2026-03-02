[![Logos Arena](assets/banner.png)](assets/banner.png)

**Structured AI-powered debate engine** for controversial and complex questions. Two sides, fixed rounds, a mediator agent, and explainable outcomes.

![Status](https://img.shields.io/badge/status-in%20development-yellow) ![Backend](https://img.shields.io/badge/backend-FastAPI-009688) ![Frontend](https://img.shields.io/badge/frontend-Next.js%2015-000000) ![LLM](https://img.shields.io/badge/LLM-LiteLLM%20%7C%20OpenAI-412991)

---

## What it is

LogosArena turns polarising questions into **structured debates**: Pro vs Con, multiple rounds (opening → rebuttal → closing), and a **mediator** that summarises and scores the arguments. You get a final report instead of a single opaque answer.

- **Step-by-step flow**: Run one round at a time, read a short **quality summary** per round, then click *Continuar* to generate the next.
- **Run full debate**: Or execute all rounds + mediation in one go.
- **Cypherpunk-style UI**: JetBrains Mono, green-on-black theme (Next.js + Tailwind).

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
cp .env.example .env   # set OPENAI_API_KEY
uv run uvicorn logos_arena_backend.main:app --reload
```

API: `http://localhost:8000` — see [context/specs/03-api-persistence.md](context/specs/03-api-persistence.md) for endpoints.

**Frontend**

```bash
cd frontend
cp .env.example .env   # NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev
```

App: `http://localhost:3000`.

---

## MVP scope

- **2 debaters** (Pro vs Con), **3 rounds** (opening, rebuttal, closing) + mediator report.
- **POST /debates** — create debate (draft).
- **POST /debates/{id}/step** — run next step (one round or mediation); returns round + quality summary.
- **POST /debates/{id}/run** — run full debate in one request.
- **GET /debates/{id}/rounds** — list rounds + `round_summaries`.
- **GET /debates/{id}/report** — mediator report (Markdown).
- No auth, no billing, no web search in MVP.

---

## Docs

- [User guide](docs/README.md) — for end users (plain language).
- [Context for devs/agents](context/README.md) — specs, API, and roadmap (`context/specs/`).

---

## Vision

Move from ad-hoc AI chat to **structured, logic-driven debates** with traceable reasoning and explainable outcomes.
