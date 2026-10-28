from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field, ConfigDict

class TicketCreate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    book_id: Optional[str] = None
    subject: str = Field(..., min_length=3, max_length=200)
    description: str = Field(..., min_length=10)

class TicketUpdate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    status: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    assignee: Optional[str] = None
    assignee_id: Optional[str] = None

class MessageCreate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    body: str = Field(..., min_length=1)
    from_ai_draft: bool = False
    status: Optional[str] = None

class NoteCreate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    body: str = Field(..., min_length=1)

class DraftGenerateRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    regenerate: Optional[bool] = False

class TicketMessageOut(BaseModel):
    id: str
    ticket_id: Optional[str] = None
    sender_id: Optional[str] = None
    sender_name: str
    sender_role: str
    body: str
    is_from_staff: bool = False
    is_internal_note: bool = False
    from_ai_draft: bool = False
    draft_edited: bool = False
    created_at: str

class TicketNoteOut(BaseModel):
    id: str
    ticket_id: Optional[str] = None
    author_id: str
    author_name: str
    body: str
    created_at: str

class TicketEventOut(BaseModel):
    id: str
    ticket_id: Optional[str] = None
    actor_id: Optional[str] = None
    actor_name: Optional[str] = None
    event_type: str
    payload: Dict[str, Any] = {}
    created_at: str

class TicketOut(BaseModel):
    id: str
    subject: str
    description: Optional[str] = None
    status: str
    priority: Optional[str] = None  # Hidden from author-facing responses
    category: Optional[str] = None  # Hidden from author-facing responses
    book_id: Optional[str] = None
    book_title: Optional[str] = None
    author_id: Optional[str] = None
    author_name: Optional[str] = None
    assignee: Optional[str] = None
    assignee_id: Optional[str] = None
    has_unread: bool = False
    ai_status: Optional[str] = None
    category_overridden: Optional[bool] = False
    priority_overridden: Optional[bool] = False
    message_count: Optional[int] = 0
    created_at: str
    updated_at: str
    messages: Optional[List[TicketMessageOut]] = []

class TicketDetailOut(TicketOut):
    author_email: Optional[str] = None
    bank_name: Optional[str] = None
    account_last4: Optional[str] = None
    ai_category: Optional[str] = None
    ai_priority: Optional[str] = None
    ai_reasoning: Optional[str] = None
    ai_confidence: Optional[float] = None
    ai_draft: Optional[str] = None
    ai_draft_missing_info: Optional[List[str]] = []
    ai_draft_escalation: Optional[bool] = False
    ai_draft_unverified: Optional[List[str]] = []
    messages: List[TicketMessageOut] = []
    notes: Optional[List[TicketNoteOut]] = []
    events: Optional[List[TicketEventOut]] = []
    author_books: Optional[List[Dict[str, Any]]] = []

class TicketListResponse(BaseModel):
    tickets: List[TicketOut]
    total: int

class AdminQueueResponse(BaseModel):
    items: List[TicketOut]
    total: int

class AdminStatsOut(BaseModel):
    total_in_queue: int
    needs_first_reply: int
    near_sla_breach_count: Optional[int] = 0
    awaiting_author: int
    ai_draft_ready: int
    resolved_today: int
    ai_override_rate: int
    sla_compliance_rate: Optional[int] = 100

class StaffUser(BaseModel):
    id: str
    name: str
    email: str
    role: Optional[str] = "admin"
    avatar_initials: Optional[str] = None
    title: Optional[str] = None

class AdminStaffOut(BaseModel):
    staff: List[StaffUser]
