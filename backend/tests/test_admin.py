import pytest
from httpx import AsyncClient

from app.db.session import db

@pytest.mark.asyncio
async def test_admin_queue_and_filtering(client: AsyncClient, admin_token: str, author_token: str):
    headers = {"Authorization": f"Bearer {admin_token}"}
    author_headers = {"Authorization": f"Bearer {author_token}"}

    # Dynamically create a ticket for queue testing
    res_create = await client.post("/api/v1/me/tickets", headers=author_headers, json={
        "book_id": "BK001",
        "subject": "Admin queue test ticket",
        "description": "Dynamic ticket created for testing admin queue filtering."
    })
    assert res_create.status_code == 201
    created_id = res_create.json()["id"]

    try:
        # Fetch default queue (urgency sorted)
        res = await client.get("/api/v1/admin/tickets?sort=urgency", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert "items" in data
        assert "total" in data
        assert data["total"] > 0

        # Filter by status=Open
        res_open = await client.get("/api/v1/admin/tickets?status=Open", headers=headers)
        assert res_open.status_code == 200
        for item in res_open.json()["items"]:
            assert item["status"] == "Open"
    finally:
        await db.execute("DELETE FROM tickets WHERE id = $1", created_id)

@pytest.mark.asyncio
async def test_admin_ticket_actions_and_notes(client: AsyncClient, admin_token: str, author_token: str):
    headers = {"Authorization": f"Bearer {admin_token}"}
    author_headers = {"Authorization": f"Bearer {author_token}"}

    # Dynamically create ticket for admin actions testing
    res_create = await client.post("/api/v1/me/tickets", headers=author_headers, json={
        "book_id": "BK001",
        "subject": "Admin actions test ticket",
        "description": "Dynamic ticket created for testing admin notes and triage actions."
    })
    assert res_create.status_code == 201
    target_id = res_create.json()["id"]

    try:
        # 1. Get ticket details with notes and author books
        res_detail = await client.get(f"/api/v1/admin/tickets/{target_id}", headers=headers)
        assert res_detail.status_code == 200
        detail = res_detail.json()
        assert "messages" in detail
        assert "notes" in detail
        assert "events" in detail
        assert "author_books" in detail

        # 2. Add internal note
        res_note = await client.post(f"/api/v1/admin/tickets/{target_id}/notes", headers=headers, json={
            "body": "Verified author accounts ledger; ready to confirm payout."
        })
        assert res_note.status_code == 201

        # 3. Add official admin message / reply
        res_msg = await client.post(f"/api/v1/admin/tickets/{target_id}/messages", headers=headers, json={
            "body": "Dear Author, we have reviewed your records and verified the disbursement schedule.",
            "from_ai_draft": False
        })
        assert res_msg.status_code == 201

        # 4. Update ticket status / assignee / category override
        res_patch = await client.patch(f"/api/v1/admin/tickets/{target_id}", headers=headers, json={
            "status": "In progress",
            "assignee": "Rahul Sharma"
        })
        assert res_patch.status_code == 200
        updated = res_patch.json()
        assert updated["assignee"] == "Rahul Sharma"
    finally:
        await db.execute("DELETE FROM tickets WHERE id = $1", target_id)

@pytest.mark.asyncio
async def test_admin_stats_and_staff(client: AsyncClient, admin_token: str):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Operational KPI Stats
    res_stats = await client.get("/api/v1/admin/stats", headers=headers)
    assert res_stats.status_code == 200
    stats = res_stats.json()
    assert "total_in_queue" in stats
    assert "needs_first_reply" in stats
    assert "awaiting_author" in stats
    assert "ai_draft_ready" in stats
    assert "resolved_today" in stats
    assert "ai_override_rate" in stats

    # Staff list
    res_staff = await client.get("/api/v1/admin/staff", headers=headers)
    assert res_staff.status_code == 200
    staff = res_staff.json()["staff"]
    assert len(staff) >= 1
    assert any(s["role"] == "admin" or "name" in s for s in staff)
