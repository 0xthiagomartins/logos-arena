# 🧠 LogosArena — AI Debate Framework

**LogosArena** is a modular, multilingual framework for orchestrating structured debates between AI agents with distinct worldviews, philosophies, or ethical systems.  
Users can dynamically create debates — defining agents, roles, topics, and rules via JSON — without hardcoding personas.

---

## 🌍 Key Features

- ⚙️ **Dynamic Debate Configuration** — Create debates from JSON files (no code required).  
- 🧩 **Agent Builder** — Interactive helper for designing agent personas.  
- 🔁 **Runtime Debate Engine** — Turn-based dialogue with optional moderator.  
- 🌐 **Internationalization (i18n)** — English (default) and Portuguese.  
- 🧭 **CLI & Web Interface** — Create and run debates from terminal or browser.  
- 🧠 **Expandable Architecture** — Designed for CrewAI, LangChain, and open research use cases.

---

## 🧱 System Architecture

LogosArena is divided into three core layers:

| Layer | Responsibility | Example |
|-------|----------------|----------|
| **Config Layer** | User-facing interface to define debates and agents. | “I want two agents to debate whether Christ was vegan.” |
| **Build Layer** | Parses JSON and dynamically instantiates agents. | Creates `Agent()` and `DebateSession()` objects in runtime. |
| **Debate Engine** | Orchestrates dialogue flow, turn management, and result synthesis. | Alternates messages and summarizes conclusions. |

---

## 📁 Repository Structure

```
logosarena/
│
├── README.md
├── src/
│   ├── main.py
│   ├── core/
│   │   ├── debate_engine.py
│   │   ├── debate_builder.py
│   │   └── json_loader.py
│   ├── ui/
│   │   ├── cli_interface.py
│   │   └── web_interface.py
│   ├── data/
│   │   ├── debates/
│   │   │   ├── christ_vegan_debate.json
│   │   │   └── free_will_debate.json
│   │   └── agents/
│   │       ├── templates/
│   │       │   ├── christian_vegan.txt
│   │       │   ├── christian_traditional.txt
│   │       │   └── philosopher.txt
│   │       └── user_agents.json
│   ├── utils/
│   │   ├── logger.py
│   │   ├── file_manager.py
│   │   └── memory.py
│   └── config.json
│
└── requirements.txt
```

---

## 🗣️ Example Debate JSON

Example file: `data/debates/christ_vegan_debate.json`

```json
{
  "title": "Was Christ a vegan?",
  "description": "A theological debate on whether Jesus' ethics align with vegan principles.",
  "agents": [
    {
      "id": "a1",
      "name": "Christian Vegan",
      "role": "defender",
      "goal": "Argue that Christ embodied vegan ethics through compassion for all beings.",
      "prompt": "You are a Christian vegan..."
    },
    {
      "id": "a2",
      "name": "Traditional Christian",
      "role": "opponent",
      "goal": "Argue that Christ was not vegan, referencing historical and cultural context.",
      "prompt": "You are a traditional Christian..."
    }
  ],
  "rules": {
    "turns": 5,
    "moderator": true,
    "moderator_prompt": "You are a neutral moderator who summarizes the debate at the end."
  },
  "metadata": {
    "created_by": "Thiago Martins",
    "date_created": "2025-10-05"
  }
}
```

---

## ⚙️ How It Works

1. **User creates debate via CLI or Web Interface**  
   → Defines topic, number of agents, and debate length.  
2. **Builder Layer** parses and validates the JSON.  
3. **Engine Layer** executes debate turns and moderates conversation.  
4. **Results** are saved as `.txt` and `.json` transcripts in `/data/debates/results/`.

---

## 💬 CLI Example

```
$ python src/ui/cli_interface.py

> Welcome to LogosArena ⚖️
> Create a new debate? [y/n] y
> Debate title: Was Christ a vegan?
> Number of agents: 2
> Agent 1 name: Christian Vegan
> Agent 1 role: defender
> Agent 2 name: Traditional Christian
> Agent 2 role: opponent
> Number of turns: 5
> Add neutral moderator? [y/n] y

[✅] Debate saved to /data/debates/christ_vegan_debate.json
[🚀] Start the debate now? [y/n] y
```

---

## 🌐 Internationalization (i18n)

LogosArena supports multiple languages.  
Default: **English (en-US)**  
Secondary: **Portuguese (pt-BR)**  

Language resources are stored under `/src/i18n/`:
```
i18n/
├── en.json
└── pt.json
```

Each file defines UI labels, system messages, and prompt templates.

---

## 🧠 Future Enhancements (beyond MVP)

### 🧩 **1. Agent Study Mode**
Agents will have the ability to **research topics autonomously** before debating:  
- Querying the web (via APIs or integrated search modules).  
- Building a **temporary knowledge base** of articles, citations, and facts.  
- Using that information to enrich arguments with sourced evidence.  
- Optional “study timer” to simulate preparation time before the debate.  

Example:
```
> Preparing debate...
> Agents studying topic for 5 minutes...
> Research sources collected: 43
> Debate begins.
```

---

### 🧠 **2. Persistent Agent Memory**
Agents can retain historical reasoning patterns and previously learned facts for future debates.

### 🗃️ **3. Debate Analytics Dashboard**
A web interface (Streamlite) showing:
- Argument flow visualization
- Logical consistency score
- Sentiment and rhetoric metrics

### 🤝 **4. Collaborative Debates**
Multiple users can co-create agents and watch debates in real time.

### 🧭 **5. LangChain Integration**
Each debate step (study, reasoning, moderation) can be delegated to specialized sub-agents.

---

## 🧩 Credits

Developed by **Thiago Martins**  
Vision: To enable machines to reason, challenge, and evolve through meaningful debate.

---

## 🕊️ Motto

> “In dialogue, truth unfolds.”  
> — LogosArena
