# 02-business-rules.md - Business Rules

This is the Single Source of Truth (SSOT) for all business logic and routing constraints within the LeadFlow platform.

## 1. Lead Assignment Rules
Lead assignment is governed by a **Weighted Round Robin (WRR)** distribution algorithm combined with agent availability filters.

### Agent Eligibility
A lead can only be routed to an agent if they meet **all** of the following criteria:
- **Status:** The agent's status must be explicitly set to `Active`.
- **Working Hours:** The current system time must fall within the agent's defined timezone and shift window (e.g., 09:00 - 17:00 local time).
- **Weight:** The agent must have a capacity weight greater than `0` (range: `0-10`).
- **Load Limit:** The agent must not have exceeded their maximum concurrent active leads limit (if configured).

### Weighted Round Robin (WRR) Algorithm
- **Weight Calculation:** The routing engine computes eligibility sequences using the formula:
  $$\text{Probability}(Agent_i) = \frac{\text{Weight}(Agent_i)}{\sum_{j=1}^{N} \text{Weight}(Agent_j)}$$
- **Sequence Retention:** The system maintains a stateful counter or pointer per distribution group (queue) in Redis to track which agent is next in line based on cumulative weights.
- **Fallback Rule:** If no eligible agents are found at the time of ingestion, the lead is placed into the `Unassigned Escapes` queue. An immediate operations alert is triggered, and the lead is processed as soon as an eligible agent becomes active.

---

## 2. Duplicate Prevention Rules
To prevent conflicting sales reps contacting the same prospect, all incoming leads pass through the duplicate detection engine before routing.

### Detection Window & Match Criteria
- **Match Criteria:** A new lead is classified as a duplicate if it matches an existing lead on:
  - `email` (exact match, case-insensitive) OR
  - `phone` (normalized format, exact match on digits)
- **Time Window:** The check looks back across a configurable window (default: `30 days`).

### Routing Duplicates
- **Ownership Routing:** If a duplicate lead is detected, it must bypass the Weighted Round Robin loop and be assigned directly to the **original agent** who owns the existing lead, provided:
  - The original agent is still an employee/user in the system.
  - The original lead was created within the last 30 days.
- **Routing Override Exception:** If the original agent is currently marked `Inactive`, or if the existing lead status is `Closed-Lost`, the new lead is routed via normal Weighted Round Robin but tagged with `is_duplicate = True` and linked to the original lead ID.

---

## 3. SLA (Service Level Agreement) Rules
To maintain high speed-to-contact, every lead is subject to strict SLA deadlines.

### SLA Thresholds
SLA timelines are determined by the lead's priority tier:
- **Tier 1 (High Priority / Live Request):** 15 minutes
- **Tier 2 (Medium Priority / Web Form):** 60 minutes
- **Tier 3 (Low Priority / Event List):** 24 hours

### SLA Clock Lifecycle
- **Trigger:** The SLA clock starts running the exact millisecond the lead is set to `Assigned` state and a specific agent ID is associated.
- **Stopping Event:** The clock is permanently stopped when the lead transitions to `Contacted`, `In Progress`, or any terminal state (`Converted` / `Nurture` / `Closed-Lost`).
- **SLA Breach Event:** If the clock matches or exceeds the threshold without a stopping event, the lead status is updated to `SLA_Violated = True` and a background event is emitted.

---

## 4. Reassignment & Escalation Rules
When an agent fails to meet their SLA obligations, the system automatically intervenes.

### SLA Reassignment Trigger
- **Action:** Immediately upon an SLA breach, the lead is revoked from the current agent.
- **Cooldown Penalty:** The failing agent is automatically marked as `Inactive` or placed in a "cooldown" state for 1 hour to prevent them from receiving additional leads until they resolve outstanding tasks.
- **Re-Routing:** The lead is returned to the active queue and routed to the next eligible agent via the Weighted Round Robin engine.
- **Reassignment Limit:** A single lead can be reassigned a maximum of **3 times**.
- **Escalation Exception:** If a lead breaches SLA for the 3rd time, it is flagged as `Escalated` and assigned directly to the `Sales Manager` role for manual intervention, bypassing all automated WRR routing.
