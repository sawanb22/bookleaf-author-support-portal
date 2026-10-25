import asyncio
from app.db.session import db

async def inspect():
    await db.connect()
    tables = await db.fetch_all("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY 1
    """)
    print("Tables:", [t["table_name"] for t in tables])
    for t in tables:
        tname = t["table_name"]
        cnt = await db.fetch_val(f'SELECT count(*) FROM "{tname}"')
        cols = await db.fetch_all(f"""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = '{tname}'
            ORDER BY ordinal_position
        """)
        col_summary = ", ".join(f"{c['column_name']} ({c['data_type']})" for c in cols)
        print(f"  {tname} ({cnt} rows): {col_summary}")

    constraints = await db.fetch_all("""
        SELECT tc.table_name, tc.constraint_name, tc.constraint_type
        FROM information_schema.table_constraints tc
        WHERE tc.table_schema = 'public'
        ORDER BY tc.table_name, tc.constraint_name
    """)
    print("\nConstraints:")
    for c in constraints:
        print(f"  {c['table_name']}: {c['constraint_name']} ({c['constraint_type']})")

    indexes = await db.fetch_all("""
        SELECT tablename, indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
        ORDER BY tablename, indexname
    """)
    print("\nIndexes:")
    for idx in indexes:
        print(f"  {idx['tablename']}: {idx['indexname']} -> {idx['indexdef']}")

    await db.disconnect()

if __name__ == "__main__":
    asyncio.run(inspect())
