import asyncio
from app.db.session import db

async def insert_bl_1126():
    await db.connect()
    exists = await db.fetch_one("SELECT id FROM tickets WHERE id = $1", "BL-1126")
    if not exists:
        await db.execute("""
            INSERT INTO tickets (
                id, subject, description, author_id, book_id, book_title,
                status, priority, category, ai_status, created_at, updated_at
            ) VALUES (
                'BL-1126',
                'royalty not recieved for this years 3rd quarter',
                'royalty not recieved for this years 3rd quarter',
                'AUTH001',
                'BK001',
                'Whispers of the Ganges',
                'In progress',
                'High',
                'Royalty & Payments',
                'completed',
                NOW() - INTERVAL '1 hour',
                NOW()
            )
        """)
        await db.execute("""
            INSERT INTO ticket_messages (
                id, ticket_id, sender_name, sender_role, body, is_from_staff, is_internal_note, created_at
            ) VALUES (
                'msg_BL-1126_1',
                'BL-1126',
                'Priya Sharma',
                'author',
                'royalty not recieved for this years 3rd quarter',
                false,
                false,
                NOW() - INTERVAL '1 hour'
            )
        """)
        reply_body = (
            "Dear Priya, thank you for reaching out about your royalty details—we are happy to clarify "
            "the calculation for you. For \"Whispers of the Ganges\" (ISBN: 978-93-5XXXX-01-1), your total royalties "
            "earned stand at ₹11,970, with ₹8,400 already paid and ₹3,570 currently pending. This pending amount "
            "reflects your 80% share under our royalty structure (MRP minus printing costs, platform commission, "
            "and shipping). Your total pending balance across all titles is also ₹3,570, which exceeds the minimum "
            "payout threshold of ₹1,000, meaning your next payout is eligible to be processed. Your last payout was "
            "processed on October 15, 2025. Our finance team processes royalties within the 45-day window following "
            "each quarter close—Q4 (Oct-Dec) payouts are remitted by February 15, 2026. If you would like a detailed "
            "breakdown of the calculation for a specific book, please let us know. BookLeaf Support Team"
        )
        await db.execute("""
            INSERT INTO ticket_messages (
                id, ticket_id, sender_name, sender_role, body, is_from_staff, is_internal_note, created_at
            ) VALUES (
                'msg_BL-1126_2',
                'BL-1126',
                'BookLeaf Support',
                'support',
                $1,
                true,
                false,
                NOW()
            )
        """, reply_body)
        print("Successfully inserted BL-1126 with staff reply into Neon DB!")
    else:
        print("BL-1126 already exists in Neon DB.")

if __name__ == "__main__":
    asyncio.run(insert_bl_1126())
