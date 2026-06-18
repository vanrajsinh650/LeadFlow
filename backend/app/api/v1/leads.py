from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from backend.app.db.session import get_db
from backend.app.models.lead import Lead
from backend.app.models.audit import LeadAuditLog
from backend.app.schemas.lead import LeadCreate, LeadResponse
from backend.app.services.deduplication import DeduplicationService
from backend.app.services.assignment_service import AssignmentService

router = APIRouter(prefix="/leads", tags=["leads"])

def get_sla_duration(priority: str) -> timedelta:
    priority_upper = priority.upper()
    if priority_upper == "HIGH":
        return timedelta(minutes=15)
    elif priority_upper == "LOW":
        return timedelta(hours=24)
    else: # MEDIUM
        return timedelta(minutes=60)

@router.post("", response_model=LeadResponse, status_code=status.HTTP_201_CREATED)
async def create_lead(payload: LeadCreate, db: AsyncSession = Depends(get_db)):
    """
    Ingests a new lead, evaluates duplicates, executes agent routing, and logs audit entries.
    """
    # 1. Normalize telephone digits
    normalized_phone = DeduplicationService.normalize_phone(payload.phone)

    # 2. Duplicate Detection
    is_duplicate, original_lead, target_agent = await DeduplicationService.check_and_get_duplicate(
        db=db,
        email=payload.email,
        phone=payload.phone
    )

    lead = Lead(
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=payload.email,
        phone=normalized_phone,
        source=payload.source,
        priority=payload.priority.upper(),
        is_duplicate=is_duplicate,
        original_lead_id=original_lead.id if original_lead else None
    )

    assigned_agent = None

    if is_duplicate and target_agent:
        # Route to original owner directly bypassing WRR
        assigned_agent = target_agent
        lead.status = "ASSIGNED"
        lead.assigned_agent_id = target_agent.id
    else:
        # Route via Weighted Round Robin selection
        assigned_agent = await AssignmentService.assign_lead(db, lead)
        if assigned_agent:
            lead.status = "ASSIGNED"
            lead.assigned_agent_id = assigned_agent.id
        else:
            lead.status = "UNASSIGNED"
            lead.assigned_agent_id = None

    # Calculate SLA expiration if assigned
    if lead.status == "ASSIGNED":
        duration = get_sla_duration(lead.priority)
        lead.sla_expires_at = datetime.now(timezone.utc) + duration

    # 3. Persist lead to database
    db.add(lead)
    await db.flush()  # Generates lead.id for audit logs

    # 4. Write Audit Log
    audit_log = LeadAuditLog(
        lead_id=lead.id,
        action="INGEST" if not is_duplicate else "INGEST_DUPLICATE",
        new_status=lead.status,
        new_agent_id=lead.assigned_agent_id,
        notes=f"Lead ingested. Duplicate: {is_duplicate}. Assigned: {lead.status == 'ASSIGNED'}."
    )
    db.add(audit_log)
    await db.commit()
    await db.refresh(lead)

    return lead
