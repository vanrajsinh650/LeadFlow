# LeadFlow

LeadFlow is an automated, real-time sales lead distribution platform designed to streamline inbound lead pipelines. It routes leads to agents using a stateful Weighted Round Robin (WRR) algorithm, enforces SLAs with automatic cooldown penalties, prevents duplicate contacts, and serves operational metrics on a modern dashboard.

---

## ⚡ 60-Second Architecture Summary

> **LeadFlow** receives incoming leads through a FastAPI REST API. The system immediately screens for duplicate contacts, routes new leads using a stateful Weighted Round Robin assignment engine, and tracks SLA deadlines. A background SLA monitor task automatically identifies overdue leads, applies a cooldown penalty to inactive agents, reassigns the lead to the next eligible agent, and records every event in an immutable audit log. PostgreSQL serves as the primary relational store, and Redis persists active routing queues, with both layers supporting graceful local fallbacks.

```text
  Lead Source (HTTP POST /leads)
             ↓
       FastAPI Backend
      (Duplicate Scan)
             ↓
      Assignment Engine (Weighted Round Robin)
       ↙           ↘
  PostgreSQL        Redis Cache
 (Primary DB)      (Routing State)
       ↓
  Next.js 15 Client (Dashboard, Leads, Agents)
```

---

## 🚀 Quick Start (Under 5 Minutes)

You can run the entire application out-of-the-box using the automatic **SQLite & Local Cache fallbacks**. No local PostgreSQL or Redis servers are required.

### Prerequisites
- **Python 3.11+**
- **Node.js 18+**

---

### Step 1: Run the Backend API

1. Navigate to the `backend/` directory and install Python dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```
2. Seed the database with 10 realistic agents and 100 sample leads:
   ```bash
   python scripts/seed_db.py
   ```
3. Boot the FastAPI server:
   ```bash
   python -m uvicorn backend.app.main:app --port 8000 --reload
   ```
   *The backend will automatically start on `http://localhost:8000` and fall back to SQLite (`backend/leadflow.db`) and local memory cache.*

---

### Step 2: Run the Frontend App

1. Open a new terminal window, navigate to the `frontend/` directory, and install npm modules:
   ```bash
   cd frontend
   npm install
   ```
2. Launch the Next.js development server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000` in your browser to view:
   - **`/dashboard`**: Real-time aggregate sales queues, load capacities, and live activity log feed.
   - **`/leads`**: Dynamic lead lists with searchable names, sorting, and pagination.
   - **`/lead/[id]`**: Granular timeline tracking audit logs and manual reassignments.
   - **`/agents`**: Active sales team directory with toggles for availability and WRR weight parameters.

---

## 🧪 Automated Demo Scenarios Validation

We provide a complete automated integration script verifying all critical business operations end-to-end. The script seeds mock agents, spawns a local server instance, sends HTTP requests, and validates conditions:

To run all 4 scenarios automatically:
```bash
python scripts/run_scenarios.py
```

### What It Validates:
1. **Scenario 1 (Weighted Round Robin Routing):** Ingests a new unique lead, verifies it's assigned to an agent, checks computed SLA expiration, and confirms the `INGEST` audit log creation.
2. **Scenario 2 (Route to Owner Bypass):** Ingests a duplicate lead payload and confirms it bypasses round-robin to assign directly to the original owner agent.
3. **Scenario 3 (SLA Breach & Cooldown Penalty):** Set a lead's SLA to the past, runs the SLA monitor worker, verifies the breaching agent is penalized (`is_active = False`), and verifies the lead is reassigned.
4. **Scenario 4 (Hard Escalation Limit):** Forces a lead past the 3-reassignment limit, triggers the SLA worker, and verifies the status transitions to `ESCALATED` with no assigned agent.

---

## 🐳 Optional: Production Stack Setup

If you prefer to run with full **PostgreSQL** and **Redis** database layers:

1. Spin up the infrastructure containers:
   ```bash
   docker-compose -f docker/docker-compose.yml up -d
   ```
2. Re-run the database seeder to populate PostgreSQL:
   ```bash
   python scripts/seed_db.py
   ```
3. Launch the FastAPI server. It will automatically detect the containers and connect:
   ```bash
   python -m uvicorn backend.app.main:app --port 8000 --reload
   ```
