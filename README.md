# LeadFlow

## Automated Real-Time Sales Lead Distribution Platform

LeadFlow is a production-grade lead routing engine that ingests inbound sales leads, deduplicates contacts, assigns them to agents via a stateful Weighted Round Robin algorithm, enforces SLA deadlines with automatic cooldown penalties, and serves operational metrics through a modern Next.js dashboard.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [System Workflow](#system-workflow)
- [Lead Lifecycle](#lead-lifecycle)
- [SLA Enforcement Flow](#sla-enforcement-flow)
- [User Journey — Step by Step](#user-journey--step-by-step)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Automated Scenario Validation](#automated-scenario-validation)
- [Project Structure](#project-structure)
- [Production Stack (Optional)](#production-stack-optional)

---

## Architecture Overview

```mermaid
graph TD
    subgraph External["External Sources"]
        FE["Next.js Client (:3000)"]
        API_EXT["API Ingest (Webhooks/CRM)"]
    end

    subgraph Backend["FastAPI Backend Core (:8000)"]
        GW["REST API Gateway"]
        DD["Deduplication Service"]
        WRR["Weighted Round Robin Router"]
        SLA["SLA Monitor Worker"]
    end

    subgraph Storage["Data Layer"]
        PG["PostgreSQL / SQLite DB"]
        RD["Redis / In-Memory Cache"]
    end

    FE -->|HTTP Requests| GW
    API_EXT -->|Ingest Payload| GW
    GW --> DD
    DD -->|"New Lead"| WRR
    WRR --> PG
    WRR --> RD
    SLA -->|"Scan breaches"| PG

    style External fill:#0f172a,stroke:#3b82f6,color:#fff
    style Backend fill:#1e293b,stroke:#4f46e5,color:#fff
    style Storage fill:#312e81,stroke:#6366f1,color:#fff
```

---

## System Workflow

This is the end-to-end flow from when a lead enters the system to when it reaches a terminal state.

```mermaid
flowchart TD
    Start["📥 Lead Ingested"] --> DupCheck{"🔍 Duplicate Check"}
    
    DupCheck -->|"Match Found"| RouteOwner["🔁 Route directly to original owner (if active)"]
    DupCheck -->|"No Match / Inactive Owner"| WRR["⚖️ Route via Weighted Round Robin"]

    RouteOwner --> Assign["📝 Status: ASSIGNED\n(SLA Clock Starts)"]
    WRR --> Assign

    Assign --> SLA{"⏱️ SLA Responded?"}
    
    SLA -->|"Yes (Status: CONTACTED)"| Complete["💼 Move through sales pipeline\n(CLOSED_WON / CLOSED_LOST)"]
    SLA -->|"No (SLA Expired)"| Reassign{"🔄 Reassignments < 3?"}
    
    Reassign -->|"Yes"| Cooldown["⚠️ Penalize Agent (is_active = false)\nReassign to next agent (WRR)"]
    Cooldown --> Assign
    
    Reassign -->|"No"| Escalate["🚨 ESCALATED\n(Manual Manager Queue)"]
```

---

## Lead Lifecycle

Every lead transitions through a defined set of states. The diagram below shows every valid transition.

```mermaid
stateDiagram-v2
    [*] --> UNASSIGNED : No eligible agents
    [*] --> ASSIGNED : Agent found via WRR or duplicate owner

    UNASSIGNED --> ASSIGNED : Agent becomes available

    ASSIGNED --> CONTACTED : Agent makes first contact
    ASSIGNED --> ASSIGNED : SLA breach → reassigned (count < 3)
    ASSIGNED --> ESCALATED : SLA breach → count ≥ 3

    CONTACTED --> IN_PROGRESS : Negotiation started
    CONTACTED --> CLOSED_LOST : Lead rejected

    IN_PROGRESS --> CLOSED_WON : Deal closed
    IN_PROGRESS --> CLOSED_LOST : Deal lost

    CLOSED_WON --> [*]
    CLOSED_LOST --> [*]
    ESCALATED --> [*]
```

---

## SLA Enforcement Flow

A background worker runs every **10 seconds** scanning for assigned leads past their SLA deadline.

```mermaid
flowchart TD
    A["⏰ SLA Worker Tick (10s)"] --> B["Identify Expired Leads"]
    B --> C["Disable Breaching Agent (is_active = false)"]
    C --> D{"Reassignments < 3?"}
    D -->|"Yes"| E["Route to Next Agent (WRR)\nReset SLA Timer\nLog REASSIGN"]
    D -->|"No"| F["Mark ESCALATED\nUnassign Lead\nLog ESCALATE"]

    style A fill:#0f172a,stroke:#3b82f6,color:#fff
    style C fill:#1e293b,stroke:#4f46e5,color:#fff
    style E fill:#14532d,stroke:#22c55e,color:#fff
    style F fill:#7f1d1d,stroke:#ef4444,color:#fff
```

### SLA Deadlines by Priority

| Priority | Response Deadline |
| -------- | ----------------- |
| **HIGH** | 15 minutes |
| **MEDIUM** | 60 minutes |
| **LOW** | 24 hours |

---

## User Journey — Step by Step

This is how a user interacts with LeadFlow from initial setup through daily operations.

```mermaid
flowchart TD
    Setup["⚙️ Step 1: System Setup\n(Clone repo, install deps, run seed script)"]
    Dashboard["📊 Step 2: Dashboard Overview\n(Monitor real-time metrics, loads & live audit logs)"]
    Leads["📁 Step 3: Lead Management\n(Search, filter, and view detailed lead timelines)"]
    Agents["👥 Step 4: Team Operations\n(Adjust shift hours, routing weights & availability)"]
    Enforce["🤖 Step 5: SLA & Automation\n(Automated background routing, penalties & escalations)"]

    Setup --> Dashboard --> Leads --> Agents --> Enforce

    style Setup fill:#0f172a,stroke:#3b82f6,color:#fff
    style Dashboard fill:#1e293b,stroke:#4f46e5,color:#fff
    style Leads fill:#312e81,stroke:#6366f1,color:#fff
    style Agents fill:#1e1b4b,stroke:#818cf8,color:#fff
    style Enforce fill:#581c87,stroke:#c084fc,color:#fff
```

---

## Quick Start

> **Zero-config mode**: No PostgreSQL or Redis required. The backend auto-detects and falls back to SQLite and in-memory cache.

### Prerequisites

| Requirement | Minimum Version |
| ----------- | --------------- |
| Python | 3.11+ |
| Node.js | 18+ |
| Git | 2.x |

### 1. Clone & Install

```bash
git clone https://github.com/vanrajsinh650/LeadFlow.git
cd LeadFlow

# Backend
pip install -r backend/requirements.txt

# Frontend
cd frontend && npm install && cd ..
```

### 2. Seed the Database

```bash
python scripts/seed_db.py
```

This populates the database with **10 realistic sales agents** and **100 sample leads** with randomized priorities, statuses, and sources.

### 3. Start the Backend

```bash
python -m uvicorn backend.app.main:app --port 8000 --reload
```

The API starts at `http://localhost:8000`. The SLA background worker begins monitoring automatically.

### 4. Start the Frontend

```bash
cd frontend
npm run dev
```

Open `http://localhost:3000` in your browser.

### 5. Explore the Pages

| Page | URL | Purpose |
| ---- | --- | ------- |
| **Dashboard** | `/dashboard` | KPI cards, agent capacity bars, live activity feed |
| **Leads** | `/leads` | Searchable, filterable, sortable lead table |
| **Lead Detail** | `/lead/[id]` | Full timeline, status updates, manual reassignment |
| **Agents** | `/agents` | Agent directory, toggle availability, adjust weights |

---

## API Reference

### Leads

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| `GET` | `/api/v1/leads` | List leads with search, filter, sort, pagination |
| `POST` | `/api/v1/leads` | Ingest a new lead (triggers dedup + WRR routing) |
| `GET` | `/api/v1/leads/{id}` | Get lead detail with audit log timeline |
| `PATCH` | `/api/v1/leads/{id}/status` | Update lead status (stops SLA clock on contact) |
| `POST` | `/api/v1/leads/{id}/reassign` | Manual reassignment with capacity validation |

### Agents

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| `GET` | `/api/v1/agents` | List all agents with current load counts |
| `PATCH` | `/api/v1/agents/{id}/routing-config` | Update weight, availability, shift, capacity |

### Dashboard

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| `GET` | `/api/v1/dashboard/stats` | Aggregate KPIs, agent loads, and activity feed |

### Interactive Docs

Once the backend is running, visit:

- **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## Automated Scenario Validation

Run all 4 business-rule scenarios end-to-end:

```bash
python scripts/run_scenarios.py
```

```mermaid
flowchart TD
    T1["Scenario 1: Weighted Round Robin Routing"] --> T2["Scenario 2: Duplicate Route-to-Owner Bypass"]
    T2 --> T3["Scenario 3: SLA Breach & Agent Cooldown"]
    T3 --> T4["Scenario 4: Hard Escalation Limit (3 Reassignments)"]

    style T1 fill:#14532d,stroke:#22c55e,color:#fff
    style T2 fill:#1e3a8a,stroke:#3b82f6,color:#fff
    style T3 fill:#7c2d12,stroke:#ea580c,color:#fff
    style T4 fill:#7f1d1d,stroke:#ef4444,color:#fff
```

| # | Scenario | What It Validates |
| - | -------- | ----------------- |
| 1 | **Weighted Round Robin Routing** | New lead → assigned to agent → SLA computed → INGEST audit logged |
| 2 | **Route to Owner Bypass** | Duplicate lead → bypasses WRR → routes to original owner agent |
| 3 | **SLA Breach & Cooldown** | SLA forced to past → worker detects → agent penalized → lead reassigned |
| 4 | **Hard Escalation Limit** | 3 reassignments exceeded → lead status = ESCALATED → agent unassigned |

---

## Project Structure

```text
LeadFlow/
├── backend/
│   ├── app/
│   │   ├── api/v1/           # REST endpoints (leads, agents, dashboard)
│   │   ├── core/             # Configuration and settings
│   │   ├── db/               # Database session, engine, fallback logic
│   │   ├── models/           # SQLAlchemy ORM models (Lead, Agent, User, Audit)
│   │   ├── schemas/          # Pydantic request/response schemas
│   │   ├── services/         # Business logic layer
│   │   │   ├── assignment_service.py    # Agent eligibility + WRR orchestration
│   │   │   ├── deduplication.py         # Email/phone duplicate detection
│   │   │   ├── sla.py                   # SLA breach monitor + cooldown engine
│   │   │   └── weighted_round_robin.py  # Stateful WRR algorithm
│   │   └── main.py           # FastAPI app + lifespan + SLA worker
│   └── requirements.txt
├── frontend/
│   ├── src/app/
│   │   ├── dashboard/        # KPI cards, agent bars, activity feed
│   │   ├── leads/            # Lead list with search/filter/sort
│   │   ├── lead/[id]/        # Lead detail with audit timeline
│   │   ├── agents/           # Agent directory with config controls
│   │   └── layout.tsx        # App shell with sidebar navigation
│   └── package.json
├── context/                  # Architecture decision records (12 files)
├── scripts/
│   ├── seed_db.py            # Database seeder (10 agents + 100 leads)
│   └── run_scenarios.py      # Automated integration test scenarios
├── docker/                   # Docker Compose for production stack
└── docs/                     # Documentation and demo assets
```

---

## Production Stack (Optional)

For full **PostgreSQL + Redis** deployment:

```bash
# Start infrastructure
docker-compose -f docker/docker-compose.yml up -d

# Seed PostgreSQL
python scripts/seed_db.py

# Start API (auto-detects containers)
python -m uvicorn backend.app.main:app --port 8000 --reload
```

The backend automatically detects available PostgreSQL and Redis containers and connects to them instead of the local fallbacks.

---

## Tech Stack

| Layer | Technology | Purpose |
| ----- | ---------- | ------- |
| **Backend** | FastAPI (Python 3.11+) | REST API, async I/O, background tasks |
| **Frontend** | Next.js 15 (React 19) | Dashboard, SSR, App Router |
| **Primary DB** | PostgreSQL / SQLite fallback | Relational data, audit logs |
| **Cache** | Redis / In-memory fallback | WRR routing state persistence |
| **ORM** | SQLAlchemy 2.0 (async) | Database abstraction layer |
| **Validation** | Pydantic v2 | Request/response schema enforcement |

---

## License

This project was built as a technical assessment submission.
