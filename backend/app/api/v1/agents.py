from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
import uuid
from datetime import datetime, timezone

from backend.app.db.session import get_db
from backend.app.models.agent import Agent
from backend.app.models.user import User
from backend.app.models.lead import Lead
from backend.app.schemas.lead import AgentResponse, AgentUpdateConfig, AgentConfigResponse

router = APIRouter(prefix="/agents", tags=["agents"])

@router.get("", response_model=List[AgentResponse])
async def list_agents(db: AsyncSession = Depends(get_db)):
    """
    Retrieves all agents joined with user details, including their current active lead load.
    """
    stmt = select(Agent, User).join(User, Agent.id == User.id)
    result = await db.execute(stmt)
    records = result.all()
    
    agents_list = []
    for agent, user in records:
        # Calculate active lead load
        stmt_load = select(func.count()).select_from(Lead).where(
            Lead.assigned_agent_id == agent.id,
            Lead.status.in_(["ASSIGNED", "CONTACTED", "IN_PROGRESS"])
        )
        load_res = await db.execute(stmt_load)
        current_load = load_res.scalar() or 0
        
        agents_list.append({
            "id": agent.id,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
            "is_active": agent.is_active,
            "weight": agent.weight,
            "timezone": agent.timezone,
            "shift_start": agent.shift_start,
            "shift_end": agent.shift_end,
            "max_concurrent_leads": agent.max_concurrent_leads,
            "current_load": current_load
        })
    return agents_list

@router.patch("/{agent_id}/routing-config", response_model=AgentConfigResponse)
async def update_agent_config(
    agent_id: uuid.UUID,
    payload: AgentUpdateConfig,
    db: AsyncSession = Depends(get_db)
):
    """
    Updates agent availability, weights, timezone, shift hours, or capacity limits.
    """
    stmt = select(Agent).where(Agent.id == agent_id)
    result = await db.execute(stmt)
    agent = result.scalar_one_or_none()
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent profile not found"
        )
        
    if payload.is_active is not None:
        agent.is_active = payload.is_active
    if payload.weight is not None:
        # Validate constraint (0-10)
        if payload.weight < 0 or payload.weight > 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Weight must be between 0 and 10."
            )
        agent.weight = payload.weight
    if payload.timezone is not None:
        agent.timezone = payload.timezone
    if payload.shift_start is not None:
        agent.shift_start = payload.shift_start
    if payload.shift_end is not None:
        agent.shift_end = payload.shift_end
    if payload.max_concurrent_leads is not None:
        if payload.max_concurrent_leads <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Max concurrent leads must be greater than 0."
            )
        agent.max_concurrent_leads = payload.max_concurrent_leads
        
    agent.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(agent)
    return agent
