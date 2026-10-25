import os
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.security import create_access_token
from app.db.session import db

@pytest_asyncio.fixture(autouse=True)
async def init_db():
    yield
    await db.disconnect()

@pytest.fixture
def author_token() -> str:
    payload = {
        "sub": "AUTH001",
        "role": "author",
        "email": "priya.sharma@email.com",
        "name": "Priya Sharma"
    }
    return create_access_token(payload)

@pytest.fixture
def rohit_token() -> str:
    payload = {
        "sub": "AUTH002",
        "role": "author",
        "email": "rohit.kapoor@email.com",
        "name": "Rohit Kapoor"
    }
    return create_access_token(payload)

@pytest.fixture
def admin_token() -> str:
    payload = {
        "sub": "admin_ops",
        "role": "admin",
        "email": "ops.admin@bookleaf.demo",
        "name": "Ops Admin"
    }
    return create_access_token(payload)

@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac
