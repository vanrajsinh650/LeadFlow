# 10-decisions.md - Architectural Decisions (ADRs)

This document records the design choices and engineering rationales behind LeadFlow's core technologies and algorithms.

---

## ADR 1: FastAPI as the Web Framework

### Context
LeadFlow is an API-first application that handles rapid incoming webhooks from external lead generation services. High concurrency, input validation, and clear documentation are paramount.

### Decision
We chose **FastAPI** over alternatives like Django or Flask.

### Rationale
- **Asynchronous Execution:** Native `async/await` support allows the event loop to manage high-throughput network requests (e.g., waiting for database connections or third-party webhooks) without blocking the thread pool.
- **Type Safety & Validation:** Built-in integration with **Pydantic** guarantees runtime schema validation and prevents corrupted lead payloads from entering the application.
- **Self-Documenting API:** Automatic Swagger/OpenAPI interactive documentation generation lowers the friction of external client integrations.

---

## ADR 2: PostgreSQL as the Relational Database

### Context
Sales leads are highly valuable corporate assets. Financial and audit trails must be transactional, relationally constrained, and strictly preserved.

### Decision
We chose **PostgreSQL** as the primary relational database.

### Rationale
- **ACID Compliance:** Guarantees strict transactional integrity, ensuring lead status updates and audit logs are committed atomically.
- **Referential Integrity:** Enforces database-level constraints, preventing dangling or orphaned leads.
- **Indexing Options:** Optimized B-Tree and GIN indexes facilitate sub-millisecond lookup queries on duplicate check fields (email, phone, metadata).
- **JSONB Support:** Offers relational stability while retaining the flexibility to store arbitrary marketing metadata inside JSONB fields.

---

## ADR 3: Redis for Caching and Distributed State

### Context
Lead distribution requires evaluating agent availability and incrementing round-robin indexes. Doing this directly inside a SQL database under high concurrent load results in lock contention and race conditions.

### Decision
We chose **Redis** as our in-memory data cache and distributed lock provider.

### Rationale
- **Sub-Millisecond Performance:** Read/write operations execute in-memory, minimizing the overhead of routing checks.
- **Atomic Operations:** Redis primitives (e.g., `INCR`, `HSET`) allow thread-safe modification of routing pointers and agent sequence counters without database locks.
- **Distributed Locking:** Implements the **Redlock** algorithm to guarantee that only one thread runs the assignment algorithm for a given lead, preventing duplicate assignments to the same agent.

---

## ADR 4: Weighted Round Robin (WRR) Distribution

### Context
We need a routing algorithm that distributes leads to sales reps based on their skill, experience, and shift capacity, while avoiding complex or non-deterministic machine learning architectures.

### Decision
We chose **Weighted Round Robin** as the default routing algorithm.

### Rationale
- **Deterministic and Auditable:** The algorithm is easily traceable. Managers can mathematically verify why a lead was assigned to a specific agent, simplifying routing audits.
- **Capacity Respecting:** Allows managers to dial up lead volume for senior reps (weight 8) and dial down volume for training/junior reps (weight 2) without needing to configure complex load balancing thresholds.
- **Starvation Prevention:** Unlike purely performance-based greedy routing, WRR guarantees that every eligible active agent will eventually receive leads, keeping the sales pipeline flowing equitably.
