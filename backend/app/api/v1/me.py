import json
import asyncio
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query, status
from fastapi.responses import StreamingResponse
from app.schemas.book import AuthorBooksResponse, RoyaltySummary
from app.schemas.ticket import TicketCreate, TicketListResponse, MessageCreate
from app.services.book_service import BookService
from app.services.ticket_service import TicketService
from app.services.event_bus import event_bus
from app.api.deps import require_author, create_error_dict

router = APIRouter(prefix="/me", tags=["me"])

@router.get("/books", response_model=AuthorBooksResponse)
async def get_my_books(user: dict = Depends(require_author)):
    author_id = user["id"]
    try:
        books = await BookService.get_books_by_author(author_id)
        earned = sum(b.get("total_royalty_earned") or 0.0 for b in books)
        paid = sum(b.get("royalty_paid") or 0.0 for b in books)
        pending = sum(b.get("royalty_pending") or 0.0 for b in books)

        return {
            "books": books,
            "summary": {
                "total_royalty_earned": earned,
                "royalty_paid": paid,
                "royalty_pending": pending
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=create_error_dict("internal_error", str(e) or "Failed to fetch author books.")
        )

@router.get("/tickets", response_model=TicketListResponse)
async def get_my_tickets(
    status: Optional[str] = Query(None),
    user: dict = Depends(require_author)
):
    author_id = user["id"]
    try:
        tickets = await TicketService.get_author_tickets(author_id, status)
        return {
            "tickets": tickets,
            "total": len(tickets)
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=create_error_dict("internal_error", str(e) or "Failed to fetch tickets.")
        )

@router.post("/tickets", status_code=status.HTTP_201_CREATED)
async def create_my_ticket(
    req: TicketCreate,
    user: dict = Depends(require_author)
):
    author_id = user["id"]
    author_name = user["name"]

    if not req.subject or len(req.subject.strip()) < 3:
        raise HTTPException(
            status_code=422,
            detail=create_error_dict("validation_error", "Subject must be at least 3 characters.", [
                {"field": "subject", "message": "Subject must be at least 3 characters."}
            ])
        )

    if not req.description or len(req.description.strip()) < 10:
        raise HTTPException(
            status_code=422,
            detail=create_error_dict("validation_error", "Description must be at least 10 characters.", [
                {"field": "description", "message": "Description must be at least 10 characters."}
            ])
        )

    try:
        created = await TicketService.create_ticket(
            author_id=author_id,
            author_name=author_name,
            subject=req.subject,
            description=req.description,
            book_id=req.book_id
        )
        return created
    except LookupError as le:
        raise HTTPException(
            status_code=404,
            detail=create_error_dict("book_not_found", str(le))
        )
    except ValueError as ve:
        raise HTTPException(
            status_code=422,
            detail=create_error_dict("validation_error", str(ve), [
                {"field": "book_id", "message": str(ve)}
            ])
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=create_error_dict("internal_error", str(e) or "Failed to create ticket.")
        )

@router.get("/tickets/{ticket_id}")
async def get_my_ticket_detail(
    ticket_id: str,
    user: dict = Depends(require_author)
):
    author_id = user["id"]
    ticket = await TicketService.get_author_ticket_by_id(ticket_id, author_id)
    if not ticket:
        raise HTTPException(
            status_code=404,
            detail=create_error_dict("ticket_not_found", "Ticket not found.")
        )
    return ticket

@router.post("/tickets/{ticket_id}/messages", status_code=status.HTTP_201_CREATED)
async def add_my_ticket_message(
    ticket_id: str,
    req: MessageCreate,
    user: dict = Depends(require_author)
):
    author_id = user["id"]
    author_name = user["name"]

    if not req.body or not req.body.strip():
        raise HTTPException(
            status_code=422,
            detail=create_error_dict("validation_error", "Message body cannot be empty.", [
                {"field": "body", "message": "Message body cannot be empty."}
            ])
        )

    created = await TicketService.add_author_message(
        ticket_id=ticket_id,
        author_id=author_id,
        author_name=author_name,
        body=req.body
    )
    if not created:
        raise HTTPException(
            status_code=404,
            detail=create_error_dict("ticket_not_found", "Ticket not found.")
        )
    return created

@router.get("/stream")
async def author_event_stream(user: dict = Depends(require_author)):
    author_id = user["id"]
    q = event_bus.subscribe()

    async def event_generator():
        try:
            yield "event: connected\ndata: {\"status\":\"connected\"}\n\n"
            while True:
                try:
                    item = await asyncio.wait_for(q.get(), timeout=15.0)
                    evt_type = item["event"]
                    evt_data = item["data"]
                    if not evt_data.get("author_id") or evt_data.get("author_id") == author_id:
                        payload = json.dumps({
                            "event": evt_type,
                            "ticket_id": evt_data.get("ticket_id"),
                            "timestamp": evt_data.get("timestamp")
                        })
                        yield f"event: {evt_type}\ndata: {payload}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            event_bus.unsubscribe(q)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive"
        }
    )
