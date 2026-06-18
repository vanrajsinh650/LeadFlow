# 08-engineering-rules.md - Engineering & Coding Rules

This is the Single Source of Truth (SSOT) for code organization, conventions, testing patterns, and performance limits.

---

## 1. Folder Structure
The LeadFlow application conforms to a unified monorepo folder structure:

```
leadflow/
├── backend/
│   ├── app/                 # FastAPI application logic
│   │   ├── api/             # Endpoint routing rules
│   │   │   ├── deps.py      # Dependency injections
│   │   │   └── v1/          # Versioned API routes
│   │   ├── core/            # Global settings & config
│   │   ├── db/              # DB session & migrations
│   │   ├── models/          # Database ORM models
│   │   ├── schemas/         # Pydantic serializer schemas
│   │   ├── services/        # Routing, deduplication, and SLA services
│   │   └── main.py          # FastAPI application entrypoint
│   ├── tests/
│   │   ├── conftest.py      # Pytest fixtures and settings
│   │   ├── unit/            # Backend unit tests
│   │   └── integration/     # Integration API tests
│   └── pyproject.toml       # Backend python dependencies
├── frontend/
│   ├── src/                 # Next.js 15 app source folder
│   ├── package.json         # Node.js dependencies configuration
│   └── ...                  # Tailwind, TypeScript config files
├── context/                 # Context rules files
├── docker/                  # Dockerfiles and docker-compose templates
├── scripts/                 # Utility automation scripts
└── README.md                # General project info
```

---

## 2. Naming Conventions
- **Code:**
  - Python files, functions, variables, and modules: `snake_case`.
  - Class names: `PascalCase`.
  - Global constants: `UPPER_CASE`.
- **Database:**
  - Tables: plural `snake_case` (e.g., `lead_audit_logs`).
  - Columns: `snake_case` (e.g., `sla_expires_at`).
  - Foreign key columns: `<target_table_singular>_id` (e.g., `assigned_agent_id`).
- **REST Endpoints:**
  - Path parameters: kebab-case in URIs (e.g., `/api/v1/agents/{agent_id}/routing-config`).
  - Query parameters: `snake_case`.

---

## 3. Testing Requirements
No code change is complete without unit and integration testing.

- **Framework:** `pytest` + `pytest-asyncio` for asynchronous endpoint testing.
- **Coverage:** Maintain code coverage at or above **85%**.
- **Isolation:**
  - Unit tests must mock all external calls, database queries, and Redis state modifications.
  - Integration tests must run against an ephemeral database (using PostgreSQL test containers or SQLite in-memory mode) and a mock Redis server.

---

## 4. Logging Rules
- **JSON Format:** All console logs must print in structured JSON format to allow log parsers (e.g. Datadog, ELK) to index fields.
- **Required Events to Log:**
  - Lead creation (`lead_id`, `source`)
  - Lead assignment (`lead_id`, `agent_id`, `duration_sec_since_creation`)
  - Lead reassignment (`lead_id`, `old_agent_id`, `new_agent_id`, `reassignment_count`)
  - SLA Violation (`lead_id`, `agent_id`, `sla_expires_at`)
  - Connection/System failures (`exception_class`, `traceback`)
- **GDPR / Security Filter:**
  - **NEVER** write passwords, plain text tokens, API keys, or raw personally identifiable information (PII) like full customer names, emails, or phone numbers to logs. Use hashed or masked representations (e.g., `joh***@example.com`) if debugging context is required.

---

## 5. Performance Rules
- **Asynchronous Loop Integrity:** Avoid using blocking I/O calls (e.g., standard `requests` library or `time.sleep`) in FastAPI routes. Always use async equivalents (`httpx` and `asyncio.sleep`).
- **Relational Lookups:** SQLAlchemy queries must explicitly use `joinedload` or `selectinload` to resolve relationships in a single database query. N+1 queries will fail code review.
- **Database Indexes:** Every query filtering on a column must have a matching index in PostgreSQL. No sequential scans allowed on scale tables like `leads` or `lead_audit_logs`.
- **Redis Operations:** Always batch Redis commands using pipelines (`redis.pipeline()`) when updating multiple keys (e.g., during bulk round-robin resets) to reduce network round-trips.

---

## 6. Commit Message Rules
- **Prohibited Prefixes:** Do **NOT** use conventional commit prefixes or semantic tags (such as `feat:`, `docs:`, `fix:`, `error:`, or `feat..`) in commit messages.
- **Message Content:** Commit messages must be plain, natural language descriptions that explain what was changed and completed in the project.

