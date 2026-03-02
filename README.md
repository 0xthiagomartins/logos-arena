Aqui está um README direto ao ponto, técnico e objetivo:

---

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

## Current Status

This project is under active development.

The initial version focuses on:

* Two debaters (Pro vs Con)
* Fixed debate rounds
* Mediator summary report
* Streaming execution

---

## Vision

Move from simple AI conversations to structured, logic-driven debate systems with explainable outcomes.

---

More documentation and implementation details will be added as development progresses.
