from fastapi import APIRouter, Depends, HTTPException, status, Query
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, func
from typing import Optional, List
import uuid

from backend.app.db.session import get_db
from backend.app.models.lead import Lead
from backend.app.models.agent import Agent
from backend.app.models.user import User
from backend.app.models.audit import LeadAuditLog
from backend.app.schemas.lead import (
    LeadCreate, 
    LeadResponse, 
    LeadUpdateStatus, 
    LeadStatusResponse,
    LeadReassign,
    LeadReassignResponse,
    LeadDetailResponse
)
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

@router.get("", response_model=List[LeadResponse])
async def list_leads(
    search: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns list of leads supporting search, filter, sorting, and pagination.
    """
    stmt = select(Lead)
    
    # Filtering
    filters = []
    if search:
        s = f"%{search.lower()}%"
        filters.append(or_(
            func.lower(Lead.first_name).like(s),
            func.lower(Lead.last_name).like(s),
            func.lower(Lead.email).like(s),
            Lead.phone.like(s)
        ))
    if priority and priority != "ALL":
        filters.append(Lead.priority == priority.upper())
    if status and status != "ALL":
        filters.append(Lead.status == status.upper())
        
    if filters:
        stmt = stmt.where(and_(*filters))
        
    # Sorting
    col = getattr(Lead, sort_by, Lead.created_at)
    if sort_order.lower() == "asc":
        stmt = stmt.order_by(col.asc())
    else:
        stmt = stmt.order_by(col.desc())
        
    # Pagination
    offset = (page - 1) * limit
    stmt = stmt.offset(offset).limit(limit)
    
    result = await db.execute(stmt)
    leads = result.scalars().all()
    return leads

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

@router.get("/{lead_id}", response_model=LeadDetailResponse)
async def get_lead_detail(lead_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """
    Fetches details of a single lead, including full audit log history and assigned agent name.
    """
    stmt = select(Lead).where(Lead.id == lead_id)
    result = await db.execute(stmt)
    lead = result.scalar_one_or_none()
    
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )
        
    # Get assigned agent's name if present
    agent_name = None
    if lead.assigned_agent_id:
        stmt_agent = (
            select(User.full_name)
            .join(Agent, Agent.id == User.id)
            .where(Agent.id == lead.assigned_agent_id)
        )
        agent_name_res = await db.execute(stmt_agent)
        agent_name = agent_name_res.scalar_one_or_none()

    # Get audit logs
    stmt_logs = (
        select(LeadAuditLog)
        .where(LeadAuditLog.lead_id == lead_id)
        .order_by(LeadAuditLog.created_at.desc())
    )
    logs_result = await db.execute(stmt_logs)
    audit_logs = logs_result.scalars().all()

    lead_detail = {
        "id": lead.id,
        "first_name": lead.first_name,
        "last_name": lead.last_name,
        "email": lead.email,
        "phone": lead.phone,
        "source": lead.source,
        "priority": lead.priority,
        "status": lead.status,
        "assigned_agent_id": lead.assigned_agent_id,
        "assigned_agent_name": agent_name,
        "sla_expires_at": lead.sla_expires_at,
        "sla_violated": lead.sla_violated,
        "is_duplicate": lead.is_duplicate,
        "original_lead_id": lead.original_lead_id,
        "reassignment_count": lead.reassignment_count,
        "created_at": lead.created_at,
        "updated_at": lead.updated_at,
        "audit_logs": audit_logs
    }
    return lead_detail

@router.patch("/{lead_id}/status", response_model=LeadStatusResponse)
async def update_lead_status(
    lead_id: uuid.UUID, 
    payload: LeadUpdateStatus, 
    db: AsyncSession = Depends(get_db)
):
    """
    Updates a lead's status, stops the SLA timer if contacted, and writes audit history.
    """
    stmt = select(Lead).where(Lead.id == lead_id)
    result = await db.execute(stmt)
    lead = result.scalar_one_or_none()

    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )

    old_status = lead.status
    new_status = payload.status.upper()

    lead.status = new_status
    lead.updated_at = datetime.now(timezone.utc)

    # SLA Clock Termination
    # Stopped when the lead transitions to CONTACTED, IN_PROGRESS, or any terminal state
    if new_status in ["CONTACTED", "IN_PROGRESS", "CLOSED_WON", "CLOSED_LOST"]:
        lead.sla_expires_at = None

    # Write Audit Log
    audit_log = LeadAuditLog(
        lead_id=lead.id,
        action="STATUS_CHANGE",
        old_status=old_status,
        new_status=new_status,
        old_agent_id=lead.assigned_agent_id,
        new_agent_id=lead.assigned_agent_id,
        notes=payload.notes or "Manual status update."
    )
    db.add(audit_log)
    await db.commit()
    await db.refresh(lead)

    return lead

@router.post("/{lead_id}/reassign", response_model=LeadReassignResponse)
async def reassign_lead(
    lead_id: uuid.UUID,
    payload: LeadReassign,
    db: AsyncSession = Depends(get_db)
):
    """
    Manually reassigns a lead to a target agent, checking constraints, capacity load limits, and updating SLA.
    """
    stmt = select(Lead).where(Lead.id == lead_id)
    result = await db.execute(stmt)
    lead = result.scalar_one_or_none()
    
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )
        
    # Reassignment Limit Enforcement
    if lead.reassignment_count >= 3:
        # Auto-escalate the lead
        old_agent_id = lead.assigned_agent_id
        lead.status = "ESCALATED"
        lead.assigned_agent_id = None
        lead.sla_expires_at = None
        lead.updated_at = datetime.now(timezone.utc)
        
        audit_log = LeadAuditLog(
            lead_id=lead.id,
            action="ESCALATE",
            old_status=lead.status,
            new_status="ESCALATED",
            old_agent_id=old_agent_id,
            new_agent_id=None,
            notes="Manual reassignment rejected. Reassignment limit (3) exceeded, lead escalated."
        )
        db.add(audit_log)
        await db.commit()
        
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="SLA_REASSIGNMENT_LIMIT_EXCEEDED"
        )
        
    # Verify target agent exists and is active
    stmt_agent = select(Agent).where(Agent.id == payload.target_agent_id, Agent.is_active == True)
    result_agent = await db.execute(stmt_agent)
    agent = result_agent.scalar_one_or_none()
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target agent does not exist or is inactive"
        )

    # Verify target agent capacity load limit
    stmt_load = select(func.count()).select_from(Lead).where(
        Lead.assigned_agent_id == agent.id,
        Lead.status.in_(["ASSIGNED", "CONTACTED", "IN_PROGRESS"])
    )
    load_res = await db.execute(stmt_load)
    current_load = load_res.scalar() or 0
    
    if current_load >= agent.max_concurrent_leads:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="ROUTING_CONCURRENT_LIMIT"
        )

    old_agent_id = lead.assigned_agent_id
    lead.assigned_agent_id = agent.id
    lead.status = "ASSIGNED"
    lead.reassignment_count += 1
    
    # Calculate new SLA timer
    duration = get_sla_duration(lead.priority)
    lead.sla_expires_at = datetime.now(timezone.utc) + duration
    lead.updated_at = datetime.now(timezone.utc)
    
    audit_log = LeadAuditLog(
        lead_id=lead.id,
        action="REASSIGN",
        old_status=lead.status,
        new_status="ASSIGNED",
        old_agent_id=old_agent_id,
        new_agent_id=agent.id,
        notes=payload.reason or "Manual reassignment by manager."
    )
    db.add(audit_log)
    await db.commit()
    await db.refresh(lead)
    
    return lead
