import uuid
from datetime import datetime
from sqlalchemy import ForeignKey, String, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.db.base import Base

class LeadAuditLog(Base):
    __tablename__ = "lead_audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4
    )
    lead_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("leads.id", ondelete="CASCADE"),
        nullable=False
    )
    action: Mapped[str] = mapped_column(
        String(100), 
        nullable=False
    ) # INGEST, ASSIGN, REASSIGN, SLA_BREACH, STATUS_CHANGE
    old_status: Mapped[str] = mapped_column(
        String(50), 
        nullable=True
    )
    new_status: Mapped[str] = mapped_column(
        String(50), 
        nullable=False
    )
    old_agent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=True
    )
    new_agent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=True
    )
    performed_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    notes: Mapped[str] = mapped_column(
        Text, 
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=datetime.utcnow, 
        nullable=False
    )

    # Relationships
    lead = relationship("Lead", back_populates="audit_logs")
    actor = relationship("User")
