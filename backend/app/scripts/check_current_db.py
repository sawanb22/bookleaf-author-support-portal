import asyncio
from app.db.session import db

async def check_data():
    await db.connect()
    for table in ['users', 'authors', 'books', 'book_platforms']:
        count = await db.fetch_val(f"SELECT count(*) FROM {table}")
        print(f"{table}: {count} rows")
    users = await db.fetch_all("SELECT id, email, role, name FROM users")
    print("Users:")
    for u in users:
        print(f"  {u['id']}: {u['email']} ({u['role']}) - {u['name']}")
    authors = await db.fetch_all("SELECT id, external_id, name, email, phone, city, joined_date FROM authors")
    print("Authors:")
    for a in authors:
        print(f"  {a['id']}: {a['name']}, {a['email']}, {a['phone']}, {a['city']}, {a['joined_date']}")
    b_count = await db.fetch_val("SELECT count(*) FROM books")
    bp_count = await db.fetch_val("SELECT count(*) FROM book_platforms")
    print(f"Total books: {b_count}, Total book_platforms: {bp_count}")

if __name__ == "__main__":
    asyncio.run(check_data())
