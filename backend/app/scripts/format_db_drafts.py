import asyncio
from app.db.session import db
from app.ai.llm import enforce_structured_draft_format

async def format_db_drafts():
    await db.connect()
    rows = await db.fetch_all("SELECT id, ai_draft, author_id FROM tickets WHERE ai_draft IS NOT NULL")
    for r in rows:
        formatted = enforce_structured_draft_format(r["ai_draft"], "Priya")
        await db.execute("UPDATE tickets SET ai_draft = $1 WHERE id = $2", formatted, r["id"])
        print(f"Updated formatted draft for {r['id']}")

if __name__ == "__main__":
    asyncio.run(format_db_drafts())
