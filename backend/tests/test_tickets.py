import pytest
from httpx import AsyncClient
from app.db.session import db

@pytest.mark.asyncio
async def test_author_ticket_lifecycle(client: AsyncClient, author_token: str):
    headers = {"Authorization": f"Bearer {author_token}"}

    # 1. Fetch tickets
    res = await client.get("/api/v1/me/tickets", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "tickets" in data
    assert "total" in data

    # 2. Validation: Subject too short (< 3 chars)
    res_invalid_subj = await client.post("/api/v1/me/tickets", headers=headers, json={
        "subject": "Hi",
        "description": "Valid description with sufficient length here."
    })
    assert res_invalid_subj.status_code == 422
    assert "error" in res_invalid_subj.json()

    # 3. Validation: Description too short (< 10 chars)
    res_invalid_desc = await client.post("/api/v1/me/tickets", headers=headers, json={
        "subject": "Valid Subject",
        "description": "Short"
    })
    assert res_invalid_desc.status_code == 422
    assert "error" in res_invalid_desc.json()

    # 4. Create valid ticket
    res_create = await client.post("/api/v1/me/tickets", headers=headers, json={
        "book_id": "BK001",
        "subject": "Inquiry regarding royalty payout statement",
        "description": "I would like to check when the Q3 royalty statement will be credited."
    })
    assert res_create.status_code == 201
    created_ticket = res_create.json()
    ticket_id = created_ticket["id"]
    assert ticket_id.startswith("BL-")
    assert created_ticket["status"] == "Open"

    try:
        # 5. Get ticket details
        res_detail = await client.get(f"/api/v1/me/tickets/{ticket_id}", headers=headers)
        assert res_detail.status_code == 200
        detail = res_detail.json()
        assert detail["id"] == ticket_id
        assert len(detail["messages"]) >= 1
        assert detail["messages"][0]["sender_role"] == "author"

        # 6. Add author follow-up reply
        res_msg = await client.post(f"/api/v1/me/tickets/{ticket_id}/messages", headers=headers, json={
            "body": "Following up to see if any updates are available on this request."
        })
        assert res_msg.status_code == 201
        msg_data = res_msg.json()
        assert msg_data["body"] == "Following up to see if any updates are available on this request."
    finally:
        await db.execute("DELETE FROM tickets WHERE id = $1", ticket_id)

@pytest.mark.asyncio
async def test_data_isolation_foreign_ticket_returns_404(client: AsyncClient, author_token: str):
    headers = {"Authorization": f"Bearer {author_token}"}
    res = await client.get("/api/v1/me/tickets/BL-999999", headers=headers)
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "ticket_not_found"

@pytest.mark.asyncio
async def test_extra_fields_forbidden_returns_422(client: AsyncClient, author_token: str):
    """Gate 2: extra='forbid' must reject injected unexpected fields with 422 Unprocessable Entity."""
    headers = {"Authorization": f"Bearer {author_token}"}

    # Injecting unexpected field author_id
    res_injected = await client.post("/api/v1/me/tickets", headers=headers, json={
        "author_id": "AUTH999",
        "subject": "Injected author_id attempt",
        "description": "Attempting to spoof ticket author identity through payload injection."
    })
    assert res_injected.status_code == 422
    err_body = res_injected.json()
    assert err_body["error"]["code"] == "validation_error"

    # Injecting unexpected status field
    res_status = await client.post("/api/v1/me/tickets", headers=headers, json={
        "status": "Resolved",
        "subject": "Injected status attempt",
        "description": "Attempting to force ticket status to resolved on creation."
    })
    assert res_status.status_code == 422
    assert res_status.json()["error"]["code"] == "validation_error"

@pytest.mark.asyncio
async def test_foreign_book_ticket_creation_returns_404(client: AsyncClient, author_token: str, rohit_token: str):
    """Gate 2: Creating a ticket referencing a foreign book ID returns 404 Not Found."""
    priya_headers = {"Authorization": f"Bearer {author_token}"}

    # Priya attempts to link Rohit's book BK003 (Code & Karma)
    res_foreign = await client.post("/api/v1/me/tickets", headers=priya_headers, json={
        "book_id": "BK003",
        "subject": "Query about foreign book",
        "description": "Trying to link a book that belongs to another author."
    })
    assert res_foreign.status_code == 404
    assert res_foreign.json()["error"]["code"] == "book_not_found"

    # Non-existent book ID returns 404
    res_nonexistent = await client.post("/api/v1/me/tickets", headers=priya_headers, json={
        "book_id": "BK999_DOES_NOT_EXIST",
        "subject": "Query about non-existent book",
        "description": "Trying to link a book ID that does not exist in the catalog."
    })
    assert res_nonexistent.status_code == 404
    assert res_nonexistent.json()["error"]["code"] == "book_not_found"

@pytest.mark.asyncio
async def test_cross_author_access_returns_404_never_403(client: AsyncClient, author_token: str, rohit_token: str):
    """Gate 2: Cross-author access: Rohit (AUTH002) accessing Priya's (AUTH001) ticket returns 404 Not Found (never 403)."""
    priya_headers = {"Authorization": f"Bearer {author_token}"}
    rohit_headers = {"Authorization": f"Bearer {rohit_token}"}

    # 1. Priya creates a ticket
    res_create = await client.post("/api/v1/me/tickets", headers=priya_headers, json={
        "subject": "Priya's private support ticket",
        "description": "Confidential royalties query intended only for Priya Sharma."
    })
    assert res_create.status_code == 201
    priya_ticket_id = res_create.json()["id"]

    try:
        # 2. Rohit attempts to read Priya's ticket
        res_rohit_get = await client.get(f"/api/v1/me/tickets/{priya_ticket_id}", headers=rohit_headers)
        assert res_rohit_get.status_code == 404, f"Expected 404 but got {res_rohit_get.status_code}"
        assert res_rohit_get.status_code != 403, "Must never return 403 to prevent ID enumeration"
        assert res_rohit_get.json()["error"]["code"] == "ticket_not_found"

        # 3. Rohit attempts to reply to Priya's ticket
        res_rohit_msg = await client.post(f"/api/v1/me/tickets/{priya_ticket_id}/messages", headers=rohit_headers, json={
            "body": "Rohit attempting an unauthorized message injection."
        })
        assert res_rohit_msg.status_code == 404, f"Expected 404 but got {res_rohit_msg.status_code}"
        assert res_rohit_msg.status_code != 403, "Must never return 403 to prevent ID enumeration"
    finally:
        await db.execute("DELETE FROM tickets WHERE id = $1", priya_ticket_id)

