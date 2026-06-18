# 11-demo-scenarios.md - Demo Scenarios & Verification Rules

This document outlines the end-to-end user and system scenarios that must run successfully to validate the LeadFlow system during developer testing and interview demonstrations.

---

## Scenario 1: New Lead Arrives (Clean Routing Flow)
Verify that a clean incoming lead is distributed correctly to the next eligible agent.

### Setup
- Active agents in system: Agent A (weight 5), Agent B (weight 5).
- Both agents are active and within working hours.
- Lead Queue: Empty.

### Action
1. Send `POST /api/v1/leads` with a unique email and phone number.

### Expected Behavior
- Lead is persisted with status `ASSIGNED`.
- Lead is assigned to Agent A (or B) based on current Weighted Round Robin pointer.
- `sla_expires_at` is set to exactly 15 minutes in the future (High priority).
- LeadAuditLog contains an `INGEST` and an `ASSIGN` event with timestamps.

---

## Scenario 2: Duplicate Lead Arrives (Merge & Route to Owner Flow)
Verify that an incoming lead with an existing phone/email bypasses normal round robin and routes to the original owner.

### Setup
- Lead 1 is assigned to Agent A (created 10 days ago, status `IN_PROGRESS`).

### Action
1. Send `POST /api/v1/leads` with the exact same email or phone number as Lead 1.

### Expected Behavior
- Response returns success code `200 OK`.
- Lead 2 is marked `is_duplicate = True` and `original_lead_id` matches Lead 1.
- Lead 2 is directly assigned to Agent A, bypassing Weighted Round Robin.
- LeadAuditLog registers duplicate mapping event.

---

## Scenario 3: SLA Violation & Cool Down (Automated Escalation Flow)
Verify that an agent ignoring a lead triggers SLA violation, cooldown penalty, and routing.

### Setup
- Lead 3 is assigned to Agent A.
- SLA expiration passes (Current time > `sla_expires_at`).

### Action
1. Run background SLA monitor checker job (or simulate time passage).

### Expected Behavior
- System marks Lead 3 as `sla_violated = True`.
- Lead 3 is unassigned from Agent A (agent ID set to NULL).
- Agent A's status is toggled to `is_active = False` (cooldown penalty).
- Lead 3 is placed back in the routing queue and reassigned to Agent B (the next eligible agent).
- Lead 3 `reassignment_count` increments to `1`.
- Audit logs record the SLA breach and the subsequent reassignment event.

---

## Scenario 4: Hard Escalation Flow (Limit Reached)
Verify that a lead breaching SLA 3 times is escalated to managers instead of continuing to route.

### Setup
- Lead 4 has already been reassigned 3 times (`reassignment_count = 3`).
- SLA expiration passes on Agent B.

### Action
1. Run background SLA monitor checker job.

### Expected Behavior
- System checks that `reassignment_count` matches 3.
- Lead 4 status is set to `ESCALATED`.
- Lead 4 `assigned_agent_id` is set to NULL.
- Lead is placed in the Manual Manager Queue.
- System triggers a Slack/pager alert notification for immediate manager attention.
