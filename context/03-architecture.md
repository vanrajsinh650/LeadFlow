# 03-architecture.md - System Architecture

This is the Single Source of Truth (SSOT) for LeadFlow's system architecture, component boundaries, and data flow.

## 1. Component Diagram

```mermaid
graph TD
    Client[Inbound Sources / Webhooks / UI] -->|HTTPS Requests| API[FastAPI Gateway]
    
    subgraph FastAPI Service
        API --> Auth[Auth & AuthZ Middleware]
        API --> Ingestion[Ingestion Controller]
        API --> Routing[Routing Engine]
        API --> Management[Agent/Lead management API]
    end

    subgraph Memory & State Layer
        Routing -->|Query/Update Round Robin Index| Redis[(Redis Cache & State Store)]
        Routing -->|Check Duplicate Windows| Redis
    end

    subgraph Storage Layer
        Ingestion -->|Persist Lead & Audit logs| Postgres[(PostgreSQL Database)]
        Routing -->|Read Agent weights / Update Assignments| Postgres
    end

    subgraph Background Processing
        Scheduler[SLA Monitor / Background Worker] -->|Periodically check SLA timeframes| Postgres
        Scheduler -->|Trigger SLA violation events| Redis
        Scheduler -->|Call Routing Engine to Reassign| Routing
    end
```

---

## 2. Component Boundaries
LeadFlow is built as a modular monolith with clearly defined logical boundaries.

### FastAPI Application Layer
- **Ingestion Controller:** Exposes endpoints for webhook registration and manual lead creation. Handles parsing, schema validation, and normalization of inputs via Pydantic response models.
- **Routing Engine:** The core algorithm container. Inspects incoming leads, applies duplicate checking, filters active/available agents, computes stateful Weighted Round Robin selections, and commits assignments.
- **Management API:** CRUD endpoints for administrators/managers to manage agents (availability, timezone, shift hours, weights) and fetch operational queues.

### Memory & State Layer (Redis / Memory State Fallback)
- **Weighted Round Robin state:** Keeps the active list of agents, the last distributed agent index, and running weight credits to make stateful routing decisions.
- **Local Memory State Fallback:** If a connection to Redis is not established, the engine automatically falls back to an in-process dictionary state wrapper (`InMemoryRedisMock`), preserving routing pointers in a zero-dependency environment.

### Persistence Layer (PostgreSQL / SQLite Connection Fallback)
- **Relational Storage:** Relational storage for users, agents, lead metadata, assignments, and audit trails.
- **SQLite Connection Fallback:** If PostgreSQL is unreachable, the application automatically mounts a local SQLite database file (`sqlite+aiosqlite`) with SQLite foreign key enforcement enabled (`PRAGMA foreign_keys=ON`). This provides complete operational capability on clean dev machines in under 5 minutes.
- **Indexes:** Optimized B-Tree indexes on `(email, phone)` for duplicate screening, `(status, assigned_agent_id)` for agent loading, and `(sla_expires_at)` for SLA checkers.

### Background Workers / Schedulers (Asyncio Task Loop)
- Runs a lightweight, non-blocking background `asyncio` task loop in the main FastAPI server process. It audits lead states for active SLA violations every 10 seconds, applying cooldown penalties and triggering reassignments.

---

## 3. Data Flow

### Scenario: Lead Ingestion & Assignment
```mermaid
sequenceDiagram
    autonumber
    actor Source as External Lead Source
    participant API as FastAPI Ingestion
    participant Redis as Redis Cache
    participant DB as PostgreSQL DB
    participant Engine as Routing Engine

    Source->>API: POST /api/v1/leads (payload)
    API->>Redis: Deduplicate Check (email/phone)
    alt Duplicate cached
        Redis-->>API: Return duplicate warning / assign to same agent
    else Unique or cache miss
        API->>DB: Perform deep historical duplicate check (30 days)
        DB-->>API: No duplicate found
    end

    API->>DB: Write Lead (Status: INGESTED)
    API->>Engine: Request Agent Assignment
    Engine->>Redis: Get eligible active agent lists & current WRR pointers
    Redis-->>Engine: Eligible agents list + weights
    Engine->>Engine: Run Weighted Round Robin Selection
    Engine->>DB: Update Lead (Status: ASSIGNED, Agent ID: X)
    Engine->>DB: Log Audit Trail (Assignment Event)
    Engine->>Redis: Update WRR index & set SLA breach countdown key
    API-->>Source: Return JSON (Lead ID, assigned Agent ID, status)
```

---

## 4. Deployment Architecture
LeadFlow is designed to be cloud-native and highly available:
- **Application Nodes:** Containerized FastAPI applications running inside Docker/Kubernetes, scaling horizontally based on request volume.
- **Relational Store:** Multi-Availability-Zone PostgreSQL deployment with automatic failover and read replicas for analytical queries.
- **Caching Layer:** Redis Cluster (Primary + Replica) to guarantee low-latency lock execution and state maintenance.
- **Health Monitoring:** Health checks exposed at `/health` for Kubernetes Liveness and Readiness probes.
