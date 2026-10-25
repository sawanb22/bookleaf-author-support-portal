import json
from typing import List, Dict, Any, Optional
from app.db.session import db

def normalize_book(row: Dict[str, Any]) -> Dict[str, Any]:
    platforms = row.get("platforms")
    if isinstance(platforms, str):
        try:
            platforms = json.loads(platforms)
        except Exception:
            platforms = []
    elif not isinstance(platforms, list):
        platforms = []

    return {
        "id": row["id"],
        "external_id": row["external_id"],
        "author_id": row["author_id"],
        "title": row["title"],
        "isbn": row.get("isbn"),
        "genre": row.get("genre"),
        "publication_date": str(row["publication_date"]) if row.get("publication_date") else None,
        "status": row["status"],
        "stage": row.get("stage"),
        "mrp": float(row["mrp"]) if row.get("mrp") is not None else None,
        "total_copies_sold": int(row["total_copies_sold"]) if row.get("total_copies_sold") is not None else None,
        "total_royalty_earned": float(row.get("total_royalty_earned") or 0.0),
        "royalty_paid": float(row.get("royalty_paid") or 0.0),
        "royalty_pending": float(row.get("royalty_pending") or 0.0),
        "last_royalty_payout_date": str(row["last_royalty_payout_date"]) if row.get("last_royalty_payout_date") else None,
        "print_partner": row.get("print_partner"),
        "platforms": platforms
    }

class BookService:
    @staticmethod
    async def get_books_by_author(author_id: str) -> List[Dict[str, Any]]:
        if author_id.startswith("admin") or author_id in ["admin_ops", "admin_support"]:
            rows = await db.fetch_all(
                """SELECT id, external_id, author_id, title, isbn, genre,
                          TO_CHAR(publication_date, 'YYYY-MM-DD') as publication_date,
                          status, stage, mrp, total_copies_sold,
                          total_royalty_earned, royalty_paid, royalty_pending,
                          TO_CHAR(last_royalty_payout_date, 'YYYY-MM-DD') as last_royalty_payout_date,
                          print_partner, platforms
                   FROM books
                   ORDER BY publication_date DESC NULLS LAST, title ASC"""
            )
        else:
            rows = await db.fetch_all(
                """SELECT id, external_id, author_id, title, isbn, genre,
                          TO_CHAR(publication_date, 'YYYY-MM-DD') as publication_date,
                          status, stage, mrp, total_copies_sold,
                          total_royalty_earned, royalty_paid, royalty_pending,
                          TO_CHAR(last_royalty_payout_date, 'YYYY-MM-DD') as last_royalty_payout_date,
                          print_partner, platforms
                   FROM books
                   WHERE author_id = $1
                   ORDER BY publication_date DESC NULLS LAST, title ASC""",
                author_id
            )
        books = [normalize_book(r) for r in rows]
        return books


    @staticmethod
    async def get_book_by_external_id(external_id: str) -> Optional[Dict[str, Any]]:
        row = await db.fetch_one(
            """SELECT id, external_id, author_id, title, isbn, genre,
                      TO_CHAR(publication_date, 'YYYY-MM-DD') as publication_date,
                      status, stage, mrp, total_copies_sold,
                      total_royalty_earned, royalty_paid, royalty_pending,
                      TO_CHAR(last_royalty_payout_date, 'YYYY-MM-DD') as last_royalty_payout_date,
                      print_partner, platforms
               FROM books
               WHERE external_id = $1
               LIMIT 1""",
            external_id
        )
        return normalize_book(row) if row else None
