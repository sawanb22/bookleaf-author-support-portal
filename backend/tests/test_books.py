import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_get_author_books_and_royalty_invariants(client: AsyncClient, author_token: str):
    res = await client.get("/api/v1/me/books", headers={
        "Authorization": f"Bearer {author_token}"
    })
    assert res.status_code == 200
    data = res.json()
    assert "books" in data
    assert "summary" in data

    books = data["books"]
    summary = data["summary"]

    # Verify Priya Sharma has her books
    ext_ids = [b["external_id"] for b in books]
    assert "BK001" in ext_ids, "BK001 must be in Priya Sharma books"
    assert "BK002" in ext_ids, "BK002 must be in Priya Sharma books"

    # Verify Exact Royalty Summary
    assert summary["total_royalty_earned"] == 19908, "Priya Sharma earned must be ₹19,908"
    assert summary["royalty_paid"] == 16338, "Priya Sharma paid must be ₹16,338"
    assert summary["royalty_pending"] == 3570, "Priya Sharma pending must be ₹3,570"

    # Mathematical Invariant: Earned = Paid + Pending
    assert summary["royalty_paid"] + summary["royalty_pending"] == summary["total_royalty_earned"]

@pytest.mark.asyncio
async def test_book_edge_cases(client: AsyncClient, author_token: str):
    res = await client.get("/api/v1/me/books", headers={
        "Authorization": f"Bearer {author_token}"
    })
    data = res.json()
    books = data["books"]

    # BK002: Paid in full (pending == 0)
    bk002 = next((b for b in books if b["external_id"] == "BK002"), None)
    assert bk002 is not None
    assert bk002["royalty_pending"] == 0.0

    # BK015: Typesetting in-production stage
    from app.services.book_service import BookService
    bk015 = await BookService.get_book_by_external_id("BK015")
    assert bk015 is not None
    assert bk015["stage"] == "Typesetting"
    assert "In Production" in bk015["status"]

