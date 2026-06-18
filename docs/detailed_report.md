# LeadFlow - Detailed Project Implementation Report

LeadFlow is an enterprise-grade sales lead routing and management platform. This report provides an exhaustive, granular breakdown of the architectural decisions, database models, core routing algorithms, API specifications, client views, verification scenarios, and local setups that compose the system.

---

## 📂 1. Directory Structure & File Inventory

The workspace is organized into discrete boundaries separating specification, backend API, client frontend, infrastructure configurations, and validation scripts:

```text
leadflow/
│
├── context/                             # Single Source of Truth Specifications
│   ├── AGENTS.md                        # Master reading order & guidelines
│   ├── 01-product.md                    # Product vision & success metrics
│   ├── 02-business-rules.md             # Algorithmic constraints & SLA thresholds
│   ├── 03-architecture.md               # System boundaries & component diagrams
│   ├── 04-database.md                   # Relational schema, indexes & constraints
│   ├── 05-api-contracts.md              # REST JSON HTTP specs & endpoints
│   ├── 06-workflows.md                  # Mermaid flowcharts of lifecycle steps
│   ├── 07-frontend-system.md            # Styling guidelines & UI tokens
│   ├── 08-engineering-rules.md          # Code conventions & Git rules
│   ├── 09-security-and-operations.md    # Security policies (simplifications for MVP)
│   ├── 10-decisions.md                  # Design choices rationale
│   └── 11-demo-scenarios.md             # Functional verification scenarios
│
├── backend/                             # FastAPI Async Backend Application
│   ├── app/
│   │   ├── api/                         # Endpoint Routers
│   │   │   ├── deps.py                  # HTTP dependency providers (DB)
│   │   │   └── v1/
│   │   │       ├── agents.py            # Agent configuration endpoints
│   │   │       ├── dashboard.py         # Metrics & aggregate charts endpoints
│   │   │       └── leads.py             # Lead ingestion & status endpoints
│   │   ├── db/                          # Database connection layers
│   │   │   ├── base.py                  # SQLAlchemy declarative base
│   │   │   └── session.py               # Postgres/SQLite fallback connection
│   │   ├── models/                      # SQLAlchemy Model Subclasses
│   │   │   ├── agent.py                 # Agent configuration constraints model
│   │   │   ├── audit.py                 # LeadAuditLog table model
│   │   │   ├── lead.py                  # Lead table, checks, & indexes model
│   │   │   └── user.py                  # Users table & authentication model
│   │   ├── schemas/                     # Pydantic validation contracts
│   │   │   └── lead.py                  # Lead schema with alias transformations
│   │   ├── services/                    # Domain Business Logic
│   │   │   ├── assignment_service.py    # Stateful router orchestrator
│   │   │   ├── deduplication.py         # Duplicates lookup & bypass service
│   │   │   ├── routing.py               # Abstract route interface
│   │   │   ├── sla.py                   # Async SLA monitors & penalties
│   │   │   └── weighted_round_robin.py  # Stateful round-robin engine
│   │   └── main.py                      # FastAPI entrypoint & SLA background loop
│   ├── tests/                           # Backend Test Suite
│   │   ├── conftest.py                  # Pytest async fixture setups
│   │   └── unit/
│   │       └── test_models.py           # Database constraints tests
│   ├── requirements.txt                 # Alternative package dependencies list
│   └── pyproject.toml                   # Poetry project configuration
│
├── frontend/                            # Next.js 15 Client Web Application
│   ├── src/app/                         # App Router Directories
│   │   ├── agents/
│   │   │   └── page.tsx                 # Agent configurations & weight slider
│   │   ├── dashboard/
│   │   │   └── page.tsx                 # Aggregate charts & real-time log feed
│   │   ├── leads/
│   │   │   └── page.tsx                 # Leads table grid with search & filters
│   │   ├── lead/[id]/
│   │   │   └── page.tsx                 # Timeline log feed & manual reassignments
│   │   ├── layout.tsx                   # Master structural wrapper & global navigation
│   │   ├── page.tsx                     # Landing homepage portal
│   │   └── globals.css                  # Core CSS variables & Tailwind directives
│   ├── package.json                     # Frontend scripts & dependencies
│   └── tsconfig.json                    # TypeScript compiler parameters
│
├── docker/                              # Infrastructure Configurations
│   └── docker-compose.yml               # Container specs for PostgreSQL & Redis
│
├── scripts/                             # Operational & Validation Scripts
│   ├── seed_db.py                       # Realistic DB populating script (100 leads)
│   └── run_scenarios.py                 # E2E integration verification script
│
├── walkthrough.md                       # Workspace copy of walkthrough summary
└── README.md                            # Quick-start documentation & pitch
```

---

## 🛢️ 2. Database Design & Graceful Fallbacks

### Relational Schema Definitions (`backend/app/models/`)

1. **`User` (`models/user.py`):**
   - Stores identity profiles and system authorization tiers.
   - Primary Key: UUID (defaults to `uuid.uuid4`).
   - Fields: `email` (unique index, VARCHAR(255)), `hashed_password` (VARCHAR(255)), `full_name` (VARCHAR(255)), `role` (VARCHAR(50): `ADMIN`, `MANAGER`, `AGENT`).
   - Timestamps: `created_at`, `updated_at`.

2. **`Agent` (`models/agent.py`):**
   - Extends the `users` table via a Foreign Key relationship.
   - Foreign Key: `id` (references `users.id` ON DELETE CASCADE).
   - Fields: `is_active` (boolean availability), `weight` (integer routing quote, CHECK constraint `weight >= 0 AND weight <= 10`), `timezone` (VARCHAR(100) local timezone reference), `shift_start`/`shift_end` (TIME objects for routing verification), `max_concurrent_leads` (integer load limit, CHECK constraint `max_concurrent_leads > 0`).

3. **`Lead` (`models/lead.py`):**
   - The primary operational object containing profile, status, routing metadata, and SLA timers.
   - Fields: `first_name`, `last_name`, `email`, `phone`, `source`, `priority` (`HIGH`, `MEDIUM`, `LOW`), `status` (`UNASSIGNED`, `ASSIGNED`, `CONTACTED`, `IN_PROGRESS`, `CLOSED_WON`, `CLOSED_LOST`, `ESCALATED`).
   - Relations: `assigned_agent_id` (Foreign Key -> `agents.id`), `original_lead_id` (Self-referential Foreign Key -> `leads.id`).
   - Check Constraints:
     - `chk_lead_reassignment_bound`: `reassignment_count >= 0 AND reassignment_count <= 3` (stops updates past 3 reassignments to prevent infinite loops).
     - `chk_lead_duplicate_safety`: `original_lead_id IS NULL OR is_duplicate = TRUE` (database-level integrity constraint guaranteeing duplicate leads possess a reference pointer to their original match).
   - Core Indexes:
     - `idx_leads_email_phone`: B-Tree on `(email, phone)` for quick duplicate checks.
     - `idx_leads_status_assigned_agent`: B-Tree on `(status, assigned_agent_id)` for counting agent load.
     - `idx_leads_sla_expired`: B-Tree on `(sla_expires_at)` for background SLA breach workers.

4. **`LeadAuditLog` (`models/audit.py`):**
   - An immutable historical ledger tracking all transitions of a lead.
   - Fields: `lead_id` (FK -> `leads.id`), `action` (`INGEST`, `ASSIGN`, `REASSIGN`, `SLA_BREACH`, `STATUS_CHANGE`, `ESCALATE`), `old_status`, `new_status`, `old_agent_id`, `new_agent_id`, `notes` (TEXT).

---

### Graceful Session Connection Fallback (`backend/app/db/session.py`)

To ensure onboarding runs under 5 minutes on a local machine, a network socket detection routine is executed at startup:

```python
def check_postgres_reachable(url: str) -> bool:
    try:
        clean_url = url.split("://", 1)[1] if "://" in url else url
        parsed = urlparse(f"http://{clean_url}")
        host = parsed.hostname or "localhost"
        port = parsed.port or 5432
        with socket.create_connection((host, port), timeout=0.8):
            return True
    except Exception:
        return False
```

- **If PostgreSQL is Reachable:** Creates an async engine pointing to the host using PostgreSQL socket pools (`pool_size=20, max_overflow=10`).
- **If PostgreSQL is Offline:** Instantiates a local SQLite connection (`sqlite+aiosqlite:///backend/leadflow.db`) and registers a SQLAlchemy listener to force Foreign Key checks in SQLite:
  ```python
  @event.listens_for(engine.sync_engine, "connect")
  def set_sqlite_pragma(dbapi_connection, connection_record):
      cursor = dbapi_connection.cursor()
      cursor.execute("PRAGMA foreign_keys=ON")
      cursor.close()
  ```

---

## ⚙️ 3. Core Algorithms & Business Rules

### 1. Stateful Weighted Round Robin (WRR)
Implemented in `backend/app/services/weighted_round_robin.py` and `backend/app/services/assignment_service.py`.

* **The Logic:** Active agents have a `weight` (0 to 10). Pointers are maintained using standard Interleaved WRR. Pointers consist of:
  1. `wrr:index`: Index of the last assigned agent in the sorted list.
  2. `wrr:credit`: The weight credit remaining for the current agent.
* **Selection Procedure:**
  1. Filters active agents currently inside their shift hours (converted from UTC to their agent timezone) whose active concurrent lead load is below their configured capacity limit.
  2. If the current agent has credit left (`current_weight_credit > 0`), we decrement their credit by 1 and select them.
  3. If credit is exhausted, we move to the next eligible agent, reset the credit pointer to their `weight - 1`, and select them.
* **Graceful Cache Fallback:** Pointers are saved in Redis (`wrr:index`, `wrr:credit`). If Redis is unreachable, it automatically swaps to `InMemoryRedisMock` (a dictionary wrapper class), ensuring stateful round robin persists locally.

---

### 2. Contact Deduplication & Route-to-Owner Bypass
Implemented in `backend/app/services/deduplication.py`.

* **Scanning Rules:** On lead ingestion, the system queries for existing leads matching `email` OR `phone`.
* **Routing Bypass:** If a match is found, and the original lead has an assigned agent who is **currently active and online**:
  - The inbound lead is marked `is_duplicate = True`.
  - The `original_lead_id` is assigned the ID of the matched lead.
  - The lead bypasses the Weighted Round Robin selector and is routed directly to the same agent (`assigned_agent_id` is set to the original owner).
  - This ensures relationship continuity for repeat contacts.

---

### 3. Background SLA Monitor & Cooldown Penalties
Implemented in `backend/app/services/sla.py` and `backend/app/main.py`.

* **Background Task:** In `main.py`, an async loop runs a background task every 10 seconds:
  ```python
  async def sla_breach_monitor_loop():
      while True:
          await asyncio.sleep(10)
          async with SessionLocal() as db:
              await SLAService.check_and_process_sla_breaches(db)
  ```
* **Breach Calculations:**
  - Standard SLA times are based on priority: `HIGH` = 15 minutes, `MEDIUM` = 60 minutes, `LOW` = 24 hours.
  - Active leads in `ASSIGNED` state whose `sla_expires_at` is less than or equal to `now()` are flagged as breached.
* **Penalty Enforcement:**
  1. The breaching agent's status is toggled (`is_active = False`), putting them on cooldown to prevent them from receiving new leads.
  2. The lead's reassignment counter is checked:
     - **If `reassignment_count < 3`:** The lead is unassigned (`assigned_agent_id = NULL`), and the Weighted Round Robin engine assigns the lead to the next eligible agent. The reassignment count is incremented by 1, the SLA clock is reset, and a `REASSIGN` audit log is created.
     - **If `reassignment_count >= 3`:** The lead status transitions to `ESCALATED`, its assigned agent is set to `None`, and a critical manager alert audit log (`ESCALATE`) is recorded.

---

## 🔌 4. API Specification & Schema Mapping

### Pydantic Contract Aliases (`backend/app/schemas/lead.py`)
To align with the contract specifications in `context/05-api-contracts.md` (which requests names like `lead_id` and `agent_id`) while preserving idiomatic database column naming (`id`), we use Pydantic aliases:

```python
class LeadResponse(BaseModel):
    id: uuid.UUID = Field(..., serialization_alias="lead_id")
    first_name: str
    last_name: str
    email: str
    phone: str
    source: str
    priority: str
    status: str
    assigned_agent_id: Optional[uuid.UUID] = Field(None, serialization_alias="assigned_agent_id")
    sla_expires_at: Optional[datetime] = None
    sla_violated: bool
    is_duplicate: bool
    original_lead_id: Optional[uuid.UUID] = None
    reassignment_count: int
    created_at: datetime
```

---

### Key Endpoint Routings (`backend/app/api/v1/`)

1. **`leads.py`:**
   - `POST /api/v1/leads`: Ingests leads. Handles duplicate checks, WRR assignments, SLA calculations, and database sessions. Returns `201 Created` with the schema mapped fields.
   - `GET /api/v1/leads`: Returns a paginated search table of leads. Supports text queries (first name, last name, email) and filtering by status.
   - `GET /api/v1/leads/{id}`: Returns lead detail profiles and their chronological audit log array.
   - `PATCH /api/v1/leads/{id}/status`: Updates lead state (e.g. `CONTACTED`). Terminating the status update automatically stops the active SLA timer.

2. **`agents.py`:**
   - `GET /api/v1/agents`: Returns a list of active and inactive agents, including their shifts, weight variables, and concurrency parameters.
   - `PATCH /api/v1/agents/{id}`: Modifies agent options (e.g., toggling `is_active` or modifying weights).

3. **`dashboard.py`:**
   - `GET /api/v1/dashboard/metrics`: Computes aggregate data including total leads, unassigned queues, active SLA violations count, conversion rates, and duplicate ratios.
   - `GET /api/v1/dashboard/capacity`: Calculates load bar stats showing how many active leads are currently assigned to each agent compared to their max concurrent limit.
   - `GET /api/v1/dashboard/activity`: Returns the 15 most recent audit log records.

---

## 🖥️ 5. Next.js Frontend Pages

The client application is built with Next.js 15, using TypeScript and custom styling structures matching the requirements in `context/07-frontend-system.md`:

1. **`/dashboard` (Dashboard Panel):**
   - Metric cards displaying key stats (active leads, conversion rates, SLA violations).
   - Dynamic load bars showing each agent's current concurrent lead capacity.
   - Live activity log feed showing audit events (e.g., assignments, reassignments, escalations).

2. **`/leads` (Leads Table):**
   - Search bar filtering by lead name or email.
   - Dropdown selectors to filter by status or priority.
   - Interactive paginated table list with navigation links to details.

3. **`/lead/[id]` (Details Page):**
   - Contact detail cards showing priorities, sources, and duplicate status.
   - Interactive re-assignment controls allowing managers to manually route the lead or update its pipeline status.
   - Vertical timeline visualization displaying all lead history actions (Ingestion, Assignment, Reassignments, Escalations).

4. **`/agents` (Team Directory):**
   - Profile grid displaying shift hours, timezone info, and active concurrency ratios.
   - Active switch toggles enabling immediately taking agents offline or placing them on active cooldown.
   - Interactive WRR weight sliders to dynamically adjust lead distribution weights.

---

## 🧪 6. Verification and Setup Scripts

### 1. Database Seeder (`scripts/seed_db.py`)
- Resets database tables (`drop_all` followed by `create_all`).
- Seeds **10 realistic user accounts** (8 agents, 1 manager, 1 administrator).
- Creates **100 realistic leads** with varying sources, priority values, and statuses.
- Auto-generates initial ingestion, round robin assignment, and escalation audit logs to match database conditions.
- Uses the backend connection fallback to work with both PostgreSQL and SQLite.

### 2. Scenario Runner (`scripts/run_scenarios.py`)
Launches the FastAPI application as a subprocess, seeds mock agents, and executes E2E scenario checks over HTTP and direct services:

- **Scenario 1 (Weighted Round Robin Routing):** Ingests a new unique lead, verifies it's assigned to an agent, checks computed SLA expiration, and confirms the `INGEST` audit log creation.
- **Scenario 2 (Route to Owner Bypass):** Ingests a duplicate lead payload and confirms it bypasses round-robin to assign directly to the original owner agent.
- **Scenario 3 (SLA Breach & Cooldown Penalty):** Set a lead's SLA to the past, runs the SLA monitor worker, verifies the breaching agent is penalized (`is_active = False`), and verifies the lead is reassigned.
- **Scenario 4 (Hard Escalation Limit):** Forces a lead past the 3-reassignment limit, triggers the SLA worker, and verifies the status transitions to `ESCALATED` with no assigned agent.

---

## 📝 7. Commit History Summary

All changes have been successfully committed and pushed to the remote `main` branch. Commits follow the strict plain-text prefix-free rule:

1. `Initialize frontend Next.js structure and adjust backend folders to root`
2. `Configure database session connection and declare SQLAlchemy models`
3. `Implement backend FastAPI APIs, services, and Next.js frontend pages`
4. `Remove circular model imports from declarative base file`
5. `Create automated scenario verification script`
6. `Update automated scenario verification script to use UUID objects in queries`
7. `Refactor SLA reassignment count bounds checking to align with database constraint`
8. `Fix database seeder path imports and align with automatic SQLite fallback`
9. `Add requirements.txt for backend dependency installation`
10. `Add docker compose configuration for PostgreSQL and Redis infrastructure`
11. `Update README with quick start guide and 60-second architecture summary`
