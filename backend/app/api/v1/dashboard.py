from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timezone

from backend.app.db.session import get_db
from backend.app.models.lead import Lead
from backend.app.models.agent import Agent
from backend.app.models.user import User
from backend.app.models.audit import LeadAuditLog
from backend.app.schemas.lead import DashboardStatsResponse

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/stats", response_model=DashboardStatsResponse)
async def get_dashboard_stats(db: AsyncSession = Depends(get_db)):
    """
    Computes and aggregates sales stats, agent load capacities, and recent activity timeline logs.
    """
    # 1. Total Leads
    stmt_total_leads = select(func.count()).select_from(Lead)
    res_total = await db.execute(stmt_total_leads)
    total_leads = res_total.scalar() or 0
    
    # 2. Active Agents
    stmt_active_agents = select(func.count()).select_from(Agent).where(Agent.is_active == True)
    res_active = await db.execute(stmt_active_agents)
    active_agents = res_active.scalar() or 0

    # 3. Total Agents
    stmt_total_agents = select(func.count()).select_from(Agent)
    res_total_agents = await db.execute(stmt_total_agents)
    total_agents = res_total_agents.scalar() or 0

    # 4. SLA Violations
    stmt_sla_violations = select(func.count()).select_from(Lead).where(Lead.sla_violated == True)
    res_sla = await db.execute(stmt_sla_violations)
    sla_violations = res_sla.scalar() or 0

    # 5. Converted Leads (Closed Won)
    stmt_converted = select(func.count()).select_from(Lead).where(Lead.status == "CLOSED_WON")
    res_converted = await db.execute(stmt_converted)
    converted_leads = res_converted.scalar() or 0
    
    conversion_rate = 0.0
    if total_leads > 0:
        conversion_rate = round((converted_leads / total_leads) * 100, 1)

    # 6. Agent load capacity list
    stmt_agents = select(Agent, User).join(User, Agent.id == User.id).where(Agent.is_active == True)
    res_agents = await db.execute(stmt_agents)
    agents_records = res_agents.all()
    
    agent_loads = []
    for agent, user in agents_records:
        stmt_load = select(func.count()).select_from(Lead).where(
            Lead.assigned_agent_id == agent.id,
            Lead.status.in_(["ASSIGNED", "CONTACTED", "IN_PROGRESS"])
        )
        load_res = await db.execute(stmt_load)
        current_load = load_res.scalar() or 0
        
        agent_loads.append({
            "agent_name": user.full_name,
            "weight": agent.weight,
            "current_load": current_load,
            "max_load": agent.max_concurrent_leads
        })

    # 7. Recent activity log timeline (last 10 items)
    stmt_logs = (
        select(LeadAuditLog, Lead, User.full_name)
        .join(Lead, LeadAuditLog.lead_id == Lead.id)
        .outerjoin(User, LeadAuditLog.new_agent_id == User.id)
        .order_by(LeadAuditLog.created_at.desc())
        .limit(10)
    )
    res_logs = await db.execute(stmt_logs)
    logs_records = res_logs.all()
    
    recent_logs = []
    now_utc = datetime.now(timezone.utc)
    for log, lead, agent_name in logs_records:
        log_time = log.created_at
        if log_time.tzinfo is None:
            log_time = log_time.replace(tzinfo=timezone.utc)
            
        delta = now_utc - log_time
        if delta.days > 0:
            time_str = f"{delta.days} days ago"
        elif delta.seconds >= 3600:
            time_str = f"{delta.seconds // 3600} hours ago"
        elif delta.seconds >= 60:
            time_str = f"{delta.seconds // 60} minutes ago"
        else:
            time_str = "just now"
            
        # Map actions to status pill styles: success, warning, danger, neutral
        status_val = "neutral"
        if log.action in ["ASSIGN", "REASSIGN"] or log.new_status == "CLOSED_WON":
            status_val = "success"
        elif log.action in ["ESCALATE", "REASSIGN_FAILED"] or log.new_status == "ESCALATED":
            status_val = "danger"
        elif log.action == "INGEST_DUPLICATE":
            status_val = "warning"
            
        recent_logs.append({
            "id": str(log.id),
            "lead_name": f"{lead.first_name} {lead.last_name}",
            "action": log.notes or f"Action: {log.action}",
            "agent": agent_name or "Unassigned",
            "time": time_str,
            "status": status_val
        })

    return {
        "total_leads": total_leads,
        "active_agents": active_agents,
        "total_agents": total_agents,
        "sla_violations": sla_violations,
        "conversion_rate": conversion_rate,
        "agent_loads": agent_loads,
        "recent_logs": recent_logs
    }
