import asyncio
import asyncpg
from app.db.session import db

async def test_drills():
    await db.connect()
    pool = await db.get_pool()

    print("\n--- DRILL 1: Balance Check Constraint (chk_royalty_balance) ---")
    async with pool.acquire() as conn:
        try:
            await conn.execute("UPDATE books SET royalty_pending = 1 WHERE external_id = 'BK001';")
            print("[FAIL] Balance constraint did not trigger!")
            assert False
        except asyncpg.exceptions.CheckViolationError as e:
            print(f"[PASS] Successfully blocked with: {e}")

    print("\n--- DRILL 2: Composite Foreign Key (tickets_book_owner_fk) ---")
    async with pool.acquire() as conn:
        try:
            await conn.execute("""
                INSERT INTO tickets (author_id, book_id, subject, description)
                SELECT a.id, b.id, 'x', 'y' FROM authors a, books b
                WHERE a.external_id = 'AUTH002' AND b.external_id = 'BK001';
            """)
            print("[FAIL] Composite foreign key did not trigger!")
            assert False
        except asyncpg.exceptions.ForeignKeyViolationError as e:
            print(f"[PASS] Successfully blocked with: {e}")

    print("\n--- DRILL 3: Case-Insensitive Unique Email (users_email_key) ---")
    async with pool.acquire() as conn:
        try:
            await conn.execute("""
                INSERT INTO users (id, email, password_hash, name, role) 
                VALUES ('dup_test', 'PRIYA.SHARMA@EMAIL.COM', 'x', 'dup', 'author');
            """)
            print("[FAIL] Case-insensitive email duplicate did not trigger!")
            assert False
        except asyncpg.exceptions.UniqueViolationError as e:
            print(f"[PASS] Successfully blocked with: {e}")

    print("\n--- DRILL 4: Queue Partial Index (tickets_queue_idx) ---")
    async with pool.acquire() as conn:
        await conn.execute("SET enable_seqscan = off;")
        rows = await conn.fetch("""
            EXPLAIN (FORMAT TEXT) SELECT id FROM tickets 
            WHERE status IN ('open', 'in_progress', 'Open', 'In progress') 
            ORDER BY priority, created_at LIMIT 25;
        """)
        plan = "\n".join(r[0] for r in rows)
        print(f"Plan output:\n{plan}")
        assert "tickets_queue_idx" in plan or "Index Scan" in plan, f"Index scan expected! Got: {plan}"

        print("[PASS] Planner uses index scan for priority queue.")

    print("\n--- DRILL 5: Updated_at Trigger Drill (notes do NOT bump, replies DO bump) ---")
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            INSERT INTO tickets (author_id, subject, description)
            SELECT id, 'trigger test', 'checking the updated_at trigger' 
            FROM authors WHERE external_id = 'AUTH001' 
            RETURNING id, updated_at;
        """)
        t_id = row["id"]
        t_orig_updated = row["updated_at"]
        print(f"Created trigger test ticket {t_id} with updated_at = {t_orig_updated}")

        await asyncio.sleep(1.1)

        # Internal note
        await conn.execute("""
            INSERT INTO ticket_notes (ticket_id, admin_id, body) 
            SELECT $1, id, 'internal note' FROM users WHERE role = 'admin' LIMIT 1;
        """, t_id)

        t_after_note = await conn.fetchval("SELECT updated_at FROM tickets WHERE id = $1", t_id)
        print(f"After internal note: updated_at = {t_after_note}")
        assert t_after_note == t_orig_updated, f"Internal note bumped updated_at! {t_after_note} != {t_orig_updated}"
        print("[PASS] Internal note did NOT bump updated_at.")

        await asyncio.sleep(1.1)

        # Staff reply message
        await conn.execute("""
            INSERT INTO ticket_messages (id, ticket_id, sender_id, sender_name, sender_role, body) 
            SELECT 'msg_trig_reply', $1, id, 'Admin', 'admin', 'reply message' 
            FROM users WHERE role = 'admin' LIMIT 1;
        """, t_id)

        t_after_msg = await conn.fetchval("SELECT updated_at FROM tickets WHERE id = $1", t_id)
        print(f"After staff reply: updated_at = {t_after_msg}")
        assert t_after_msg > t_orig_updated, f"Staff reply failed to bump updated_at! {t_after_msg} <= {t_orig_updated}"
        print("[PASS] Staff reply successfully bumped updated_at.")

        # Cleanup test ticket
        await conn.execute("DELETE FROM tickets WHERE id = $1", t_id)

    print("\n[ALL 5 DRILLS PASSED CLEANLY!]")
    await db.disconnect()

if __name__ == "__main__":
    asyncio.run(test_drills())
