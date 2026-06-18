import pytest
from datetime import time
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import IntegrityError
from backend.app.db.base import Base
from backend.app.models.user import User
from backend.app.models.agent import Agent
from backend.app.models.lead import Lead

# Use in-memory SQLite for testing check constraints
@pytest.fixture(scope="function")
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()

def test_user_creation(db_session):
    user = User(
        email="test@example.com",
        hashed_password="hashedpassword123",
        full_name="Test User",
        role="AGENT"
    )
    db_session.add(user)
    db_session.commit()

    saved_user = db_session.query(User).filter_by(email="test@example.com").first()
    assert saved_user is not None
    assert saved_user.full_name == "Test User"

def test_agent_weight_constraint(db_session):
    user = User(
        email="agent@example.com",
        hashed_password="hashedpassword123",
        full_name="Agent User",
        role="AGENT"
    )
    db_session.add(user)
    db_session.commit()

    # Weight is out of bounds (11)
    agent = Agent(
        id=user.id,
        is_active=True,
        weight=11,
        timezone="UTC",
        shift_start=time(9, 0),
        shift_end=time(17, 0),
        max_concurrent_leads=10
    )
    db_session.add(agent)

    # SQLite enforces check constraints. This should raise IntegrityError
    with pytest.raises(IntegrityError):
        db_session.commit()

def test_lead_reassignment_constraint(db_session):
    # Reassignment count is out of bounds (4)
    lead = Lead(
        first_name="John",
        last_name="Doe",
        email="john@example.com",
        phone="5550199",
        source="web",
        reassignment_count=4
    )
    db_session.add(lead)

    with pytest.raises(IntegrityError):
        db_session.commit()

def test_lead_duplicate_safety_constraint(db_session):
    # original_lead_id exists, but is_duplicate is False
    lead1 = Lead(
        first_name="Original",
        last_name="Lead",
        email="orig@example.com",
        phone="5550100",
        source="web"
    )
    db_session.add(lead1)
    db_session.commit()

    lead2 = Lead(
        first_name="Duplicate",
        last_name="Lead",
        email="orig@example.com",
        phone="5550100",
        source="web",
        is_duplicate=False,  # Invalid state: is_duplicate must be True if original_lead_id is set
        original_lead_id=lead1.id
    )
    db_session.add(lead2)

    with pytest.raises(IntegrityError):
        db_session.commit()
