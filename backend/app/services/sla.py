import logging
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.models.lead import Lead
from backend.app.models.agent import Agent
from backend.app.models.audit import LeadAuditLog
from backend.app.services.assignment_service import AssignmentService
from backend.app.api.v1.leads import get_sla_duration

logger = logging.getLogger(__name__)

class SLAService:
    @staticmethod
    async def check_and_process_sla_breaches(db: AsyncSession):
        """
        Scans for assigned leads that have crossed their SLA deadline,
        handles cooldown penalties for agents, and triggers reassignments or escalations.
        """
        now = datetime.now(timezone.utc)
        
        # Query for leads in ASSIGNED state that have expired SLA timers
        stmt = select(Lead).where(
            Lead.status == "ASSIGNED",
            Lead.sla_expires_at <= now
        )
        result = await db.execute(stmt)
        breached_leads = result.scalars().all()

        if not breached_leads:
            return

        logger.warning(f"Found {len(breached_leads)} leads with SLA violations.")

        for lead in breached_leads:
            old_agent_id = lead.assigned_agent_id
            lead.sla_violated = True
            lead.reassignment_count += 1

            # 1. Apply Cooldown Penalty to current agent
            if old_agent_id:
                stmt_agent = select(Agent).where(Agent.id == old_agent_id)
                result_agent = await db.execute(stmt_agent)
                agent = result_agent.scalar_one_or_none()
                if agent:
                    agent.is_active = False
                    logger.warning(f"Agent {agent.id} set Inactive due to SLA breach on Lead {lead.id}")
                    db.add(agent)

            # 2. Reassignment or Escalation choice
            if lead.reassignment_count <= 3:
                # Revoke assignment
                lead.assigned_agent_id = None
                
                # Attempt WRR Reassignment
                new_agent = await AssignmentService.assign_lead(db, lead)
                if new_agent:
                    lead.assigned_agent_id = new_agent.id
                    lead.status = "ASSIGNED"
                    lead.sla_expires_at = datetime.now(timezone.utc) + get_sla_duration(lead.priority)
                    
                    # Log reassignment event
                    audit_log = LeadAuditLog(
                        lead_id=lead.id,
                        action="REASSIGN",
                        old_status="ASSIGNED",
                        new_status="ASSIGNED",
                        old_agent_id=old_agent_id,
                        new_agent_id=new_agent.id,
                        notes=f"SLA breach reassignment {lead.reassignment_count}/3."
                    )
                else:
                    lead.status = "UNASSIGNED"
                    lead.sla_expires_at = None
                    audit_log = LeadAuditLog(
                        lead_id=lead.id,
                        action="REASSIGN_FAILED",
                        old_status="ASSIGNED",
                        new_status="UNASSIGNED",
                        old_agent_id=old_agent_id,
                        new_agent_id=None,
                        notes="SLA breach reassignment failed due to no active agents."
                    )
            else:
                # Exceeded 3 reassignments -> hard escalation to managers
                lead.status = "ESCALATED"
                lead.assigned_agent_id = None
                lead.sla_expires_at = None
                
                logger.error(f"Lead {lead.id} reached hard escalation threshold.")
                audit_log = LeadAuditLog(
                    lead_id=lead.id,
                    action="ESCALATE",
                    old_status="ASSIGNED",
                    new_status="ESCALATED",
                    old_agent_id=old_agent_id,
                    new_agent_id=None,
                    notes="SLA breach limit exceeded. Hard escalation to manager."
                )

            db.add(lead)
            db.add(audit_log)

        await db.commit()
        logger.info("SLA breach batch processing completed.")
