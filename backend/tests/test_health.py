import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_health_endpoints(client: AsyncClient):
    # Root /health
    res = await client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "uptime" in data
    assert "timestamp" in data

    # /api/health
    res_api = await client.get("/api/health")
    assert res_api.status_code == 200
    assert res_api.json()["status"] == "healthy"

@pytest.mark.asyncio
async def test_readiness_probe(client: AsyncClient):
    # /health/ready
    res = await client.get("/health/ready")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ready"
    assert data["database"] == "connected"
    assert data["provider"] == "Neon PostgreSQL"

    # /api/health/ready
    res_api = await client.get("/api/health/ready")
    assert res_api.status_code == 200
    assert res_api.json()["status"] == "ready"
