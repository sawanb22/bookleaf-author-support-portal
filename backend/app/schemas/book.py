from typing import List, Optional
from pydantic import BaseModel

class BookOut(BaseModel):
    id: str
    external_id: str
    author_id: str
    title: str
    isbn: Optional[str] = None
    genre: Optional[str] = None
    publication_date: Optional[str] = None
    status: str
    stage: Optional[str] = None
    mrp: Optional[float] = None
    total_copies_sold: Optional[int] = None
    total_royalty_earned: float = 0.0
    royalty_paid: float = 0.0
    royalty_pending: float = 0.0
    last_royalty_payout_date: Optional[str] = None
    print_partner: Optional[str] = None
    platforms: List[str] = []

class RoyaltySummary(BaseModel):
    total_royalty_earned: float
    royalty_paid: float
    royalty_pending: float

class AuthorBooksResponse(BaseModel):
    books: List[BookOut]
    summary: RoyaltySummary
