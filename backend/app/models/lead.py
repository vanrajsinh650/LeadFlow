import uuid
from datetime import datetime
from sqlalchemy import ForeignKey, String, Boolean, Integer, DateTime, CheckConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.db.base import Base

class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4
    )
    first_name: Mapped[str] = mapped_column(
        String(100), 
        nullable=False
    )
    last_name: Mapped[str] = mapped_column(
        String(100), 
        nullable=False
    )
    email: Mapped[str] = mapped_column(
        String(255), 
        nullable=False
    )
    phone: Mapped[str] = mapped_column(
        String(50), 
        nullable=False
    )
    source: Mapped[str] = mapped_column(
        String(100), 
        nullable=False
    )
    priority: Mapped[str] = mapped_column(
        String(50), 
        default="MEDIUM", 
        nullable=False
    ) # HIGH, MEDIUM, LOW
    status: Mapped[str] = mapped_column(
        String(50), 
        default="UNASSIGNED", 
        nullable=False
    ) # UNASSIGNED, ASSIGNED, CONTACTED, IN_PROGRESS, CLOSED_WON, CLOSED_LOST, ESCALATED

    assigned_agent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("agents.id", ondelete="SET NULL"),
        nullable=True
    )
    sla_expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        nullable=True
    )
    sla_violated: Mapped[bool] = mapped_column(
        Boolean, 
        default=False, 
        nullable=False
    )
    is_duplicate: Mapped[bool] = mapped_column(
        Boolean, 
        default=False, 
        nullable=False
    )
    original_lead_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("leads.id", ondelete="SET NULL"),
        nullable=True
    )
    reassignment_count: Mapped[int] = mapped_column(
        Integer, 
        default=0, 
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
        CheckConstraint(
            "reassignment_count >= 0 AND reassignment_count <= 3", 
            name="chk_lead_reassignment_bound"
        ),
        CheckConstraint(
            "original_lead_id IS NULL OR is_duplicate = TRUE", 
            name="chk_lead_duplicate_safety"
        ),
        # Indexes mapped explicitly inside table args
        Index("idx_leads_email_phone", "email", "phone"),
        Index("idx_leads_status_assigned_agent", "status", "assigned_agent_id"),
        Index("idx_leads_sla_expired", "sla_expires_at"),
    )

    # Relationships
    agent = relationship("Agent", back_populates="leads")
    audit_logs = relationship("LeadAuditLog", back_populates="lead", cascade="all, delete-orphan")
