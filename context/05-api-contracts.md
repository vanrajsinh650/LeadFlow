# 05-api-contracts.md - API Contracts

This is the Single Source of Truth (SSOT) for the LeadFlow REST API interface. All communication must strictly adhere to these payload and response schemas.

---

## 1. Global Specifications
- **Content-Type:** `application/json`
- **Authentication:** Bearer JWT token in headers (`Authorization: Bearer <token>`) for protected routes.
- **Base Path:** `/api/v1`

---

## 2. API Endpoints

### 2.1 Lead Ingestion
Create a new incoming sales lead.

- **Route:** `POST /api/v1/leads`
- **Auth Required:** No (utilizes API Key in headers `X-API-Key` to verify source system)
- **Request Payload:**
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "email": "johndoe@example.com",
  "phone": "+15550199",
  "source": "web_contact_form",
  "priority": "HIGH"
}
```
- **Ingestion Success Response (`201 Created`):**
```json
{
  "lead_id": "4a7b3c20-80d4-4c4f-bf14-a9572efde0c2",
  "status": "ASSIGNED",
  "assigned_agent_id": "8b9c2a31-40e1-456c-829d-649f7baee011",
  "sla_expires_at": "2026-06-18T20:04:06Z",
  "is_duplicate": false,
  "original_lead_id": null,
  "created_at": "2026-06-18T19:49:06Z"
}
```
- **Duplicate Prevention Match Response (`200 OK`):**
  Returned if duplicate lead is matched and auto-assigned to existing owner.
```json
{
  "lead_id": "9d8e7f60-1234-5678-abcd-1234567890ab",
  "status": "ASSIGNED",
  "assigned_agent_id": "8b9c2a31-40e1-456c-829d-649f7baee011",
  "sla_expires_at": "2026-06-18T20:04:06Z",
  "is_duplicate": true,
  "original_lead_id": "4a7b3c20-80d4-4c4f-bf14-a9572efde0c2",
  "created_at": "2026-06-18T19:49:06Z"
}
```

---

### 2.2 Agent Status & Weight Control
Allows agents to change their availability and managers to update routing weight coefficients.

- **Route:** `PATCH /api/v1/agents/{agent_id}/routing-config`
- **Auth Required:** Yes (Manager or Admin role)
- **Request Payload:**
```json
{
  "is_active": true,
  "weight": 5,
  "timezone": "America/New_York",
  "shift_start": "09:00:00",
  "shift_end": "17:00:00",
  "max_concurrent_leads": 12
}
```
- **Response (`200 OK`):**
```json
{
  "agent_id": "8b9c2a31-40e1-456c-829d-649f7baee011",
  "is_active": true,
  "weight": 5,
  "timezone": "America/New_York",
  "shift_start": "09:00:00",
  "shift_end": "17:00:00",
  "max_concurrent_leads": 12,
  "updated_at": "2026-06-18T19:49:06Z"
}
```

---

### 2.3 Lead Action & Status Update
Used by sales agents to track contact attempts and stop the SLA timer.

- **Route:** `PATCH /api/v1/leads/{lead_id}/status`
- **Auth Required:** Yes (Assigned Agent, Manager, or Admin)
- **Request Payload:**
```json
{
  "status": "CONTACTED",
  "notes": "Spoke on the phone, scheduled demo for Friday."
}
```
- **Response (`200 OK`):**
```json
{
  "lead_id": "4a7b3c20-80d4-4c4f-bf14-a9572efde0c2",
  "status": "CONTACTED",
  "sla_expires_at": "2026-06-18T20:04:06Z",
  "sla_violated": false,
  "updated_at": "2026-06-18T19:51:22Z"
}
```

---

### 2.4 Manual Lead Reassignment
Used by managers to bypass automated routing rules or handle escalations manually.

- **Route:** `POST /api/v1/leads/{lead_id}/reassign`
- **Auth Required:** Yes (Manager or Admin role)
- **Request Payload:**
```json
{
  "target_agent_id": "c1a2d3e4-f5a6-7890-bcde-f1234567890a",
  "reason": "Previous agent went home sick."
}
```
- **Response (`200 OK`):**
```json
{
  "lead_id": "4a7b3c20-80d4-4c4f-bf14-a9572efde0c2",
  "status": "ASSIGNED",
  "assigned_agent_id": "c1a2d3e4-f5a6-7890-bcde-f1234567890a",
  "reassignment_count": 1,
  "updated_at": "2026-06-18T19:52:10Z"
}
```

---

## 3. Standard Error Contracts
All error payloads returned by LeadFlow conform to a standardized JSON schema:

```json
{
  "error_code": "RESOURCE_NOT_FOUND",
  "message": "The requested lead record could not be located.",
  "timestamp": "2026-06-18T19:49:06Z",
  "details": {
    "resource": "lead",
    "id": "4a7b3c20-80d4-4c4f-bf14-a9572efde0c2"
  }
}
```

### Core Error Codes
| HTTP Status | Error Code | Description |
| :--- | :--- | :--- |
| `400` | `INVALID_PAYLOAD` | Syntax errors, malformed JSON, or input validation errors. |
| `401` | `UNAUTHORIZED` | Missing or invalid authentication token. |
| `403` | `FORBIDDEN` | Route requires a role (e.g. MANAGER) not present in token. |
| `404` | `RESOURCE_NOT_FOUND` | Database query returned no matching record. |
| `409` | `ROUTING_CONCURRENT_LIMIT` | Target agent has reached their maximum concurrent lead capacity. |
| `422` | `SLA_REASSIGNMENT_LIMIT_EXCEEDED` | Attempting to route a lead that has already reached the maximum 3 reassignments. |
| `500` | `INTERNAL_SYSTEM_FAILURE` | Unexpected database or memory layer failure. |
