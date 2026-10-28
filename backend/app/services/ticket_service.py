import re
import asyncio
import json
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from app.db.session import db
from app.ai.llm import get_llm_client
from app.services.event_bus import event_bus

class TicketService:
    @staticmethod
    async def get_next_ticket_id() -> str:
        rows = await db.fetch_all("SELECT id FROM tickets WHERE id LIKE 'BL-%'")
        max_num = 1000
        for r in rows:
            m = re.match(r"^BL-(\d+)$", r["id"])
            if m:
                num = int(m.group(1))
                if num > max_num:
                    max_num = num
        return f"BL-{max_num + 1}"

    @staticmethod
    async def create_ticket(
        author_id: str,
        author_name: str,
        subject: str,
        description: str,
        book_id: Optional[str] = None
    ) -> Dict[str, Any]:
        book_title = None
        verified_book_id = None

        if book_id:
            if author_id.startswith("admin") or author_id in ["admin_ops", "admin_support"]:
                book = await db.fetch_one(
                    "SELECT external_id, title FROM books WHERE external_id = $1 LIMIT 1",
                    book_id
                )
            else:
                book = await db.fetch_one(
                    "SELECT external_id, title FROM books WHERE external_id = $1 AND author_id = $2 LIMIT 1",
                    book_id, author_id
                )
            if not book:
                raise LookupError("Selected book does not exist or does not belong to this author.")
            verified_book_id = book["external_id"]
            book_title = book["title"]

        ticket_id = await TicketService.get_next_ticket_id()
        now = datetime.now(timezone.utc).isoformat()

        # Insert ticket initially with pending AI status
        await db.execute(
            """INSERT INTO tickets (
                id, subject, description, author_id, book_id, book_title,
                status, priority, category, ai_status, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, 'Open', 'Medium', 'general_inquiry', 'pending', NOW(), NOW())""",
            ticket_id, subject.strip(), description.strip(), author_id, verified_book_id, book_title
        )

        # Initial message
        msg_id = f"msg_{ticket_id}_1"
        await db.execute(
            """INSERT INTO ticket_messages (
                id, ticket_id, sender_name, sender_role, body, is_from_staff, is_internal_note, created_at
            ) VALUES ($1, $2, $3, 'author', $4, false, false, NOW())""",
            msg_id, ticket_id, author_name, description.strip()
        )

        # Audit event
        evt_id = f"evt_{int(datetime.now(timezone.utc).timestamp() * 1000)}"
        await db.execute(
            """INSERT INTO ticket_events (
                id, ticket_id, actor_id, actor_name, event_type, payload, created_at
            ) VALUES ($1, $2, $3, $4, 'ticket.created', $5::jsonb, NOW())""",
            evt_id, ticket_id, author_id, author_name, json.dumps({"book_id": verified_book_id})
        )

        # Background AI triage task
        asyncio.create_task(
            TicketService._classify_ticket_background(ticket_id, author_id, subject.strip(), description.strip(), book_title)
        )

        await event_bus.publish("ticket.created", {
            "ticket_id": ticket_id,
            "author_id": author_id,
            "timestamp": now
        })

        return {
            "id": ticket_id,
            "subject": subject.strip(),
            "description": description.strip(),
            "book_id": verified_book_id,
            "book_title": book_title,
            "status": "Open",
            "priority": "Medium",
            "category": "general_inquiry",
            "created_at": now,
            "updated_at": now,
            "messages": [
                {
                    "id": msg_id,
                    "ticket_id": ticket_id,
                    "sender_name": author_name,
                    "sender_role": "author",
                    "body": description.strip(),
                    "is_from_staff": False,
                    "is_internal_note": False,
                    "created_at": now
                }
            ]
        }

    @staticmethod
    async def _classify_ticket_background(ticket_id: str, author_id: str, subject: str, description: str, book_title: Optional[str]):
        try:
            client = get_llm_client()
            res = client.classify_ticket(subject, description, book_title)
            is_rule_fallback = res.get("badge") == "classified by rules" or res.get("reasoning", "").startswith("Classified by rules")
            ai_status = "failed" if is_rule_fallback else "completed"
            await db.execute(
                """UPDATE tickets SET
                    category = $1,
                    priority = $2,
                    ai_category = $1,
                    ai_priority = $2,
                    ai_reasoning = $3,
                    ai_confidence = $4,
                    ai_status = $5,
                    updated_at = NOW()
                   WHERE id = $6""",
                res["category"], res["priority"], res["reasoning"], res["confidence"], ai_status, ticket_id
            )
            await event_bus.publish("ticket.classified", {
                "ticket_id": ticket_id,
                "author_id": author_id,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
        except Exception:
            pass

    @staticmethod
    async def get_author_tickets(author_id: str, status: Optional[str] = None) -> List[Dict[str, Any]]:
        if author_id.startswith("admin") or author_id in ["admin_ops", "admin_support"]:
            query = """
                SELECT t.id, t.subject, t.status, t.priority, t.category,
                       t.book_id, t.book_title, t.has_unread,
                       TO_CHAR(t.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
                       TO_CHAR(t.updated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at,
                       (SELECT COUNT(*) FROM ticket_messages m WHERE m.ticket_id = t.id AND m.is_internal_note = false) as message_count
                FROM tickets t
                WHERE 1=1
            """
            params: List[Any] = []
        else:
            query = """
                SELECT t.id, t.subject, t.status, t.priority, t.category,
                       t.book_id, t.book_title, t.has_unread,
                       TO_CHAR(t.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
                       TO_CHAR(t.updated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at,
                       (SELECT COUNT(*) FROM ticket_messages m WHERE m.ticket_id = t.id AND m.is_internal_note = false) as message_count
                FROM tickets t
                WHERE t.author_id = $1
            """
            params: List[Any] = [author_id]

        if status and status.lower() != "all":
            norm_status = "In progress" if status.lower() in ["in progress", "in_progress"] else status.capitalize()
            query += " AND LOWER(t.status) = LOWER($2)"
            params.append(norm_status)

        query += " ORDER BY t.updated_at DESC"

        rows = await db.fetch_all(query, *params)
        ticket_ids = [r["id"] for r in rows]
        messages_by_ticket: Dict[str, List[Dict[str, Any]]] = {}
        if ticket_ids:
            msg_rows = await db.fetch_all(
                """SELECT id, ticket_id, sender_name, sender_role, body, is_from_staff,
                          TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at
                   FROM ticket_messages
                   WHERE ticket_id = ANY($1) AND is_internal_note = false
                   ORDER BY created_at ASC""",
                ticket_ids
            )
            for m in msg_rows:
                tid = m["ticket_id"]
                if tid not in messages_by_ticket:
                    messages_by_ticket[tid] = []
                messages_by_ticket[tid].append({
                    "id": m["id"],
                    "ticket_id": tid,
                    "sender_name": "BookLeaf Support" if m.get("is_from_staff") else m["sender_name"],
                    "sender_role": m["sender_role"],
                    "body": m["body"],
                    "created_at": m["created_at"],
                    "is_from_staff": bool(m.get("is_from_staff")),
                    "is_internal_note": False
                })

        return [
            {
                "id": r["id"],
                "subject": r["subject"],
                "status": r["status"],
                # category and priority are internal admin fields; omitted from author view
                "book_id": r.get("book_id"),
                "book_title": r.get("book_title"),
                "has_unread": bool(r.get("has_unread")),
                "message_count": int(r.get("message_count") or 0),
                "created_at": r["created_at"],
                "updated_at": r["updated_at"],
                "messages": messages_by_ticket.get(r["id"], [])
            }
            for r in rows
        ]

    @staticmethod
    async def get_author_ticket_by_id(ticket_id: str, author_id: str) -> Optional[Dict[str, Any]]:
        if author_id.startswith("admin") or author_id in ["admin_ops", "admin_support"]:
            row = await db.fetch_one(
                """SELECT t.id, t.subject, t.description, t.status, t.priority, t.category,
                          t.book_id, t.book_title, t.author_id, u.name as author_name,
                          t.has_unread,
                          TO_CHAR(t.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
                          TO_CHAR(t.updated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at
                   FROM tickets t
                   JOIN users u ON u.id = t.author_id
                   WHERE t.id = $1
                   LIMIT 1""",
                ticket_id
            )
        else:
            row = await db.fetch_one(
                """SELECT t.id, t.subject, t.description, t.status, t.priority, t.category,
                          t.book_id, t.book_title, t.author_id, u.name as author_name,
                          t.has_unread,
                          TO_CHAR(t.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
                          TO_CHAR(t.updated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at
                   FROM tickets t
                   JOIN users u ON u.id = t.author_id
                   WHERE t.id = $1 AND t.author_id = $2
                   LIMIT 1""",
                ticket_id, author_id
            )
        if not row:
            return None

        # Mark unread false
        if row.get("has_unread"):
            await db.execute("UPDATE tickets SET has_unread = false WHERE id = $1", ticket_id)

        msg_rows = await db.fetch_all(
            """SELECT id, sender_name, sender_role, body, is_from_staff,
                      TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at
               FROM ticket_messages
               WHERE ticket_id = $1 AND is_internal_note = false
               ORDER BY created_at ASC""",
            ticket_id
        )

        messages = [
            {
                "id": m["id"],
                "sender_name": "BookLeaf Support" if m.get("is_from_staff") else m["sender_name"],
                "sender_role": m["sender_role"],
                "body": m["body"],
                "is_from_staff": bool(m.get("is_from_staff")),
                "is_internal_note": False,
                "created_at": m["created_at"]
            }
            for m in msg_rows
        ]

        return {
            **dict(row),
            "has_unread": False,
            "messages": messages,
            # Strip internal admin fields from author-facing ticket detail
            "category": None,
            "priority": None,
        }

    @staticmethod
    async def add_author_message(ticket_id: str, author_id: str, author_name: str, body: str) -> Optional[Dict[str, Any]]:
        if author_id.startswith("admin") or author_id in ["admin_ops", "admin_support"]:
            ticket = await db.fetch_one(
                "SELECT id, status FROM tickets WHERE id = $1 LIMIT 1",
                ticket_id
            )
        else:
            ticket = await db.fetch_one(
                "SELECT id, status FROM tickets WHERE id = $1 AND author_id = $2 LIMIT 1",
                ticket_id, author_id
            )
        if not ticket:
            return None

        msg_id = f"msg_{ticket_id}_{int(datetime.now(timezone.utc).timestamp() * 1000)}"
        now = datetime.now(timezone.utc).isoformat()

        await db.execute(
            """INSERT INTO ticket_messages (
                id, ticket_id, sender_name, sender_role, body, is_from_staff, is_internal_note, created_at
            ) VALUES ($1, $2, $3, 'author', $4, false, false, NOW())""",
            msg_id, ticket_id, author_name, body.strip()
        )

        # Reopen if Resolved or Closed
        new_status = ticket["status"]
        if new_status in ["Resolved", "Closed"]:
            new_status = "In progress"

        await db.execute(
            "UPDATE tickets SET status = $1, has_unread = true, updated_at = NOW() WHERE id = $2",
            new_status, ticket_id
        )

        await event_bus.publish("message.created", {
            "ticket_id": ticket_id,
            "author_id": author_id,
            "timestamp": now
        })

        return {
            "id": msg_id,
            "sender_name": author_name,
            "sender_role": "author",
            "body": body.strip(),
            "created_at": now
        }
