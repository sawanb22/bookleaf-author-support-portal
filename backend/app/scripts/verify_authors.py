import asyncio
from app.db.session import db

async def verify_authors_table():
    await db.connect()
    authors = await db.fetch_all("SELECT id, external_id, user_id, name, email, phone, city, TO_CHAR(joined_date, 'YYYY-MM-DD') as joined_date FROM authors ORDER BY id")
    print(f"Total authors: {len(authors)}")
    for a in authors:
        print(f"Author: {a['id']:<10} {a['name']:<18} {a['email']:<28} {a['phone']:<18} {a['city']:<12} {a['joined_date']}")

if __name__ == "__main__":
    asyncio.run(verify_authors_table())
