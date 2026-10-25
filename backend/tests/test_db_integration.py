import pytest
from app.db.session import db

@pytest.mark.asyncio
async def test_neon_postgres_direct_query():
    # 1. Connection and version probe
    val = await db.fetch_val("SELECT 1")
    assert val == 1, "Neon DB probe must return 1"

    # 2. Users table structure
    users = await db.fetch_all("SELECT id, email, role FROM users LIMIT 5")
    assert len(users) > 0, "Users table must not be empty"

    # 3. Books table structure and foreign keys
    books = await db.fetch_all("SELECT id, external_id, author_id, total_royalty_earned FROM books LIMIT 5")
    assert len(books) > 0, "Books table must not be empty"

    # 4. Tickets table structure and query capability
    tickets = await db.fetch_all("SELECT id, status, priority FROM tickets LIMIT 5")
    assert isinstance(tickets, list), "Tickets query must return list"
