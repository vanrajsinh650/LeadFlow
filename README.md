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
graph TB
    subgraph External["External Sources"]
        WEB["Web Forms"]
        CRM["CRM Integrations"]
        API_EXT["Partner APIs"]
    end

    subgraph Backend["FastAPI Backend :8000"]
        GW["REST API Gateway"]
        DD["Deduplication Service"]
        WRR["Weighted Round Robin Engine"]
        SLA["SLA Monitor Worker"]
        AUDIT["Audit Logger"]
    end

    subgraph Storage["Data Layer"]
        PG["PostgreSQL / SQLite"]
        RD["Redis / In-Memory Cache"]
    end

    subgraph Frontend["Next.js Frontend :3000"]
        DASH["Dashboard Page"]
        LEADS["Leads Management"]
        AGENTS["Agents Directory"]
        DETAIL["Lead Detail + Timeline"]
    end

    WEB --> GW
    CRM --> GW
    API_EXT --> GW
    GW --> DD
    DD -->|"New Lead"| WRR
    DD -->|"Duplicate"| AUDIT
    WRR --> PG
    WRR --> RD
    SLA -->|"Every 10s"| PG
    AUDIT --> PG
    Frontend -->|"HTTP Fetch"| GW

    style External fill:#1a1a2e,stroke:#e94560,color:#fff
    style Backend fill:#16213e,stroke:#0f3460,color:#fff
    style Storage fill:#0f3460,stroke:#533483,color:#fff
    style Frontend fill:#533483,stroke:#e94560,color:#fff
```

---

## System Workflow

This is the end-to-end flow from when a lead enters the system to when it reaches a terminal state.

```mermaid
flowchart TD
    A["📥 Lead Arrives via POST /api/v1/leads"] --> B{"🔍 Duplicate Check"}

    B -->|"Email or Phone matches existing lead"| C["🔁 Route to Original Owner"]
    B -->|"New unique contact"| D["⚖️ Weighted Round Robin Selection"]

    C --> E["📝 Status: ASSIGNED"]
    D --> F{"Any Eligible Agents?"}

    F -->|"Yes"| G["Filter by: Active + In-Shift + Under Capacity"]
    F -->|"No"| H["📝 Status: UNASSIGNED"]

    G --> I["Select Agent by WRR Weight Credits"]
    I --> E

    E --> J["⏱️ SLA Timer Started"]
    J --> K{"Agent Responds Before Deadline?"}

    K -->|"Yes"| L["📝 Status: CONTACTED → IN_PROGRESS"]
    L --> M{"Deal Outcome"}
    M -->|"Won"| N["✅ CLOSED_WON"]
    M -->|"Lost"| O["❌ CLOSED_LOST"]

    K -->|"No — SLA Breached"| P["⚠️ Cooldown Penalty Applied"]
    P --> Q{"Reassignment Count < 3?"}

    Q -->|"Yes"| R["🔄 Reassign via WRR"]
    R --> E
    Q -->|"No"| S["🚨 ESCALATED to Manager"]

    style A fill:#0d1b2a,stroke:#1b263b,color:#e0e1dd
    style E fill:#1b4332,stroke:#2d6a4f,color:#fff
    style H fill:#6c757d,stroke:#495057,color:#fff
    style N fill:#2d6a4f,stroke:#40916c,color:#fff
    style O fill:#6c757d,stroke:#495057,color:#fff
    style S fill:#9d0208,stroke:#d00000,color:#fff
    style P fill:#e36414,stroke:#f77f00,color:#fff
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
flowchart LR
    A["⏰ SLA Worker Tick (10s)"] --> B["Query: ASSIGNED leads where sla_expires_at ≤ NOW"]
    B --> C{"Breached Leads Found?"}
    C -->|"No"| D["Sleep 10s"]
    C -->|"Yes"| E["For each breached lead:"]
    E --> F["1. Flag sla_violated = true"]
    F --> G["2. Penalize agent → is_active = false"]
    G --> H{"reassignment_count < 3?"}
    H -->|"Yes"| I["3a. Reassign via WRR\n+ increment count\n+ new SLA timer"]
    H -->|"No"| J["3b. Escalate lead\n+ unassign agent\n+ clear SLA"]
    I --> K["Write REASSIGN audit log"]
    J --> L["Write ESCALATE audit log"]
    K --> D
    L --> D

    style A fill:#1a1a2e,stroke:#e94560,color:#fff
    style G fill:#e36414,stroke:#f77f00,color:#fff
    style J fill:#9d0208,stroke:#d00000,color:#fff
    style I fill:#1b4332,stroke:#2d6a4f,color:#fff
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
    subgraph Step1["Step 1 — Setup"]
        S1A["Clone repo & install deps"]
        S1B["Run seed script\n→ 10 agents + 100 leads"]
        S1C["Start backend :8000\nStart frontend :3000"]
        S1A --> S1B --> S1C
    end

    subgraph Step2["Step 2 — Dashboard Overview"]
        S2A["Open /dashboard"]
        S2B["View KPI cards:\nTotal Leads · Active Agents\nSLA Violations · Conversion Rate"]
        S2C["Monitor Agent Load bars"]
        S2D["Watch Live Activity Feed"]
        S2A --> S2B --> S2C --> S2D
    end

    subgraph Step3["Step 3 — Lead Management"]
        S3A["Navigate to /leads"]
        S3B["Search by name, email, phone"]
        S3C["Filter by Priority or Status"]
        S3D["Sort by created date or priority"]
        S3E["Click a lead → /lead/[id]"]
        S3A --> S3B --> S3C --> S3D --> S3E
    end

    subgraph Step4["Step 4 — Lead Detail & Actions"]
        S4A["View lead info + SLA countdown"]
        S4B["Read full audit timeline"]
        S4C["Update status:\nCONTACTED → IN_PROGRESS"]
        S4D["Manual reassign to another agent"]
        S4A --> S4B --> S4C --> S4D
    end

    subgraph Step5["Step 5 — Agent Management"]
        S5A["Navigate to /agents"]
        S5B["View each agent's active load"]
        S5C["Toggle agent active/inactive"]
        S5D["Adjust WRR weight (0–10)"]
        S5E["Set shift hours & timezone"]
        S5A --> S5B --> S5C --> S5D --> S5E
    end

    subgraph Step6["Step 6 — Automated Enforcement"]
        S6A["SLA Worker runs in background"]
        S6B["Breached leads auto-reassigned"]
        S6C["Negligent agents auto-penalized"]
        S6D["3x breach → lead escalated"]
        S6A --> S6B --> S6C --> S6D
    end

    Step1 --> Step2 --> Step3 --> Step4 --> Step5 --> Step6

    style Step1 fill:#0d1b2a,stroke:#1b263b,color:#e0e1dd
    style Step2 fill:#1b263b,stroke:#415a77,color:#e0e1dd
    style Step3 fill:#415a77,stroke:#778da9,color:#e0e1dd
    style Step4 fill:#16213e,stroke:#0f3460,color:#e0e1dd
    style Step5 fill:#0f3460,stroke:#533483,color:#e0e1dd
    style Step6 fill:#533483,stroke:#e94560,color:#e0e1dd
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
flowchart LR
    T1["Scenario 1\nWRR Routing"] --> T2["Scenario 2\nDuplicate Bypass"]
    T2 --> T3["Scenario 3\nSLA Breach + Cooldown"]
    T3 --> T4["Scenario 4\nHard Escalation"]

    style T1 fill:#1b4332,stroke:#2d6a4f,color:#fff
    style T2 fill:#0f3460,stroke:#533483,color:#fff
    style T3 fill:#e36414,stroke:#f77f00,color:#fff
    style T4 fill:#9d0208,stroke:#d00000,color:#fff
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
