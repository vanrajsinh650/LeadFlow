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
- **Health Checks:** A public `/health` endpoint returns JSON detailing the status of the database connection, Redis ping latency, and application health.
- **Application Logging:** Key operational events (SLA breaches, routing issues) are logged as structured JSON logs for audit purposes.

---

## 4. Operational Alerts
Errors are raised via system logging in the event of:
- **`ROUTING_ENGINE_HALT`**: Ingestion or assignment loop fails.
- **`INFRASTRUCTURE_DOWN`**: Database or Redis connection failure.
- **`HARD_ESCALATION`**: A lead breaches SLA for the 3rd time and enters the `ESCALATED` manager status.

---

## 5. Deployment Pipeline
All deployments are automated via docker-compose configurations:
- **Build Stage:** GitHub Actions triggers on merges to `main` to run the test suite and verify lint rules.
- **Containerization:** The backend and frontend are built as standard Docker images.
- **Deployment:** Zero-downtime deployment is achieved by running standard `docker compose up -d` on the target VPS or app runner.

