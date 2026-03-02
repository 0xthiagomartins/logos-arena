# LogosArena

Structured AI-powered debate engine for controversial and complex questions.

⚠️ **Status: In Development**

---

## Overview

LogosArena is a SaaS platform designed to structure debates using multiple AI agents with defined roles and controlled reasoning flows.

Instead of unstructured chat responses, the system enforces:

* Formal debate rounds (opening, rebuttal, closing)
* Defined debater personas
* A mediator agent that synthesizes logic
* Structured outputs (claims, supports, attacks, assumptions)
* Optional evidence retrieval (web search in future plans)

The goal is to transform divisive questions into traceable, auditable reasoning processes.

---

## Core Concepts

* **Debaters**: AI agents with explicit stance and style.
* **Mediator**: Synthesizes arguments and enforces rules.
* **Debate Engine**: State-machine driven rounds.
* **Structured Reasoning**: JSON-based output contracts.
* **Evidence Layer** (planned): Web-backed citations.

---

## Planned Stack

* Backend: FastAPI (Python)
* Frontend: Next.js
* Database: PostgreSQL
* Queue/Jobs: Redis
* LLM Provider abstraction (multi-model support)

---

## MVP Scope

The first release is scoped to (see full definition in [context/specs/01-domain-config.md](context/specs/01-domain-config.md) §1.1):

* 2 debaters (Pro vs Con)
* 3 fixed rounds: opening, rebuttal, closing + mediator report
* No automated web search (manual/placeholder only)
* No billing (free plan only)
* Single language: pt-BR

---

## Current Status

This project is under active development.

The initial version focuses on:

* Two debaters (Pro vs Con)
* Fixed debate rounds
* Mediator summary report
* Streaming execution

---

## Getting Started

* **Backend** (FastAPI) will live under `backend/`.
* **Frontend** (Next.js) will live under `frontend/`.
* Run commands will be documented here once the first boilerplate is in place.

---

## Documentation

* [User guide (non-technical users)](docs/README.md) — how to use LogosArena in plain language.
* [Technical specification (for devs/agents)](context/README.md) — domain, API, persistence, roadmap (context/specs/).

---

## Vision

Move from simple AI conversations to structured, logic-driven debate systems with explainable outcomes.

---

More documentation and implementation details will be added as development progresses.
