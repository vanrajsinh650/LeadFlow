import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.db.session import SessionLocal
from backend.app.services.sla import SLAService
from backend.app.api.v1.leads import router as leads_router
from backend.app.api.v1.agents import router as agents_router
from backend.app.api.v1.dashboard import router as dashboard_router

async def run_sla_monitor():
    """Background loop checking and processing SLA breaches periodically."""
    print("[SLA Worker] Starting background SLA monitor task...")
    while True:
        await asyncio.sleep(10)
        try:
            async with SessionLocal() as db:
                await SLAService.check_and_process_sla_breaches(db)
        except Exception as e:
            print(f"[SLA Worker Error] Failed processing SLA breaches: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Start SLA monitoring background task
    sla_task = asyncio.create_task(run_sla_monitor())
    yield
    # Shutdown: Cancel background task
    sla_task.cancel()
    try:
        await sla_task
    except asyncio.CancelledError:
        pass

app = FastAPI(
    title="LeadFlow API Gateway",
    description="Sales Operations & Lead Assignment Engine REST API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration supporting Local Next.js Dashboard Client
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(leads_router, prefix="/api/v1")
app.include_router(agents_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")

@app.get("/")
async def root():
    return {"status": "healthy", "service": "leadflow-api"}
