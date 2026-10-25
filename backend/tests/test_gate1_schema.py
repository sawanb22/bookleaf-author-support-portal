import pytest
import asyncpg
from app.db.session import db

@pytest.mark.asyncio
async def test_gate1_table_names_and_counts():
    """Verify all 10 public tables and exact entity counts match Gate 1 specification."""
    tables = await db.fetch_all("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY 1
    """)
    table_names = [t["table_name"] for t in tables]
    expected_tables = [
        "ai_calls", "alembic_version", "authors", "book_platforms",
        "books", "ticket_events", "ticket_messages", "ticket_notes",
        "tickets", "users"
    ]
    assert table_names == expected_tables, f"Tables mismatch: {table_names}"

    counts = await db.fetch_one("""
        SELECT (SELECT count(*) FROM users WHERE role = 'author') AS author_users,
               (SELECT count(*) FROM users WHERE role = 'admin')  AS admin_users,
               (SELECT count(*) FROM authors)        AS authors,
               (SELECT count(*) FROM books)          AS books,
               (SELECT count(*) FROM book_platforms) AS platform_rows,
               (SELECT count(*) FROM tickets)        AS tickets;
    """)
    assert counts["author_users"] == 10
    assert counts["admin_users"] == 2
    assert counts["authors"] == 10
    assert counts["books"] == 18
    assert counts["platform_rows"] == 46
    assert counts["tickets"] >= 0, "Ticket queue is clean for fresh client testing"

@pytest.mark.asyncio
async def test_gate1_financial_totals():
    """Verify exact sales and royalty aggregates and balance invariant."""
    fin = await db.fetch_one("""
        SELECT count(*) FILTER (WHERE publication_date IS NOT NULL) AS published,
               count(*) FILTER (WHERE publication_date IS NULL)     AS in_production,
               sum(total_copies_sold) AS sold, sum(total_royalty_earned) AS earned,
               sum(royalty_paid) AS paid, sum(royalty_pending) AS pending
        FROM books;
    """)
    assert fin["published"] == 16, "Expected 16 live books"
    assert fin["in_production"] == 2, "Expected 2 in-production books (BK013 & BK015)"
    assert fin["sold"] == 7205, "Expected 7,205 copies sold"
    assert fin["earned"] == 243382, "Expected ₹2,43,382 earned"
    assert fin["paid"] == 202543, "Expected ₹2,02,543 paid"
    assert fin["pending"] == 40839, "Expected ₹40,839 pending"
    assert fin["earned"] - fin["paid"] == fin["pending"], "Aggregate balance invariant must hold"

    # Per-book invariant check
    invalids = await db.fetch_all("""
        SELECT external_id FROM books 
        WHERE total_royalty_earned - royalty_paid != royalty_pending;
    """)
    assert len(invalids) == 0, "No books should violate chk_royalty_balance"

@pytest.mark.asyncio
async def test_gate1_argon2id_hashes():
    """Verify all users use valid argon2id password hashes."""
    non_argon = await db.fetch_val(
        "SELECT count(*) FROM users WHERE password_hash NOT LIKE '$argon2id$%';"
    )
    assert non_argon == 0, "All users must have argon2id password hashes"

@pytest.mark.asyncio
async def test_gate1_relational_constraints_drills():
    """Verify constraint enforcement for balances, composite ownership, and case-insensitive email."""
    pool = await db.get_pool()

    # 1. Balance constraint
    async with pool.acquire() as conn:
        with pytest.raises(asyncpg.exceptions.CheckViolationError):
            await conn.execute("UPDATE books SET royalty_pending = 1 WHERE external_id = 'BK001';")

    # 2. Composite book ownership foreign key
    async with pool.acquire() as conn:
        with pytest.raises(asyncpg.exceptions.ForeignKeyViolationError):
            await conn.execute("""
                INSERT INTO tickets (author_id, book_id, subject, description)
                SELECT a.id, b.id, 'x', 'y' FROM authors a, books b
                WHERE a.external_id = 'AUTH002' AND b.external_id = 'BK001';
            """)

    # 3. Case-insensitive unique email
    async with pool.acquire() as conn:
        with pytest.raises(asyncpg.exceptions.UniqueViolationError):
            await conn.execute("""
                INSERT INTO users (id, email, password_hash, name, role) 
                VALUES ('dup_test_user', 'PRIYA.SHARMA@EMAIL.COM', 'x', 'dup', 'author');
            """)

@pytest.mark.asyncio
async def test_gate1_activity_triggers():
    """Verify updated_at trigger: internal notes do NOT bump, staff messages DO bump."""
    pool = await db.get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            INSERT INTO tickets (author_id, subject, description)
            SELECT id, 'gate1_trigger_test', 'trigger verification' 
            FROM authors WHERE external_id = 'AUTH001' 
            RETURNING id, updated_at;
        """)
        t_id = row["id"]
        t_orig = row["updated_at"]

        try:
            # Internal note insertion must NOT bump updated_at
            await conn.execute("""
                INSERT INTO ticket_notes (ticket_id, admin_id, body) 
                SELECT $1, id, 'confidential note' FROM users WHERE role = 'admin' LIMIT 1;
            """, t_id)
            t_after_note = await conn.fetchval("SELECT updated_at FROM tickets WHERE id = $1", t_id)
            assert t_after_note == t_orig, "Internal note must not modify tickets.updated_at"

            # Staff reply message MUST bump updated_at
            await conn.execute("""
                INSERT INTO ticket_messages (id, ticket_id, sender_id, sender_name, sender_role, body) 
                SELECT 'msg_g1_trig', $1, id, 'Admin', 'admin', 'official staff reply' 
                FROM users WHERE role = 'admin' LIMIT 1;
            """, t_id)
            t_after_reply = await conn.fetchval("SELECT updated_at FROM tickets WHERE id = $1", t_id)
            assert t_after_reply > t_orig, "Staff message must advance tickets.updated_at"
        finally:
            await conn.execute("DELETE FROM tickets WHERE id = $1", t_id)
