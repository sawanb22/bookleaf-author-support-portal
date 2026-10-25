import asyncio
from app.db.session import db

async def verify_books_and_platforms():
    await db.connect()
    books = await db.fetch_all("SELECT id, external_id, author_id, title, isbn, mrp, total_copies_sold, total_royalty_earned, royalty_paid, royalty_pending FROM books ORDER BY id")
    print(f"Total books: {len(books)}")
    for b in books:
        platforms = await db.fetch_all("SELECT platform_name FROM book_platforms WHERE book_id = $1", b["id"])
        p_names = [p["platform_name"] for p in platforms]
        print(f"Book {b['id']}: {b['title']:<26} (Author: {b['author_id']}) - Platforms: {', '.join(p_names)}")
    
    total_platforms = await db.fetch_val("SELECT count(*) FROM book_platforms")
    print(f"\nTotal book_platforms rows: {total_platforms}")

if __name__ == "__main__":
    asyncio.run(verify_books_and_platforms())
