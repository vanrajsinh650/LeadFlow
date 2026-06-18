import uuid
from datetime import datetime, time
from sqlalchemy import ForeignKey, Boolean, Integer, String, Time, DateTime, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.db.base import Base

class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, 
        default=False, 
        nullable=False
    )
    weight: Mapped[int] = mapped_column(
        Integer, 
        default=1, 
        nullable=False
    )
    timezone: Mapped[str] = mapped_column(
        String(100), 
        default="UTC", 
        nullable=False
    )
    shift_start: Mapped[time] = mapped_column(
        Time, 
        nullable=False
    )
    shift_end: Mapped[time] = mapped_column(
        Time, 
        nullable=False
    )
    max_concurrent_leads: Mapped[int] = mapped_column(
        Integer, 
        default=10, 
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=datetime.utcnow, 
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=datetime.utcnow, 
        onupdate=datetime.utcnow, 
        nullable=False
    )

    # Database Check Constraints
    __table_args__ = (
        CheckConstraint("weight >= 0 AND weight <= 10", name="chk_agent_weight_range"),
        CheckConstraint("max_concurrent_leads > 0", name="chk_agent_concurrency_ceiling"),
    )

    # Relationships
    user = relationship("User", back_populates="agent_profile")
    leads = relationship("Lead", back_populates="agent")
