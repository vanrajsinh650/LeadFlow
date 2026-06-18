import os
import logging
from datetime import datetime
from zoneinfo import ZoneInfo
from typing import List, Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
import redis

from backend.app.models.agent import Agent
from backend.app.models.lead import Lead
from backend.app.services.weighted_round_robin import WeightedRoundRobinRouter

logger = logging.getLogger(__name__)

# Configure Redis connection
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.from_url(REDIS_URL, decode_responses=True)

class AssignmentService:
    @staticmethod
    def is_agent_in_shift(agent: Agent, ref_time_utc: datetime) -> bool:
        """
        Check if the reference time falls within the agent's local shift hours.
        """
        try:
            tz = ZoneInfo(agent.timezone)
        except Exception:
            tz = ZoneInfo("UTC")

        # Convert UTC reference time to Agent's local time
        local_datetime = ref_time_utc.astimezone(tz)
        local_time = local_datetime.time()

        start = agent.shift_start
        end = agent.shift_end

        if start <= end:
            return start <= local_time <= end
        else:
            # Overnight shift
            return local_time >= start or local_time <= end

    @staticmethod
    async def get_eligible_agents(db: AsyncSession, ref_time_utc: datetime) -> List[Agent]:
        """
        Retrieves all active agents, filters by shift hours, and checks concurrency load limits.
        """
        # 1. Fetch active agents with weight > 0
        stmt = select(Agent).where(Agent.is_active == True, Agent.weight > 0)
        result = await db.execute(stmt)
        active_agents = result.scalars().all()

        eligible_agents = []

        for agent in active_agents:
            # 2. Verify shift hours in agent's timezone
            if not AssignmentService.is_agent_in_shift(agent, ref_time_utc):
                continue

            # 3. Verify concurrency limit
            # Active lead statuses: ASSIGNED, CONTACTED, IN_PROGRESS
            stmt_load = select(func.count()).select_from(Lead).where(
                Lead.assigned_agent_id == agent.id,
                Lead.status.in_(["ASSIGNED", "CONTACTED", "IN_PROGRESS"])
            )
            load_result = await db.execute(stmt_load)
            current_load = load_result.scalar() or 0

            if current_load < agent.max_concurrent_leads:
                eligible_agents.append(agent)

        return eligible_agents

    @staticmethod
    async def assign_lead(db: AsyncSession, lead: Lead) -> Optional[Agent]:
        """
        Finds and selects the next eligible agent via stateful Weighted Round Robin,
        and saves state to Redis.
        """
        ref_time = datetime.now(ZoneInfo("UTC"))
        eligible_agents = await AssignmentService.get_eligible_agents(db, ref_time)

        if not eligible_agents:
            logger.warning("No eligible agents found for lead routing.")
            return None

        # Retrieve WRR pointers from Redis with fallback to local defaults
        try:
            last_index = int(redis_client.get("wrr:index") or 0)
            current_credit = int(redis_client.get("wrr:credit") or 0)
        except Exception as e:
            logger.error(f"Redis connection error while reading WRR state: {e}")
            last_index = 0
            current_credit = 0

        selected_agent, next_index, next_credit = WeightedRoundRobinRouter.select_agent(
            eligible_agents=eligible_agents,
            last_index=last_index,
            current_weight_credit=current_credit
        )

        if selected_agent:
            # Update pointers in Redis
            try:
                redis_client.set("wrr:index", next_index)
                redis_client.set("wrr:credit", next_credit)
            except Exception as e:
                logger.error(f"Redis connection error while saving WRR state: {e}")

        return selected_agent
