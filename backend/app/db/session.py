import os
import socket
from urllib.parse import urlparse
from typing import AsyncGenerator
from sqlalchemy import event
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql+asyncpg://postgres:postgres@localhost:5432/leadflow"
    )

    class Config:
        env_file = ".env"

settings = Settings()

def check_postgres_reachable(url: str) -> bool:
    try:
        # Strip driver for urlparse if necessary
        clean_url = url
        if "://" in url:
            scheme, rest = url.split("://", 1)
            clean_url = f"http://{rest}"
        parsed = urlparse(clean_url)
        host = parsed.hostname or "localhost"
        port = parsed.port or 5432
        
        # Fast socket test connection
        with socket.create_connection((host, port), timeout=0.8):
            return True
    except Exception:
        return False

# Detect if we should use PostgreSQL or fallback to SQLite
postgres_reachable = check_postgres_reachable(settings.DATABASE_URL)

if postgres_reachable:
    print("[DB] PostgreSQL is reachable. Using postgres+asyncpg engine.")
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
        pool_size=20,
        max_overflow=10,
    )
else:
    print("[DB] PostgreSQL is unreachable. Falling back to local SQLite database.")
    # Store sqlite in the backend directory
    db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "leadflow.db")
    db_path = db_path.replace("\\", "/")
    sqlite_url = f"sqlite+aiosqlite:///{db_path}"
    engine = create_async_engine(
        sqlite_url,
        echo=False,
    )

    # Enable foreign key enforcement for SQLite
    @event.listens_for(engine.sync_engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency provider yielding async db sessions."""
    async with SessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

