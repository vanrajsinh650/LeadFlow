import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field

class LeadCreate(BaseModel):
    first_name: str = Field(..., max_length=100)
    last_name: str = Field(..., max_length=100)
    email: EmailStr
    phone: str = Field(..., max_length=50)
    source: str = Field(..., max_length=100)
    priority: str = Field("MEDIUM", max_length=50) # HIGH, MEDIUM, LOW

class LeadResponse(BaseModel):
    lead_id: uuid.UUID
    status: str
    assigned_agent_id: Optional[uuid.UUID] = None
    sla_expires_at: Optional[datetime] = None
    is_duplicate: bool
    original_lead_id: Optional[uuid.UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True
