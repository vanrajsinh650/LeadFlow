import uuid
from datetime import datetime, time
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field

class LeadCreate(BaseModel):
    first_name: str = Field(..., max_length=100)
    last_name: str = Field(..., max_length=100)
    email: EmailStr
    phone: str = Field(..., max_length=50)
    source: str = Field(..., max_length=100)
    priority: str = Field("MEDIUM", max_length=50) # HIGH, MEDIUM, LOW

class LeadResponse(BaseModel):
    lead_id: uuid.UUID = Field(..., validation_alias="id", serialization_alias="lead_id")
    first_name: str
    last_name: str
    email: str
    phone: str
    source: str
    priority: str
    status: str
    assigned_agent_id: Optional[uuid.UUID] = None
    sla_expires_at: Optional[datetime] = None
    is_duplicate: bool
    original_lead_id: Optional[uuid.UUID] = None
    reassignment_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        populate_by_name = True

class LeadUpdateStatus(BaseModel):
    status: str = Field(..., max_length=50)
    notes: Optional[str] = None

class LeadStatusResponse(BaseModel):
    lead_id: uuid.UUID = Field(..., validation_alias="id", serialization_alias="lead_id")
    status: str
    sla_expires_at: Optional[datetime] = None
    sla_violated: bool
    updated_at: datetime

    class Config:
        from_attributes = True
        populate_by_name = True

class LeadReassign(BaseModel):
    target_agent_id: uuid.UUID
    reason: Optional[str] = None

class LeadReassignResponse(BaseModel):
    lead_id: uuid.UUID = Field(..., validation_alias="id", serialization_alias="lead_id")
    status: str
    assigned_agent_id: Optional[uuid.UUID] = None
    reassignment_count: int
    updated_at: datetime

    class Config:
        from_attributes = True
        populate_by_name = True

class AuditLogResponse(BaseModel):
    id: uuid.UUID
    action: str
    old_status: Optional[str] = None
    new_status: str
    old_agent_id: Optional[uuid.UUID] = None
    new_agent_id: Optional[uuid.UUID] = None
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class LeadDetailResponse(BaseModel):
    lead_id: uuid.UUID = Field(..., validation_alias="id", serialization_alias="lead_id")
    first_name: str
    last_name: str
    email: str
    phone: str
    source: str
    priority: str
    status: str
    assigned_agent_id: Optional[uuid.UUID] = None
    assigned_agent_name: Optional[str] = None
    sla_expires_at: Optional[datetime] = None
    sla_violated: bool
    is_duplicate: bool
    original_lead_id: Optional[uuid.UUID] = None
    reassignment_count: int
    created_at: datetime
    updated_at: datetime
    audit_logs: List[AuditLogResponse] = []

    class Config:
        from_attributes = True
        populate_by_name = True

class AgentResponse(BaseModel):
    agent_id: uuid.UUID = Field(..., validation_alias="id", serialization_alias="agent_id")
    full_name: str
    email: str
    role: str
    is_active: bool
    weight: int
    timezone: str
    shift_start: time
    shift_end: time
    max_concurrent_leads: int
    current_load: int

    class Config:
        from_attributes = True
        populate_by_name = True

class AgentUpdateConfig(BaseModel):
    is_active: Optional[bool] = None
    weight: Optional[int] = None
    timezone: Optional[str] = None
    shift_start: Optional[time] = None
    shift_end: Optional[time] = None
    max_concurrent_leads: Optional[int] = None

class AgentConfigResponse(BaseModel):
    agent_id: uuid.UUID = Field(..., validation_alias="id", serialization_alias="agent_id")
    is_active: bool
    weight: int
    timezone: str
    shift_start: time
    shift_end: time
    max_concurrent_leads: int
    updated_at: datetime

    class Config:
        from_attributes = True
        populate_by_name = True

class AgentLoadInfo(BaseModel):
    agent_name: str
    weight: int
    current_load: int
    max_load: int

class RecentActivityLog(BaseModel):
    id: str
    lead_name: str
    action: str
    agent: str
    time: str
    status: str # success, warning, danger, neutral

class DashboardStatsResponse(BaseModel):
    total_leads: int
    active_agents: int
    total_agents: int
    sla_violations: int
    conversion_rate: float
    agent_loads: List[AgentLoadInfo]
    recent_logs: List[RecentActivityLog]
