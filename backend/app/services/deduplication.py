import re
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from sqlalchemy import select, or_, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.models.lead import Lead
from backend.app.models.agent import Agent

class DeduplicationService:
    @staticmethod
    def normalize_phone(phone: str) -> str:
        """
        Normalizes a phone number to only digits.
        """
        return re.sub(r"\D", "", phone)

    @staticmethod
    async def check_and_get_duplicate(
        db: AsyncSession, 
        email: str, 
        phone: str, 
        lookback_days: int = 30
    ) -> Tuple[bool, Optional[Lead], Optional[Agent]]:
        """
        Scans recently ingested leads for duplicate contact parameters.
        
        Returns:
            Tuple of:
            - is_duplicate: bool
            - original_lead: Optional[Lead]
            - target_agent_owner: Optional[Agent] (only if active and eligible)
        """
        normalized_new_phone = DeduplicationService.normalize_phone(phone)
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=lookback_days)

        # Query for matching email or phone
        stmt = (
            select(Lead)
            .where(
                Lead.created_at >= cutoff_date,
                or_(
                    func.lower(Lead.email) == email.lower(),
                    Lead.phone == normalized_new_phone
                )
            )
            .order_by(Lead.created_at.desc())
            .limit(1)
        )
        result = await db.execute(stmt)
        original_lead = result.scalar_one_or_none()

        if not original_lead:
            return False, None, None

        # Check if the original lead has an assigned agent
        if not original_lead.assigned_agent_id:
            return True, original_lead, None

        # Fetch original agent details to verify status
        stmt_agent = select(Agent).where(Agent.id == original_lead.assigned_agent_id)
        result_agent = await db.execute(stmt_agent)
        original_agent = result_agent.scalar_one_or_none()

        # Duplicate mapping owner bypass requirements:
        # 1. Agent must exist
        # 2. Agent must be active
        # 3. Original lead must not be Closed-Lost (or Closed-Won depending on pipeline settings, let's follow 02-business-rules.md: "Closed-Lost")
        if original_agent and original_agent.is_active and original_lead.status != "CLOSED_LOST":
            return True, original_lead, original_agent

        return True, original_lead, None
