# 04-database.md - Database Schema & Rules

This is the Single Source of Truth (SSOT) for the LeadFlow database design, relations, and validation rules.

## 1. Schema Diagram & Tables

### Users Table (`users`)
Stores general credentials and system roles.
- `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
- `email` (VARCHAR(255), Unique, Not Null)
- `hashed_password` (VARCHAR(255), Not Null)
- `full_name` (VARCHAR(255), Not Null)
- `role` (VARCHAR(50), Not Null) -- `ADMIN`, `MANAGER`, `AGENT`
- `created_at` (TIMESTAMP WITH TIME ZONE, Default: `NOW()`)
- `updated_at` (TIMESTAMP WITH TIME ZONE, Default: `NOW()`)

### Agents Table (`agents`)
Extends `users` with routing configuration parameters.
- `id` (UUID, Primary Key, Foreign Key -> `users.id` ON DELETE CASCADE)
- `is_active` (BOOLEAN, Default: `false`, Not Null)
- `weight` (INTEGER, Default: `1`, Not Null)
- `timezone` (VARCHAR(100), Default: `'UTC'`, Not Null)
- `shift_start` (TIME, Not Null) -- e.g., '09:00:00'
- `shift_end` (TIME, Not Null)   -- e.g., '17:00:00'
- `max_concurrent_leads` (INTEGER, Default: `10`, Not Null)
- `created_at` (TIMESTAMP WITH TIME ZONE, Default: `NOW()`)
- `updated_at` (TIMESTAMP WITH TIME ZONE, Default: `NOW()`)

### Leads Table (`leads`)
Primary entity containing contact info, status, assignment info, and SLA parameters.
- `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
- `first_name` (VARCHAR(100), Not Null)
- `last_name` (VARCHAR(100), Not Null)
- `email` (VARCHAR(255), Not Null)
- `phone` (VARCHAR(50), Not Null)
- `source` (VARCHAR(100), Not Null)
- `priority` (VARCHAR(50), Default: `'MEDIUM'`, Not Null) -- `HIGH`, `MEDIUM`, `LOW`
- `status` (VARCHAR(50), Default: `'UNASSIGNED'`, Not Null) -- See Enums section
- `assigned_agent_id` (UUID, Nullable, Foreign Key -> `agents.id` ON DELETE SET NULL)
- `sla_expires_at` (TIMESTAMP WITH TIME ZONE, Nullable)
- `sla_violated` (BOOLEAN, Default: `false`, Not Null)
- `is_duplicate` (BOOLEAN, Default: `false`, Not Null)
- `original_lead_id` (UUID, Nullable, Foreign Key -> `leads.id` ON DELETE SET NULL)
- `reassignment_count` (INTEGER, Default: `0`, Not Null)
- `created_at` (TIMESTAMP WITH TIME ZONE, Default: `NOW()`)
- `updated_at` (TIMESTAMP WITH TIME ZONE, Default: `NOW()`)

### Lead Audit Logs Table (`lead_audit_logs`)
Maintains an immutable historical record of all lifecycle updates.
- `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
- `lead_id` (UUID, Not Null, Foreign Key -> `leads.id` ON DELETE CASCADE)
- `action` (VARCHAR(100), Not Null) -- e.g., `INGEST`, `ASSIGN`, `REASSIGN`, `SLA_BREACH`, `STATUS_CHANGE`
- `old_status` (VARCHAR(50), Nullable)
- `new_status` (VARCHAR(50), Not Null)
- `old_agent_id` (UUID, Nullable)
- `new_agent_id` (UUID, Nullable)
- `performed_by` (UUID, Nullable, Foreign Key -> `users.id` ON DELETE SET NULL)
- `notes` (TEXT, Nullable)
- `created_at` (TIMESTAMP WITH TIME ZONE, Default: `NOW()`, Not Null)

---

## 2. Relationships

```
  +-------------+            +-------------+
  |    users    | 1        1 |   agents    |
  |-------------|------------|-------------|
  | id (PK)     |            | id (PK, FK) |
  +-------------+            +-------------+
         |                          |
         | 1                        | 1
         |                          |
         | 0..*                     | 0..*
  +------------------+              |
  | lead_audit_logs  |              |
  |------------------| <------------+
  | performed_by (FK)|              |
  | lead_id (FK)     |              |
  +------------------+              |
         ^                          |
         | 0..*                     |
         |                          |
         | 1                        v
  +---------------------------------+
  |             leads               |
  |---------------------------------|
  | assigned_agent_id (FK)          |
  | original_lead_id (FK -> self)   |
  +---------------------------------+
```

---

## 3. Constraints
- **Agent Weight Range:** `CHECK (weight >= 0 AND weight <= 10)`
- **Agent Concurrency Ceiling:** `CHECK (max_concurrent_leads > 0)`
- **Lead Reassignment Bound:** `CHECK (reassignment_count >= 0 AND reassignment_count <= 3)`
- **Duplicate Safety:** A foreign key relationship `original_lead_id` must only exist if `is_duplicate = TRUE`.

---

## 4. Database Indexes
To maintain performance during scale operations, the following indexes are mandatory:
- **`idx_users_email`** (B-Tree on `users(email)`) - Fast login and lookup.
- **`idx_leads_email_phone`** (B-Tree on `leads(email, phone)`) - Used for duplicate verification scan.
- **`idx_leads_status_assigned_agent`** (B-Tree on `leads(status, assigned_agent_id)`) - Performance filter for checking agent concurrent load.
- **`idx_leads_sla_expired`** (B-Tree on `leads(sla_expires_at)`) - Used by the background scheduler to quickly retrieve active SLA breaches.

---

## 5. Enums & Status Ranges

### User Roles
- `ADMIN`: Global configuration and full system read-write rights.
- `MANAGER`: Management of agents, shifts, weight quotas, and manual escalations.
- `AGENT`: Can claim, contact, progress, and close assigned leads.

### Lead Status Lifecycle States
- `UNASSIGNED`: Ingested, waitlist queue.
- `ASSIGNED`: Routed to a specific agent; SLA clock running.
- `CONTACTED`: Agent made initial contact; SLA clock stopped.
- `IN_PROGRESS`: Lead active in the sales pipeline.
- `CLOSED_WON`: Lead successfully converted to customer.
- `CLOSED_LOST`: Lead rejected or lost.
- `ESCALATED`: Breached 3x SLA threshold; queued for Manager manual reassignment.

### Lead Priorities
- `HIGH`
- `MEDIUM`
- `LOW`
