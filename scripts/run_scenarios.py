import asyncio
import os
import sys
import time
import subprocess
import httpx
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

# Add backend to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.db.base import Base
from backend.app.db.session import SessionLocal, engine
from backend.app.models.user import User
from backend.app.models.agent import Agent
from backend.app.models.lead import Lead
from backend.app.models.audit import LeadAuditLog
from backend.app.services.sla import SLAService

API_BASE_URL = "http://localhost:8000/api/v1"

async def setup_database(db: AsyncSession):
    print("\n--- DATABASE SETUP ---")
    # Clean tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    print("Database tables initialized cleanly.")

    # Create 2 Agents (and User accounts)
    # Agent A (weight 5), Agent B (weight 5)
    agent_data = [
        {"email": "agentA@leadflow.com", "name": "Agent A", "weight": 5},
        {"email": "agentB@leadflow.com", "name": "Agent B", "weight": 5}
    ]
    agents = []
    for data in agent_data:
        user = User(
            email=data["email"],
            hashed_password="mockpassword",
            full_name=data["name"],
            role="AGENT"
        )
        db.add(user)
        await db.flush()

        agent = Agent(
            id=user.id,
            is_active=True,
            weight=data["weight"],
            timezone="UTC",
            shift_start=datetime.strptime("00:00:00", "%H:%M:%S").time(),
            shift_end=datetime.strptime("23:59:59", "%H:%M:%S").time(),
            max_concurrent_leads=10
        )
        db.add(agent)
        agents.append(agent)
    
    await db.commit()
    print("Seeded 2 active agents (Agent A & Agent B).")
    return agents

async def run_scenario_1(client: httpx.AsyncClient):
    print("\n--- SCENARIO 1: New Lead Arrives (Weighted Round Robin Routing) ---")
    payload = {
        "first_name": "Alice",
        "last_name": "Doe",
        "email": "alice.doe@example.com",
        "phone": "+15550199",
        "source": "web_contact_form",
        "priority": "HIGH"
    }
    
    res = await client.post(f"{API_BASE_URL}/leads", json=payload)
    assert res.status_code == 201, f"Failed ingestion: {res.text}"
    data = res.json()
    
    print("Ingestion Success!")
    print(f"Lead ID: {data['lead_id']}")
    print(f"Status: {data['status']}")
    print(f"Assigned Agent ID: {data['assigned_agent_id']}")
    print(f"SLA Expires At: {data['sla_expires_at']}")
    print(f"Is Duplicate: {data['is_duplicate']}")
    
    assert data["status"] == "ASSIGNED"
    assert data["assigned_agent_id"] is not None
    assert data["is_duplicate"] is False
    
    # Verify audit logs in database
    async with SessionLocal() as db:
        stmt = select(LeadAuditLog).where(LeadAuditLog.lead_id == data["lead_id"])
        res_logs = await db.execute(stmt)
        logs = res_logs.scalars().all()
        actions = [log.action for log in logs]
        print(f"Audit logs generated: {actions}")
        assert "INGEST" in actions
    
    return data["lead_id"], data["assigned_agent_id"]

async def run_scenario_2(client: httpx.AsyncClient, first_agent_id: str):
    print("\n--- SCENARIO 2: Duplicate Lead Arrives (Route to Owner Bypass) ---")
    # Send duplicate payload
    payload = {
        "first_name": "Alice",
        "last_name": "Doe",
        "email": "alice.doe@example.com",
        "phone": "+15550199",
        "source": "google_ads",
        "priority": "HIGH"
    }
    
    res = await client.post(f"{API_BASE_URL}/leads", json=payload)
    assert res.status_code == 201, f"Failed duplicate ingestion: {res.text}"
    data = res.json()
    
    print("Ingestion Success!")
    print(f"Lead ID: {data['lead_id']}")
    print(f"Status: {data['status']}")
    print(f"Assigned Agent ID: {data['assigned_agent_id']}")
    print(f"Is Duplicate: {data['is_duplicate']}")
    print(f"Original Lead ID: {data['original_lead_id']}")
    
    assert data["status"] == "ASSIGNED"
    assert data["is_duplicate"] is True
    # Bypass round robin -> direct route to original owner Agent A
    assert data["assigned_agent_id"] == first_agent_id
    
    async with SessionLocal() as db:
        stmt = select(LeadAuditLog).where(LeadAuditLog.lead_id == data["lead_id"])
        res_logs = await db.execute(stmt)
        logs = res_logs.scalars().all()
        actions = [log.action for log in logs]
        print(f"Audit logs generated: {actions}")
        assert "INGEST_DUPLICATE" in actions

async def run_scenario_3(first_lead_id: str, first_agent_id: str):
    print("\n--- SCENARIO 3: SLA Violation & Agent Cooldown Penalty ---")
    
    async with SessionLocal() as db:
        # Precondition: Force Lead 1 SLA timer into the past
        past_time = datetime.now(timezone.utc) - timedelta(minutes=5)
        await db.execute(
            update(Lead)
            .where(Lead.id == first_lead_id)
            .values(sla_expires_at=past_time)
        )
        await db.commit()
        print(f"Precondition: Set Lead {first_lead_id} SLA expiration into the past ({past_time.strftime('%H:%M:%S')}).")
        
        # Trigger SLA processing
        print("Executing SLA breach worker batch job...")
        await SLAService.check_and_process_sla_breaches(db)
        
        # Reload Lead 1 details
        stmt = select(Lead).where(Lead.id == first_lead_id)
        res = await db.execute(stmt)
        lead = res.scalar_one()
        
        print("Post SLA processing verification:")
        print(f"Lead Status: {lead.status}")
        print(f"New Assigned Agent ID: {lead.assigned_agent_id}")
        print(f"SLA Violated Status: {lead.sla_violated}")
        print(f"Reassignment Counter: {lead.reassignment_count} / 3")
        
        # Check cooldown penalty on Agent A
        stmt_agent = select(Agent).where(Agent.id == first_agent_id)
        res_agent = await db.execute(stmt_agent)
        agent = res_agent.scalar_one()
        print(f"Agent A active status: {agent.is_active}")
        
        assert lead.sla_violated is True
        assert lead.reassignment_count == 1
        assert agent.is_active is False  # Set to inactive as penalty
        assert lead.assigned_agent_id != first_agent_id  # Reassigned to Agent B

async def run_scenario_4(first_lead_id: str):
    print("\n--- SCENARIO 4: Hard Escalation Flow (Limit Reached) ---")
    
    async with SessionLocal() as db:
        # Precondition: Set reassignment count to 3 on Lead 1
        past_time = datetime.now(timezone.utc) - timedelta(minutes=5)
        await db.execute(
            update(Lead)
            .where(Lead.id == first_lead_id)
            .values(reassignment_count=3, sla_expires_at=past_time)
        )
        await db.commit()
        print("Precondition: Set reassignment count to 3 and SLA expired on Lead.")
        
        # Run SLA breach processing
        print("Executing SLA breach worker batch job...")
        await SLAService.check_and_process_sla_breaches(db)
        
        # Reload Lead 1 details
        stmt = select(Lead).where(Lead.id == first_lead_id)
        res = await db.execute(stmt)
        lead = res.scalar_one()
        
        print("Post Escalation processing verification:")
        print(f"Lead Status: {lead.status}")
        print(f"Assigned Agent: {lead.assigned_agent_id}")
        
        # SLA breached 3 times -> status must be ESCALATED and unassigned
        assert lead.status == "ESCALATED"
        assert lead.assigned_agent_id is None
        
        # Verify Audit Log Escalation
        stmt_log = select(LeadAuditLog).where(LeadAuditLog.lead_id == first_lead_id).order_by(LeadAuditLog.created_at.desc())
        res_log = await db.execute(stmt_log)
        last_log = res_log.scalars().first()
        print(f"Last Log Action: {last_log.action}")
        print(f"Last Log Notes: {last_log.notes}")
        assert last_log.action == "ESCALATE"

async def main():
    # 1. Setup Database
    async with SessionLocal() as db:
        await setup_database(db)

    # 2. Launch FastAPI Server locally using subprocess with PYTHONPATH
    print("\nStarting local API server subprocess...")
    env = os.environ.copy()
    workspace_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env["PYTHONPATH"] = workspace_root

    log_file = open("uvicorn_test.log", "w")
    server = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "backend.app.main:app", "--port", "8000"],
        stdout=log_file,
        stderr=log_file,
        env=env
    )
    
    # Wait for API server boot
    time.sleep(5.0)
    
    # 3. Execute scenario actions
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            # Scenario 1: New Ingestion
            first_lead_id, first_agent_id = await run_scenario_1(client)
            
            # Scenario 2: Duplicate Ingestion
            await run_scenario_2(client, first_agent_id)
            
            # Scenario 3: SLA Violation & Cooldown (calls backend service directly)
            await run_scenario_3(first_lead_id, first_agent_id)
            
            # Scenario 4: Hard Escalation (calls backend service directly)
            await run_scenario_4(first_lead_id)
            
            print("\n==============================")
            print("ALL MOCK DEMO SCENARIOS PASSED")
            print("==============================\n")
            
    except Exception as exc:
        print(f"Exception during scenario runs: {exc}")
        # Flush and read log file to output startup details
        log_file.flush()
        with open("uvicorn_test.log", "r") as f:
            print("\n--- UVICORN SUBPROCESS LOGS ---")
            print(f.read())
            print("--------------------------------\n")
        raise exc
    finally:
        # Terminate API server subprocess
        print("Stopping local API server subprocess...")
        server.terminate()
        server.wait()
        log_file.close()

if __name__ == "__main__":
    asyncio.run(main())
