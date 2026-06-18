import asyncio
import os
import random
from datetime import datetime, time, timedelta, timezone
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

# Import models
from backend.app.db.base import Base
from backend.app.models.user import User
from backend.app.models.agent import Agent
from backend.app.models.lead import Lead
from backend.app.models.audit import LeadAuditLog

DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql+asyncpg://postgres:postgres@localhost:5432/leadflow"
)

engine = create_async_engine(DATABASE_URL, echo=True)
SessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

async def seed():
    async with SessionLocal() as db:
        print("Starting Database Seeding...")

        # 1. Clear existing data
        print("Clearing existing tables...")
        await db.execute(Base.metadata.drop_all) # Will drop tables if needed, or we can drop sequentially
        # Better: run metadata drop/create to start completely fresh
        # Wait, since metadata drop_all is sync, we run run_sync on the connection
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)

        print("Tables cleared and recreated.")

        # 2. Seed 10 Agents (and their User accounts)
        print("Seeding 10 Agents...")
        agent_roles = ["AGENT"] * 8 + ["MANAGER", "ADMIN"]
        first_names = ["Jane", "Bob", "Alice", "Charlie", "David", "Eve", "Frank", "Grace", "Heidi", "Ivan"]
        last_names = ["Smith", "Jones", "Miller", "Davis", "Garcia", "Rodriguez", "Wilson", "Martinez", "Anderson", "Thomas"]
        timezones = ["America/New_York", "UTC", "Europe/London", "Asia/Kolkata"]

        agents_list = []
        for i in range(10):
            email = f"user{i+1}@leadflow.com"
            user = User(
                email=email,
                hashed_password="pbkdf2:sha256:260000$mockhashedpassword",
                full_name=f"{first_names[i]} {last_names[i]}",
                role="AGENT" if i < 8 else ("MANAGER" if i == 8 else "ADMIN")
            )
            db.add(user)
            await db.flush()  # Generate user.id

            if user.role == "AGENT":
                agent = Agent(
                    id=user.id,
                    is_active=True if i < 6 else False, # 6 active, 2 inactive
                    weight=random.randint(2, 8),
                    timezone=random.choice(timezones),
                    shift_start=time(9, 0),
                    shift_end=time(17, 0),
                    max_concurrent_leads=random.randint(8, 15)
                )
                db.add(agent)
                agents_list.append(agent)

        await db.flush()
        print(f"Seeded {len(agents_list)} active/inactive agent profiles.")

        # 3. Seed 100 Leads
        print("Seeding 100 Leads...")
        sources = ["web_form", "google_ads", "referral", "meta_campaign", "api_ingest"]
        priorities = ["HIGH", "MEDIUM", "LOW"]
        statuses = ["UNASSIGNED", "ASSIGNED", "CONTACTED", "IN_PROGRESS", "CLOSED_WON", "CLOSED_LOST", "ESCALATED"]
        
        lead_first_names = ["James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Elizabeth", "William", "Linda"]
        lead_last_names = ["Johnson", "Brown", "Taylor", "Thomas", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson"]

        active_agents = [a for a in agents_list if a.is_active]

        for i in range(100):
            first_name = random.choice(lead_first_names)
            last_name = random.choice(lead_last_names)
            email = f"lead_{i+1}@external.com"
            phone = f"555{random.randint(100000, 999999)}"
            source = random.choice(sources)
            priority = random.choice(priorities)
            
            # Distribute statuses realistically
            status_weights = [10, 40, 20, 15, 10, 3, 2] # index matches statuses list
            status = random.choices(statuses, weights=status_weights, k=1)[0]
            
            assigned_agent_id = None
            sla_expires_at = None
            sla_violated = False
            reassignment_count = 0
            is_duplicate = random.choice([True, False]) if i % 10 == 0 else False

            if status in ["ASSIGNED", "CONTACTED", "IN_PROGRESS"]:
                if active_agents:
                    assigned_agent_id = random.choice(active_agents).id
                    # 15 minutes for High, 60 min for Medium, 24 hrs for Low
                    duration = timedelta(minutes=15) if priority == "HIGH" else (timedelta(minutes=60) if priority == "MEDIUM" else timedelta(hours=24))
                    
                    # Randomize some to be expired for demo purposes
                    if random.random() < 0.15:
                        sla_expires_at = datetime.now(timezone.utc) - timedelta(minutes=5)
                        sla_violated = True
                        reassignment_count = random.randint(1, 2)
                    else:
                        sla_expires_at = datetime.now(timezone.utc) + duration

            elif status == "ESCALATED":
                sla_violated = True
                reassignment_count = 3

            lead = Lead(
                first_name=first_name,
                last_name=last_name,
                email=email,
                phone=phone,
                source=source,
                priority=priority,
                status=status,
                assigned_agent_id=assigned_agent_id,
                sla_expires_at=sla_expires_at,
                sla_violated=sla_violated,
                reassignment_count=reassignment_count,
                is_duplicate=is_duplicate,
                created_at=datetime.now(timezone.utc) - timedelta(days=random.randint(0, 15))
            )
            db.add(lead)
            await db.flush()

            # Create Ingestion Audit Log
            audit_ingest = LeadAuditLog(
                lead_id=lead.id,
                action="INGEST_DUPLICATE" if is_duplicate else "INGEST",
                new_status="UNASSIGNED",
                notes="Lead ingested into system.",
                created_at=lead.created_at
            )
            db.add(audit_ingest)

            # Create Assignment Audit Log
            if assigned_agent_id:
                audit_assign = LeadAuditLog(
                    lead_id=lead.id,
                    action="ASSIGN",
                    old_status="UNASSIGNED",
                    new_status="ASSIGNED",
                    new_agent_id=assigned_agent_id,
                    notes="Automated round robin assignment.",
                    created_at=lead.created_at + timedelta(seconds=2)
                )
                db.add(audit_assign)

            # Create Reassignment/Escalation logs
            if status == "ESCALATED":
                audit_escalate = LeadAuditLog(
                    lead_id=lead.id,
                    action="ESCALATE",
                    old_status="ASSIGNED",
                    new_status="ESCALATED",
                    notes="SLA threshold breached 3 times. Hard escalation triggered.",
                    created_at=lead.created_at + timedelta(hours=2)
                )
                db.add(audit_escalate)

        await db.commit()
        print("Successfully seeded database with 10 agents and 100 leads.")

if __name__ == "__main__":
    asyncio.run(seed())
