import json
import asyncio
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query, status, Request
from fastapi.responses import StreamingResponse
from app.schemas.ticket import (
    AdminQueueResponse, TicketUpdate, MessageCreate, NoteCreate,
    AdminStatsOut, AdminStaffOut, DraftGenerateRequest
)
from app.schemas.ai import DraftResult
from app.services.admin_ticket_service import AdminTicketService
from app.services.event_bus import event_bus
from app.ai.llm import get_llm_client
from app.api.deps import require_admin, create_error_dict

router = APIRouter(prefix="/admin", tags=["admin"])

@router.get("/tickets", response_model=AdminQueueResponse)
async def get_admin_queue(
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    assignee: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    sort: str = Query("urgency"),
    user: dict = Depends(require_admin)
):
    try:
        items = await AdminTicketService.get_queue(
            status=status,
            category=category,
            priority=priority,
            assignee=assignee,
            q=q,
            sort=sort
        )
        return {
            "items": items,
            "total": len(items)
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=create_error_dict("internal_error", str(e) or "Failed to fetch queue.")
        )

@router.get("/tickets/{ticket_id}")
async def get_ticket_detail(
    ticket_id: str,
    user: dict = Depends(require_admin)
):
    detail = await AdminTicketService.get_ticket_by_id(ticket_id)
    if not detail:
        raise HTTPException(
            status_code=404,
            detail=create_error_dict("ticket_not_found", "Ticket not found.")
        )
    return detail

@router.patch("/tickets/{ticket_id}")
async def update_ticket(
    ticket_id: str,
    req: TicketUpdate,
    user: dict = Depends(require_admin)
):
    admin_id = user["id"]
    admin_name = user["name"]

    updates = req.model_dump(exclude_unset=True)
    updated = await AdminTicketService.update_ticket(ticket_id, updates, admin_id, admin_name)
    if not updated:
        raise HTTPException(
            status_code=404,
            detail=create_error_dict("ticket_not_found", "Ticket not found.")
        )
    return updated

@router.post("/tickets/{ticket_id}/messages", status_code=status.HTTP_201_CREATED)
async def send_admin_message(
    ticket_id: str,
    req: MessageCreate,
    user: dict = Depends(require_admin)
):
    admin_id = user["id"]
    admin_name = user["name"]

    if not req.body or not req.body.strip():
        raise HTTPException(
            status_code=422,
            detail=create_error_dict("validation_error", "Message body cannot be empty.", [
                {"field": "body", "message": "Message body cannot be empty."}
            ])
        )

    created = await AdminTicketService.add_admin_message(
        ticket_id=ticket_id,
        admin_id=admin_id,
        admin_name=admin_name,
        body=req.body,
        from_ai_draft=req.from_ai_draft,
        status=req.status
    )
    if not created:
        raise HTTPException(
            status_code=404,
            detail=create_error_dict("ticket_not_found", "Ticket not found.")
        )
    return created

@router.post("/tickets/{ticket_id}/notes", status_code=status.HTTP_201_CREATED)
async def create_internal_note(
    ticket_id: str,
    req: NoteCreate,
    user: dict = Depends(require_admin)
):
    admin_id = user["id"]
    admin_name = user["name"]

    if not req.body or not req.body.strip():
        raise HTTPException(
            status_code=422,
            detail=create_error_dict("validation_error", "Note body cannot be empty.", [
                {"field": "body", "message": "Note body cannot be empty."}
            ])
        )

    created = await AdminTicketService.add_admin_note(
        ticket_id=ticket_id,
        admin_id=admin_id,
        admin_name=admin_name,
        body=req.body
    )
    return created

@router.post("/tickets/{ticket_id}/classify", status_code=status.HTTP_202_ACCEPTED)
async def trigger_ai_classify(
    ticket_id: str,
    user: dict = Depends(require_admin)
):
    ticket = await AdminTicketService.get_ticket_by_id(ticket_id)
    if not ticket:
        raise HTTPException(
            status_code=404,
            detail=create_error_dict("ticket_not_found", "Ticket not found.")
        )

    try:
        client = get_llm_client()
        ai_res = client.classify_ticket(
            ticket["subject"],
            ticket["description"],
            ticket.get("book_title")
        )
        is_rule_fallback = ai_res.get("badge") == "classified by rules" or ai_res.get("reasoning", "").startswith("Classified by rules")
        ai_status = "failed" if is_rule_fallback else "completed"
        updated = await AdminTicketService.update_ticket(
            ticket_id,
            {
                "category": ai_res["category"],
                "priority": ai_res["priority"],
                "ai_category": ai_res["category"],
                "ai_priority": ai_res["priority"],
                "ai_reasoning": ai_res.get("reasoning"),
                "ai_confidence": ai_res.get("confidence"),
                "ai_status": ai_status
            },
            user["id"],
            user["name"]
        )
        return updated
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=create_error_dict("internal_error", str(e) or "Classification retry failed.")
        )

@router.post("/tickets/{ticket_id}/draft", response_model=DraftResult)
async def get_or_generate_draft(
    ticket_id: str,
    req: Optional[DraftGenerateRequest] = None,
    user: dict = Depends(require_admin)
):
    regenerate = bool(req.regenerate) if req else False

    try:
        draft = await AdminTicketService.get_or_generate_draft(ticket_id, regenerate)
        if not draft:
            raise HTTPException(
                status_code=404,
                detail=create_error_dict("ticket_not_found", "Ticket not found.")
            )
        return draft
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=create_error_dict("ai_unavailable", str(e) or "AI drafting service unavailable.")
        )

@router.get("/stats", response_model=AdminStatsOut)
async def get_admin_stats(user: dict = Depends(require_admin)):
    try:
        return await AdminTicketService.get_stats()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=create_error_dict("internal_error", str(e) or "Failed to calculate stats.")
        )

@router.get("/staff", response_model=AdminStaffOut)
async def get_staff_list(user: dict = Depends(require_admin)):
    try:
        staff = await AdminTicketService.get_staff()
        return {"staff": staff}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=create_error_dict("internal_error", str(e) or "Failed to fetch staff.")
        )

@router.get("/stream")
async def admin_event_stream(user: dict = Depends(require_admin)):
    q = event_bus.subscribe()

    async def event_generator():
        try:
            yield "event: connected\ndata: {\"status\":\"connected\"}\n\n"
            while True:
                try:
                    item = await asyncio.wait_for(q.get(), timeout=15.0)
                    evt_type = item["event"]
                    evt_data = item["data"]
                    payload = json.dumps({
                        "event": evt_type,
                        "ticket_id": evt_data.get("ticket_id"),
                        "author_id": evt_data.get("author_id"),
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
