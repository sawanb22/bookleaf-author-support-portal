import asyncio
from app.db.session import db

async def clean_tickets():
    await db.connect()
    pool = await db.get_pool()
    async with pool.acquire() as conn:
        print("Truncating ticket tables...")
        await conn.execute("TRUNCATE TABLE ticket_events, ticket_notes, ticket_messages, tickets CASCADE;")
        await conn.execute("TRUNCATE TABLE ai_calls;")
        await conn.execute("ALTER SEQUENCE ticket_seq RESTART WITH 1001;")

        t_cnt = await conn.fetchval("SELECT count(*) FROM tickets")
        m_cnt = await conn.fetchval("SELECT count(*) FROM ticket_messages")
        n_cnt = await conn.fetchval("SELECT count(*) FROM ticket_notes")
        e_cnt = await conn.fetchval("SELECT count(*) FROM ticket_events")
        ai_cnt = await conn.fetchval("SELECT count(*) FROM ai_calls")
        print(f"Remaining - Tickets: {t_cnt}, Messages: {m_cnt}, Notes: {n_cnt}, Events: {e_cnt}, AI Calls: {ai_cnt}")
        assert t_cnt == 0, f"Tickets count is {t_cnt}"
        assert m_cnt == 0, f"Messages count is {m_cnt}"
        assert n_cnt == 0, f"Notes count is {n_cnt}"
        assert e_cnt == 0, f"Events count is {e_cnt}"

        u_cnt = await conn.fetchval("SELECT count(*) FROM users")
        a_cnt = await conn.fetchval("SELECT count(*) FROM authors")
        b_cnt = await conn.fetchval("SELECT count(*) FROM books")
        p_cnt = await conn.fetchval("SELECT count(*) FROM book_platforms")
        print(f"Catalog Intact - Users: {u_cnt}, Authors: {a_cnt}, Books: {b_cnt}, Platforms: {p_cnt}")
        assert u_cnt == 12, f"Expected 12 users, got {u_cnt}"
        assert a_cnt == 10, f"Expected 10 authors, got {a_cnt}"
        assert b_cnt == 18, f"Expected 18 books, got {b_cnt}"
        assert p_cnt == 46, f"Expected 46 platforms, got {p_cnt}"

        fin = await conn.fetchrow("""
            SELECT 
                SUM(total_copies_sold) as copies,
                SUM(total_royalty_earned) as earned,
                SUM(royalty_paid) as paid,
                SUM(royalty_pending) as pending
            FROM books
        """)
        print(f"Financials: copies={fin['copies']}, earned={fin['earned']}, paid={fin['paid']}, pending={fin['pending']}")
        assert fin["copies"] == 7205, f"Expected 7205 copies, got {fin['copies']}"
        assert fin["earned"] == 243382, f"Expected 243382 earned, got {fin['earned']}"
        assert fin["paid"] == 202543, f"Expected 202543 paid, got {fin['paid']}"
        assert fin["pending"] == 40839, f"Expected 40839 pending, got {fin['pending']}"

    await db.disconnect()
    print("SUCCESS: Cleaned ticket tables and verified catalog invariants!")

if __name__ == "__main__":
    asyncio.run(clean_tickets())
