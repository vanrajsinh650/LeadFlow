from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    """Base class for all SQLAlchemy database models."""
    pass

# Import models here so Alembic or schema creation tools detect them
from backend.app.models.user import User
from backend.app.models.agent import Agent
from backend.app.models.lead import Lead
from backend.app.models.audit import LeadAuditLog

