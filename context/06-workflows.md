# 06-workflows.md - Process Workflows

This is the Single Source of Truth (SSOT) for lead distribution, SLA monitoring, and escalation processes.

---

## 1. Lead Lifecycle Workflow
This chart tracks the lifecycle transitions of a single lead from initial API ingestion to close.

```mermaid
stateDiagram-v2
    [*] --> Ingestion : POST /api/v1/leads
    
    state Ingestion {
        [*] --> DeduplicationCheck
        DeduplicationCheck --> RouteToOriginalOwner : Duplicate Found (Active Owner)
        DeduplicationCheck --> WeightedRoundRobin : Unique or Inactive Owner
    }

    RouteToOriginalOwner --> ASSIGNED
    WeightedRoundRobin --> ASSIGNED
    WeightedRoundRobin --> UNASSIGNED : No Eligible Agents (Fallback Queue)

    UNASSIGNED --> WeightedRoundRobin : Agent Becomes Active

    state ASSIGNED {
        [*] --> TimerRunning : SLA timer started
        TimerRunning --> ContactedEvent : Agent calls/emails (PATCH /leads/{id}/status)
        TimerRunning --> SLA_Expired : Current Time > SLA Expiry
    }

    ContactedEvent --> CONTACTED
    CONTACTED --> IN_PROGRESS : Active Sales Pipeline
    
    IN_PROGRESS --> CLOSED_WON : Lead converted
    IN_PROGRESS --> CLOSED_LOST : Lead lost

    SLA_Expired --> SLA_VIOLATED_STATE
    SLA_VIOLATED_STATE --> ReassignAgent : Reassignment Count < 3
    SLA_VIOLATED_STATE --> ESCALATED : Reassignment Count >= 3

    ReassignAgent --> ASSIGNED : Route to Next Agent (Increment Count)
    
    ESCALATED --> ManualAssignment : Manager intervention
    ManualAssignment --> ASSIGNED : Routed manually (Reset SLA timer)

    CLOSED_WON --> [*]
    CLOSED_LOST --> [*]
```

---

## 2. Follow-Up Lifecycle Workflow
Sales agents must progress leads through contact milestones within configured SLA deadlines.

1. **Assignment Notification:** Immediate WebSocket message or webhook notification is sent to the assigned agent's client terminal upon routing.
2. **First Contact Attempt:** Agent calls or emails the lead. The agent logs this action via the application interface (`PATCH /api/v1/leads/{lead_id}/status`).
3. **Timer Termination:** The system intercepts the status transition. If the status transition occurs before `sla_expires_at`, the SLA is marked as met.
4. **Follow-Up Cadence:** If contact is made, the system requires the agent to log a subsequent activity within 48 hours. If no activity is logged, the lead status defaults back to a warning queue (`Follow-up Required`) for managers to audit.

---

## 3. Escalation Lifecycle Workflow
Detailed sequence for handling SLA breaches and agent penalties.

```mermaid
sequenceDiagram
    autonumber
    participant Job as SLA Scheduler (Cron)
    participant DB as PostgreSQL DB
    participant Redis as Redis Cache
    participant Router as Routing Engine
    participant Ops as Slack/Manager Alerts

    Job->>DB: Query leads WHERE status = 'ASSIGNED' AND NOW() > sla_expires_at
    DB-->>Job: List of breached Lead IDs (e.g., Lead #99, Agent A)
    
    loop For each breached lead
        Job->>DB: Mark lead status as ESCALATED / SLA_VIOLATED
        Job->>DB: Increment reassignment_count by 1
        
        alt Reassignment Count <= 3
            Job->>DB: Remove Agent A from Lead #99 (assigned_agent_id = NULL)
            Job->>DB: Set Agent A.is_active = FALSE (1-hour Cooldown Penalty)
            Job->>Redis: Invalidate Agent A cache entry
            Job->>Router: Initiate Weighted Round Robin route request for Lead #99
            Router-->>Job: Selected Agent B
            Job->>DB: Assign Lead #99 to Agent B & reset sla_expires_at
            Job->>DB: Log Audit Log: "SLA Reassignment from Agent A to Agent B"
        else Reassignment Count > 3
            Job->>DB: Mark Lead #99 status = 'ESCALATED'
            Job->>DB: Route Lead #99 to Manager Queue
            Job->>DB: Log Audit Log: "Hard Escalation - Manual assignment required"
            Job->>Ops: Dispatch Alert (Slack/SMS: "SLA Reassignment limit exceeded on Lead #99")
        end
    end
```
