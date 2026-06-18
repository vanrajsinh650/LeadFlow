# 09-security-and-operations.md - Security & Operations

This is the Single Source of Truth (SSOT) for application security protocols, secret storage, logging observability, and deployment pipelines.

---

## 1. Authentication & Authorization (RBAC)
- **Token Format:** JSON Web Tokens (JWT) signed using the `HS256` algorithm.
- **Token Lifespans:**
  - Access Token: 15 minutes (non-configurable).
  - Refresh Token: 7 days.
- **Role-Based Access Control (RBAC) Levels:**
  - **`ADMIN`**: Read/Write access to all API routes, database administration, and system setting changes.
  - **`MANAGER`**: Read access to logs and analytics. Write access to agent schedules, shifts, weights, and manual reassignments.
  - **`AGENT`**: Read access to their assigned leads. Write access to lead status updates (`CONTACTED`, etc.).
- **System Ingestion Inbound Auth:** Webhooks and ingestion sources must authorize requests using a static API key passed in the `X-API-Key` header. This key is matched against a hashed representation stored in database configs.

---

## 2. Secrets Management
- **Local Development:** Configured via standard `.env` files. A template `.env.example` must be kept in the root folder with mock values.
- **Production Injection:** Application secrets (db passwords, jwt private keys, api keys) are injected at runtime via environment variables from secure vaults (e.g. AWS Secrets Manager, HashiCorp Vault).
- **Git Safety:** The `.gitignore` file must explicitly exclude `.env`, `*.pem`, and `config.json` configurations. Pre-commit hooks run GitGuardian checks to block any commit containing entropy-high keys.

---

## 3. Monitoring & Observability
- **Health Checks:** A public `/health` endpoint returns JSON detailing the status of the database connection, Redis ping latency, and application version.
- **Metrics Scraping:** Exposes standard Prometheus metrics at `/metrics` tracking:
  - `lead_ingestion_total` (counter, labeled by status: success/failed)
  - `routing_latency_seconds` (histogram)
  - `sla_violations_total` (counter)
  - `active_db_connections` (gauge)
- **Distributed Tracing:** Implements OpenTelemetry middleware to trace requests traversing the API gateway down to specific SQL executions.

---

## 4. Operational Alerts
Alert channels (Slack / PagerDuty) are notified immediately in the event of:
- **`SEV-1: ROUTING_ENGINE_HALT`**: Ingestion or assignment loop fails for > 1% of leads over a 5-minute interval.
- **`SEV-2: INFRASTRUCTURE_DOWN`**: Database or Redis fails connection checks.
- **`SEV-3: HARD_ESCALATION`**: A lead breaches SLA for the 3rd time and enters the `ESCALATED` manager queue.

---

## 5. Deployment Pipeline
All deployments are automated via CI/CD workflows:
- **Build Stage:** GitHub Actions triggers on merges to `main`. It runs the test suite, checks linters (black, ruff, mypy), and compiles the code.
- **Containerization:** If tests pass, a Docker image is built and pushed to the elastic container registry.
- **Continuous Delivery:** The image is deployed to Kubernetes staging/production environments using Helm Charts. Rolling updates are configured with a `maxUnavailable = 0` policy to ensure zero-downtime during deployments.
