import json
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from app.db.session import db
from app.ai.llm import get_llm_client
from app.ai.guards import build_facts_block
from app.services.book_service import BookService
from app.services.event_bus import event_bus

class AdminTicketService:
    @staticmethod
    async def get_queue(
        status: Optional[str] = None,
        category: Optional[str] = None,
        priority: Optional[str] = None,
        assignee: Optional[str] = None,
        q: Optional[str] = None,
        sort: str = "urgency"
    ) -> List[Dict[str, Any]]:
        query = """
            SELECT t.id, t.subject, t.description, t.status, t.priority, t.category,
                   t.ai_status, t.category_overridden, t.priority_overridden,
                   t.book_id, t.book_title, t.author_id, u.name as author_name,
                   t.assignee, t.assignee_id, t.has_unread,
                   TO_CHAR(t.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
                   TO_CHAR(t.updated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at
            FROM tickets t
            JOIN users u ON u.id = t.author_id
            WHERE 1=1
        """
        params: List[Any] = []
        p_idx = 1

        if status and status.lower() != "all":
            query += f" AND LOWER(t.status) = LOWER(${p_idx})"
            params.append(status)
            p_idx += 1

        if category and category.lower() != "all":
            query += f" AND LOWER(t.category) = LOWER(${p_idx})"
            params.append(category)
            p_idx += 1

        if priority and priority.lower() != "all":
            query += f" AND LOWER(t.priority) = LOWER(${p_idx})"
            params.append(priority)
            p_idx += 1

        if assignee and assignee.lower() != "all":
            if assignee.lower() == "unassigned":
                query += " AND (t.assignee IS NULL OR t.assignee = '')"
            else:
                query += f" AND (t.assignee = ${p_idx} OR t.assignee_id = ${p_idx})"
                params.append(assignee)
                p_idx += 1

        if q and q.strip():
            search = f"%{q.strip().lower()}%"
            query += f" AND (LOWER(t.subject) LIKE ${p_idx} OR LOWER(t.description) LIKE ${p_idx} OR LOWER(u.name) LIKE ${p_idx} OR LOWER(t.id) LIKE ${p_idx})"
            params.append(search)
            p_idx += 1

        if sort == "newest":
            query += " ORDER BY t.created_at DESC"
        elif sort == "oldest":
            query += " ORDER BY t.created_at ASC"
        else:
            # Urgency ordering: Unresolved first, then Critical -> High -> Medium -> Low, then oldest first
            query += """
                ORDER BY
                    CASE WHEN t.status IN ('Resolved', 'Closed') THEN 2 ELSE 1 END,
                    CASE t.priority
                        WHEN 'Critical' THEN 1
                        WHEN 'High' THEN 2
                        WHEN 'Medium' THEN 3
                        WHEN 'Low' THEN 4
                        ELSE 5
                    END ASC,
                    t.created_at ASC
            """

        rows = await db.fetch_all(query, *params)
        return [
            {
                "id": r["id"],
                "subject": r["subject"],
                "description": r["description"],
                "status": r["status"],
                "priority": r["priority"],
                "category": r["category"],
                "ai_status": r.get("ai_status"),
                "category_overridden": bool(r.get("category_overridden")),
                "priority_overridden": bool(r.get("priority_overridden")),
                "book_id": r.get("book_id"),
                "book_title": r.get("book_title"),
                "author_id": r.get("author_id"),
                "author_name": r.get("author_name"),
                "assignee": r.get("assignee"),
                "assignee_id": r.get("assignee_id"),
                "has_unread": bool(r.get("has_unread")),
                "created_at": r["created_at"],
                "updated_at": r["updated_at"]
            }
            for r in rows
        ]

    @staticmethod
    async def get_ticket_by_id(ticket_id: str) -> Optional[Dict[str, Any]]:
        row = await db.fetch_one(
            """SELECT t.*, u.name as author_name, u.email as author_email,
                      u.bank_name, u.account_last4,
                      TO_CHAR(t.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at_fmt,
                      TO_CHAR(t.updated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at_fmt
               FROM tickets t
               JOIN users u ON u.id = t.author_id
               WHERE t.id = $1
               LIMIT 1""",
            ticket_id
        )
        if not row:
            return None

        # Messages
        msg_rows = await db.fetch_all(
            """SELECT id, ticket_id, sender_id, sender_name, sender_role, body,
                      is_from_staff, is_internal_note, from_ai_draft, draft_edited,
                      TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at
               FROM ticket_messages
               WHERE ticket_id = $1
               ORDER BY created_at ASC""",
            ticket_id
        )

        # Notes
        note_rows = await db.fetch_all(
            """SELECT id, ticket_id, author_id, author_name, body,
                      TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at
               FROM ticket_notes
               WHERE ticket_id = $1
               ORDER BY created_at ASC""",
            ticket_id
        )

        # Events
        event_rows = await db.fetch_all(
            """SELECT id, ticket_id, actor_id, actor_name, event_type, payload,
                      TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at
               FROM ticket_events
               WHERE ticket_id = $1
               ORDER BY created_at DESC""",
            ticket_id
        )

        # Author books
        author_books = await BookService.get_books_by_author(row["author_id"])

        missing_info = row.get("ai_draft_missing_info")
        if isinstance(missing_info, str):
            try:
                missing_info = json.loads(missing_info)
            except Exception:
                missing_info = []

        unverified = row.get("ai_draft_unverified")
        if isinstance(unverified, str):
            try:
                unverified = json.loads(unverified)
            except Exception:
                unverified = []

        return {
            "id": row["id"],
            "subject": row["subject"],
            "description": row["description"],
            "status": row["status"],
            "priority": row["priority"],
            "category": row["category"],
            "book_id": row.get("book_id"),
            "book_title": row.get("book_title"),
            "author_id": row["author_id"],
            "author_name": row["author_name"],
            "author_email": row["author_email"],
            "bank_name": row.get("bank_name"),
            "account_last4": row.get("account_last4"),
            "ai_status": row.get("ai_status"),
            "ai_category": row.get("ai_category"),
            "ai_priority": row.get("ai_priority"),
            "ai_reasoning": row.get("ai_reasoning"),
            "ai_confidence": float(row["ai_confidence"]) if row.get("ai_confidence") is not None else None,
            "ai_draft": row.get("ai_draft"),
            "ai_draft_missing_info": missing_info or [],
            "ai_draft_escalation": bool(row.get("ai_draft_escalation")),
            "ai_draft_unverified": unverified or [],
            "category_overridden": bool(row.get("category_overridden")),
            "priority_overridden": bool(row.get("priority_overridden")),
            "assignee": row.get("assignee"),
            "assignee_id": row.get("assignee_id"),
            "has_unread": bool(row.get("has_unread")),
            "created_at": row["created_at_fmt"],
            "updated_at": row["updated_at_fmt"],
            "messages": [
                {
                    "id": m["id"],
                    "ticket_id": m.get("ticket_id"),
                    "sender_id": m.get("sender_id"),
                    "sender_name": m["sender_name"],
                    "sender_role": m["sender_role"],
                    "body": m["body"],
                    "is_from_staff": bool(m.get("is_from_staff")),
                    "is_internal_note": bool(m.get("is_internal_note")),
                    "from_ai_draft": bool(m.get("from_ai_draft")),
                    "draft_edited": bool(m.get("draft_edited")),
                    "created_at": m["created_at"]
                }
                for m in msg_rows
            ],
            "notes": [
                {
                    "id": n["id"],
                    "ticket_id": n.get("ticket_id"),
                    "author_id": n["author_id"],
                    "author_name": n["author_name"],
                    "body": n["body"],
                    "created_at": n["created_at"]
                }
                for n in note_rows
            ],
            "events": [
                {
                    "id": e["id"],
                    "ticket_id": e.get("ticket_id"),
                    "actor_id": e.get("actor_id"),
                    "actor_name": e.get("actor_name"),
                    "event_type": e["event_type"],
                    "payload": json.loads(e["payload"]) if isinstance(e.get("payload"), str) else (e.get("payload") or {}),
                    "created_at": e["created_at"]
                }
                for e in event_rows
            ],
            "author_books": author_books
        }

    @staticmethod
    async def update_ticket(
        ticket_id: str,
        updates: Dict[str, Any],
        admin_id: str,
        admin_name: str
    ) -> Optional[Dict[str, Any]]:
        existing = await db.fetch_one("SELECT * FROM tickets WHERE id = $1 LIMIT 1", ticket_id)
        if not existing:
            return None

        fields: List[str] = []
        params: List[Any] = []
        p_idx = 1

        cat_overridden = existing.get("category_overridden", False)
        pri_overridden = existing.get("priority_overridden", False)

        if "status" in updates and updates["status"] is not None:
            fields.append(f"status = ${p_idx}")
            params.append(updates["status"])
            p_idx += 1

        if "category" in updates and updates["category"] is not None:
            fields.append(f"category = ${p_idx}")
            params.append(updates["category"])
            p_idx += 1
            if existing.get("ai_category") and updates["category"] != existing["ai_category"]:
                cat_overridden = True

        if "priority" in updates and updates["priority"] is not None:
            fields.append(f"priority = ${p_idx}")
            params.append(updates["priority"])
            p_idx += 1
            if existing.get("ai_priority") and updates["priority"] != existing["ai_priority"]:
                pri_overridden = True

        if "assignee" in updates:
            fields.append(f"assignee = ${p_idx}")
            params.append(updates["assignee"])
            p_idx += 1

        if "assignee_id" in updates:
            fields.append(f"assignee_id = ${p_idx}")
            params.append(updates["assignee_id"])
            p_idx += 1

        if "ai_category" in updates:
            fields.append(f"ai_category = ${p_idx}")
            params.append(updates["ai_category"])
            p_idx += 1

        if "ai_priority" in updates:
            fields.append(f"ai_priority = ${p_idx}")
            params.append(updates["ai_priority"])
            p_idx += 1

        if "ai_reasoning" in updates:
            fields.append(f"ai_reasoning = ${p_idx}")
            params.append(updates["ai_reasoning"])
            p_idx += 1

        if "ai_confidence" in updates:
            fields.append(f"ai_confidence = ${p_idx}")
            params.append(updates["ai_confidence"])
            p_idx += 1

        if "ai_status" in updates:
            fields.append(f"ai_status = ${p_idx}")
            params.append(updates["ai_status"])
            p_idx += 1

        fields.append(f"category_overridden = ${p_idx}")
        params.append(cat_overridden)
        p_idx += 1

        fields.append(f"priority_overridden = ${p_idx}")
        params.append(pri_overridden)
        p_idx += 1

        fields.append("updated_at = NOW()")

        params.append(ticket_id)
        update_sql = f"UPDATE tickets SET {', '.join(fields)} WHERE id = ${p_idx}"
        await db.execute(update_sql, *params)

        # Audit event
        evt_id = f"evt_{int(datetime.now(timezone.utc).timestamp() * 1000)}"
        await db.execute(
            """INSERT INTO ticket_events (id, ticket_id, actor_id, actor_name, event_type, payload, created_at)
               VALUES ($1, $2, $3, $4, 'ticket.updated', $5::jsonb, NOW())""",
            evt_id, ticket_id, admin_id, admin_name, json.dumps(updates)
        )

        await event_bus.publish("ticket.updated", {
            "ticket_id": ticket_id,
            "author_id": existing["author_id"],
            "timestamp": datetime.now(timezone.utc).isoformat()
        })

        return await AdminTicketService.get_ticket_by_id(ticket_id)

    @staticmethod
    async def add_admin_message(
        ticket_id: str,
        admin_id: str,
        admin_name: str,
        body: str,
        from_ai_draft: bool = False,
        status: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        ticket = await db.fetch_one("SELECT * FROM tickets WHERE id = $1 LIMIT 1", ticket_id)
        if not ticket:
            return None

        draft_edited = False
        if from_ai_draft and ticket.get("ai_draft"):
            draft_edited = ticket["ai_draft"].strip() != body.strip()

        msg_id = f"msg_{ticket_id}_{int(datetime.now(timezone.utc).timestamp() * 1000)}"
        now = datetime.now(timezone.utc).isoformat()

        await db.execute(
            """INSERT INTO ticket_messages (
                id, ticket_id, sender_id, sender_name, sender_role, body,
                is_from_staff, is_internal_note, from_ai_draft, draft_edited, created_at
            ) VALUES ($1, $2, $3, $4, 'support', $5, true, false, $6, $7, NOW())""",
            msg_id, ticket_id, admin_id, admin_name, body.strip(), from_ai_draft, draft_edited
        )

        target_status = status or ("In progress" if ticket["status"] == "Open" else ticket["status"])

        await db.execute(
            "UPDATE tickets SET status = $1, has_unread = true, updated_at = NOW() WHERE id = $2",
            target_status, ticket_id
        )

        evt_id = f"evt_{int(datetime.now(timezone.utc).timestamp() * 1000)}"
        await db.execute(
            """INSERT INTO ticket_events (id, ticket_id, actor_id, actor_name, event_type, payload, created_at)
               VALUES ($1, $2, $3, $4, 'message.created', $5::jsonb, NOW())""",
            evt_id, ticket_id, admin_id, admin_name,
            json.dumps({"from_ai_draft": from_ai_draft, "draft_edited": draft_edited, "status": target_status})
        )

        await event_bus.publish("message.created", {
            "ticket_id": ticket_id,
            "author_id": ticket["author_id"],
            "timestamp": now
        })

        return {
            "id": msg_id,
            "sender_name": admin_name,
            "sender_role": "support",
            "body": body.strip(),
            "created_at": now
        }

    @staticmethod
    async def add_admin_note(
        ticket_id: str,
        admin_id: str,
        admin_name: str,
        body: str
    ) -> Optional[Dict[str, Any]]:
        note_id = f"note_{ticket_id}_{int(datetime.now(timezone.utc).timestamp() * 1000)}"
        now = datetime.now(timezone.utc).isoformat()

        await db.execute(
            """INSERT INTO ticket_notes (id, ticket_id, author_id, author_name, body, created_at)
               VALUES ($1, $2, $3, $4, $5, NOW())""",
            note_id, ticket_id, admin_id, admin_name, body.strip()
        )

        await db.execute(
            """INSERT INTO ticket_messages (
                id, ticket_id, sender_id, sender_name, sender_role, body,
                is_from_staff, is_internal_note, created_at
            ) VALUES ($1, $2, $3, $4, 'admin', $5, true, true, NOW())""",
            note_id, ticket_id, admin_id, admin_name, body.strip()
        )

        evt_id = f"evt_{int(datetime.now(timezone.utc).timestamp() * 1000)}"
        await db.execute(
            """INSERT INTO ticket_events (id, ticket_id, actor_id, actor_name, event_type, payload, created_at)
               VALUES ($1, $2, $3, $4, 'note.created', '{}'::jsonb, NOW())""",
            evt_id, ticket_id, admin_id, admin_name
        )

        return {
            "id": note_id,
            "author_id": admin_id,
            "author_name": admin_name,
            "body": body.strip(),
            "created_at": now
        }

    @staticmethod
    async def get_or_generate_draft(ticket_id: str, regenerate: bool = False) -> Optional[Dict[str, Any]]:
        ticket = await db.fetch_one(
            """SELECT t.*, u.name as author_name, u.email as author_email,
                      u.bank_name, u.account_last4
               FROM tickets t
               JOIN users u ON u.id = t.author_id
               WHERE t.id = $1 LIMIT 1""",
            ticket_id
        )
        if not ticket:
            return None

        if ticket.get("ai_draft") and not regenerate:
            missing_info = ticket.get("ai_draft_missing_info")
            if isinstance(missing_info, str):
                try:
                    missing_info = json.loads(missing_info)
                except Exception:
                    missing_info = []

            unverified = ticket.get("ai_draft_unverified")
            if isinstance(unverified, str):
                try:
                    unverified = json.loads(unverified)
                except Exception:
                    unverified = []

            return {
                "body": ticket["ai_draft"],
                "missing_info": missing_info or [],
                "escalation_recommended": bool(ticket.get("ai_draft_escalation")),
                "unverified_figures": unverified or [],
                "cached": True
            }

        author_books = await BookService.get_books_by_author(ticket["author_id"])
        selected_book = next((b for b in author_books if b["external_id"] == ticket.get("book_id")), None)

        facts_text = build_facts_block(
            {
                "id": ticket["author_id"],
                "name": ticket["author_name"],
                "email": ticket["author_email"],
                "bank_name": ticket.get("bank_name"),
                "account_last4": ticket.get("account_last4")
            },
            selected_book,
            author_books
        )

        client = get_llm_client()
        draft_res = client.generate_draft(
            category=ticket.get("category", "general_inquiry"),
            subject=ticket["subject"],
            description=ticket["description"],
            author_name=ticket["author_name"],
            facts_text=facts_text
        )

        await db.execute(
            """UPDATE tickets SET
                ai_draft = $1,
                ai_draft_missing_info = $2::jsonb,
                ai_draft_escalation = $3,
                ai_draft_unverified = $4::jsonb,
                updated_at = NOW()
               WHERE id = $5""",
            draft_res["body"],
            json.dumps(draft_res["missing_info"]),
            draft_res["escalation_recommended"],
            json.dumps(draft_res["unverified_figures"]),
            ticket_id
        )

        return {
            "body": draft_res["body"],
            "missing_info": draft_res["missing_info"],
            "escalation_recommended": draft_res["escalation_recommended"],
            "unverified_figures": draft_res["unverified_figures"],
            "cached": False
        }

    @staticmethod
    async def get_stats() -> Dict[str, Any]:
        row = await db.fetch_one(
            """SELECT
                COUNT(*) as total_in_queue,
                COUNT(*) FILTER (WHERE status = 'Open') as needs_reply,
                COUNT(*) FILTER (WHERE status = 'Open' AND created_at < NOW() - INTERVAL '36 hours') as near_sla_breach_count,
                COUNT(*) FILTER (WHERE status = 'In progress') as awaiting_author,
                COUNT(*) FILTER (WHERE ai_draft IS NOT NULL) as ai_draft_ready,
                COUNT(*) FILTER (WHERE status = 'Resolved' AND updated_at >= CURRENT_DATE) as resolved_today,
                COUNT(*) FILTER (WHERE status = 'Resolved' AND (updated_at - created_at) <= INTERVAL '48 hours') as sla_compliant,
                COUNT(*) FILTER (WHERE status = 'Resolved') as total_resolved,
                COUNT(*) FILTER (WHERE category_overridden = true OR priority_overridden = true) as total_overridden,
                COUNT(*) FILTER (WHERE ai_status = 'completed') as total_ai_processed
            FROM tickets"""
        )
        c = row or {}
        total_processed = int(c.get("total_ai_processed") or 1)
        overridden = int(c.get("total_overridden") or 0)
        override_rate = round((overridden / max(1, total_processed)) * 100)
        total_resolved = int(c.get("total_resolved") or 0)
        sla_compliant = int(c.get("sla_compliant") or 0)
        sla_compliance_rate = round((sla_compliant / max(1, total_resolved)) * 100) if total_resolved > 0 else 100

        return {
            "total_in_queue": int(c.get("total_in_queue") or 0),
            "needs_first_reply": int(c.get("needs_reply") or 0),
            "near_sla_breach_count": int(c.get("near_sla_breach_count") or 0),
            "awaiting_author": int(c.get("awaiting_author") or 0),
            "ai_draft_ready": int(c.get("ai_draft_ready") or 0),
            "resolved_today": int(c.get("resolved_today") or 0),
            "ai_override_rate": override_rate,
            "sla_compliance_rate": sla_compliance_rate
        }

    @staticmethod
    async def get_staff() -> List[Dict[str, Any]]:
        rows = await db.fetch_all(
            "SELECT id, name, email, role, avatar_initials, title FROM users WHERE role = 'admin' ORDER BY name ASC"
        )
        return [dict(r) for r in rows]
