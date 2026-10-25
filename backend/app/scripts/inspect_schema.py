import asyncio
from app.db.session import db

async def inspect_cols():
    await db.connect()
    for table in ['users', 'authors', 'books', 'book_platforms']:
        cols = await db.fetch_all(f"""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = '{table}'
            ORDER BY ordinal_position
        """)
        print(f"=== {table} ===")
        for c in cols:
            print(f"  {c['column_name']} ({c['data_type']}, nullable={c['is_nullable']})")

if __name__ == "__main__":
    asyncio.run(inspect_cols())
