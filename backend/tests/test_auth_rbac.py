import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_author_login_success(client: AsyncClient):
    res = await client.post("/api/v1/auth/login", json={
        "email": "priya.sharma@email.com",
        "password": "demo"
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "priya.sharma@email.com"
    assert data["user"]["role"] == "author"

@pytest.mark.asyncio
async def test_admin_login_success(client: AsyncClient):
    res = await client.post("/api/v1/auth/login", json={
        "email": "ops.admin@bookleaf.demo",
        "password": "demo"
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["role"] == "admin"

@pytest.mark.asyncio
async def test_login_validation_failure(client: AsyncClient):
    # Empty email
    res = await client.post("/api/v1/auth/login", json={
        "email": "",
        "password": "demo"
    })
    assert res.status_code == 422
    assert "error" in res.json()

@pytest.mark.asyncio
async def test_login_invalid_credentials(client: AsyncClient):
    res = await client.post("/api/v1/auth/login", json={
        "email": "nonexistent@example.com",
        "password": "password"
    })
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "invalid_credentials"

@pytest.mark.asyncio
async def test_get_current_user_me(client: AsyncClient, author_token: str):
    res = await client.get("/api/v1/auth/me", headers={
        "Authorization": f"Bearer {author_token}"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["user"]["id"] == "AUTH001"
    assert data["user"]["name"] == "Priya Sharma"

@pytest.mark.asyncio
async def test_rbac_anonymous_blocked(client: AsyncClient):
    # Anonymous accessing protected author route
    res_books = await client.get("/api/v1/me/books")
    assert res_books.status_code == 401
    assert res_books.json()["error"]["code"] == "unauthorized"

    # Anonymous accessing protected admin route
    res_admin = await client.get("/api/v1/admin/stats")
    assert res_admin.status_code == 401
    assert res_admin.json()["error"]["code"] == "unauthorized"

@pytest.mark.asyncio
async def test_rbac_author_forbidden_from_admin(client: AsyncClient, author_token: str):
    headers = {"Authorization": f"Bearer {author_token}"}

    res_stats = await client.get("/api/v1/admin/stats", headers=headers)
    assert res_stats.status_code == 403
    assert res_stats.json()["error"]["code"] == "forbidden"

    res_queue = await client.get("/api/v1/admin/tickets", headers=headers)
    assert res_queue.status_code == 403
    assert res_queue.json()["error"]["code"] == "forbidden"

@pytest.mark.asyncio
async def test_rbac_admin_allowed_on_admin_routes(client: AsyncClient, admin_token: str):
    headers = {"Authorization": f"Bearer {admin_token}"}

    res_stats = await client.get("/api/v1/admin/stats", headers=headers)
    assert res_stats.status_code == 200

    res_queue = await client.get("/api/v1/admin/tickets", headers=headers)
    assert res_queue.status_code == 200
    assert "items" in res_queue.json()
