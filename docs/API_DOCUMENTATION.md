# BookLeaf Author Support Portal — API Specification

**Version:** `1.0.0`  
**Protocol:** HTTP/1.1 & HTTP/2 over TLS  
**Base URLs:**  
* **Local Development:** `http://localhost:8000`  
* **Production API:** `https://bookleaf-api.onrender.com`  
* **Interactive OpenAPI (Swagger):** `/docs`  
* **Alternative OpenAPI (ReDoc):** `/redoc`  
* **Machine-Readable OpenAPI 3.1:** `/openapi.json`  

---

## 1. Architecture & Security Conventions

### 1.1 Authentication & Authorization Model
All protected endpoints require an HTTP Bearer JWT token passed in the `Authorization` request header:

```http
Authorization: Bearer <jwt_access_token>
```

Tokens are obtained via `POST /api/v1/auth/login` and signed using HMAC-SHA256 (`HS256`).

* **Token Lifespan:** 24 hours (`exp` claim).
* **Token Claims:**
  * `sub`: User ID (e.g., `AUTH001` or `admin_ops`)
  * `name`: User full display name
  * `email`: User login email
  * `role`: User permission scope (`author` or `admin`)
  * `author_id`: Linked author profile ID (for `author` roles only)

### 1.2 Access Control & Data Isolation Rules
1. **Role-Based Access Control (RBAC):**
   * Endpoints under `/api/v1/me/*` require `role == "author"`. An admin token will receive `403 Forbidden`.
   * Endpoints under `/api/v1/admin/*` require `role == "admin"`. An author token will receive `403 Forbidden`.
   * Missing or invalid tokens on protected routes return `401 Unauthorized`.
2. **Zero-Knowledge Multi-Tenant Isolation:**
   * When an author requests a ticket (`GET /api/v1/me/tickets/{ticket_id}`) that belongs to another author, the API returns `404 Not Found` (never `403 Forbidden`). This prevents ID enumeration and timing probes.
3. **Strict Payload Filtering:**
   * All request bodies are validated with Pydantic v2 configured with `extra='forbid'`. Injecting unauthorized fields (e.g., `author_id`, `status`, or `priority` on creation) triggers a `422 Unprocessable Entity` validation failure.

### 1.3 RFC 7807 Error Schema
All error responses adhere to the standard RFC 7807 Problem Details specification:

```json
{
  "type": "https://bookleaf.pub/errors/validation_error",
  "title": "Unprocessable Entity",
  "status": 422,
  "detail": "Description must be at least 10 characters.",
  "instance": "/api/v1/me/tickets"
}
```

---

## 2. Health & Operational Probes

### 2.1 Service Liveness Probe
Checks if the ASGI HTTP listener and Uvicorn process are active.

```http
GET /health
GET /api/health
```

* **Authentication:** None (Public)
* **Response `200 OK`:**
```json
{
  "status": "healthy",
  "uptime": 234.12,
  "timestamp": "2026-10-26T00:15:00.000000Z"
}
```

### 2.2 Database Readiness Probe
Validates that the async PostgreSQL connection pool (`asyncpg`) can execute queries against Neon PostgreSQL.

```http
GET /health/ready
GET /api/health/ready
```

* **Authentication:** None (Public)
* **Response `200 OK`:**
```json
{
  "status": "ready",
  "database": "connected",
  "pool_size": 10,
  "timestamp": "2026-10-26T00:15:00.000000Z"
}
```
* **Response `503 Service Unavailable`:** Returned if PostgreSQL pool ping times out or credentials fail.

---

## 3. Authentication Endpoints

### 3.1 User Login
Authenticates an author or administrator using email and password.

```http
POST /api/v1/auth/login
```

* **Authentication:** None (Public)
* **Request Body (`application/json`):**
```json
{
  "email": "priya.sharma@email.com",
  "password": "demo"
}
```
* **Response `200 OK`:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 86400,
  "user": {
    "id": "AUTH001",
    "name": "Priya Sharma",
    "email": "priya.sharma@email.com",
    "role": "author",
    "author_id": "AUTH001"
  }
}
```
* **Error Responses:**
  * `401 Unauthorized`: Invalid email or password.
  * `422 Unprocessable Entity`: Missing email or malformed payload.

* **cURL Example:**
```bash
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "priya.sharma@email.com", "password": "demo"}'
```

### 3.2 Current Session Profile
Retrieves authenticated user claims from the token.

```http
GET /api/v1/auth/me
```

* **Authentication:** Bearer Token (Author or Admin)
* **Response `200 OK`:**
```json
{
  "id": "AUTH001",
  "name": "Priya Sharma",
  "email": "priya.sharma@email.com",
  "role": "author",
  "author_id": "AUTH001"
}
```

---

## 4. Author Domain (`/api/v1/me/*`)

These endpoints provide author self-service features for catalog visibility, royalties, and tickets.

### 4.1 Get Author Books & Royalty Ledgers
Returns all titles contracted to the authenticated author, including retail platform distribution links and audited financial balances.

```http
GET /api/v1/me/books
```

* **Authentication:** Bearer Token (`role: author`)
* **Response `200 OK`:**
```json
[
  {
    "id": "BK001",
    "title": "Whispers of the Ganges",
    "subtitle": "A Journey Through Varanasi",
    "status": "Published & Live",
    "isbn": "978-93-5400-101-1",
    "price": 399.00,
    "copies_sold": 450,
    "total_royalty_earned": 12500.00,
    "royalty_paid": 10000.00,
    "royalty_pending": 2500.00,
    "platforms": [
      {
        "platform_name": "Amazon India",
        "url": "https://amazon.in/dp/B08XYZ101",
        "is_active": true
      },
      {
        "platform_name": "Flipkart",
        "url": "https://flipkart.com/book/bk001",
        "is_active": true
      }
    ]
  }
]
```

### 4.2 List Author Support Tickets
Retrieves all support tickets filed by the authenticated author.

```http
GET /api/v1/me/tickets
```

* **Authentication:** Bearer Token (`role: author`)
* **Query Parameters:**
  * `status` *(string, optional)*: Filter by ticket status (`Open`, `In progress`, `Resolved`, `Closed`). Defaults to all.
* **Response `200 OK`:**
```json
[
  {
    "id": "BL-1001",
    "subject": "Missing Q3 royalty payment calculation",
    "status": "In progress",
    "priority": "Medium",
    "category": "royalty_inquiry",
    "book_id": "BK001",
    "book_title": "Whispers of the Ganges",
    "has_unread": false,
    "message_count": 3,
    "created_at": "2026-10-25T14:30:00Z",
    "updated_at": "2026-10-25T15:10:00Z"
  }
]
```

### 4.3 Create New Support Ticket
Submits a new inquiry. The database enforces via composite foreign key that `book_id` belongs to this author.

```http
POST /api/v1/me/tickets
```

* **Authentication:** Bearer Token (`role: author`)
* **Request Body (`application/json`):**
```json
{
  "subject": "Delay in quarterly royalty disbursement",
  "description": "Hello BookLeaf support team, I would like to check when the Q3 royalties for my book will be processed.",
  "book_id": "BK001"
}
```
* **Validation Rules:**
  * `subject`: 5 to 200 characters.
  * `description`: Minimum 10 characters.
  * `book_id`: Optional string; if provided, must exist and be owned by the author.
* **Response `201 Created`:**
```json
{
  "id": "BL-1130",
  "subject": "Delay in quarterly royalty disbursement",
  "description": "Hello BookLeaf support team, I would like to check when the Q3 royalties for my book will be processed.",
  "status": "Open",
  "priority": "Medium",
  "category": "royalty_inquiry",
  "book_id": "BK001",
  "book_title": "Whispers of the Ganges",
  "created_at": "2026-10-26T00:20:00Z",
  "updated_at": "2026-10-26T00:20:00Z",
  "messages": [
    {
      "id": "msg_BL-1130_1",
      "ticket_id": "BL-1130",
      "sender_name": "Priya Sharma",
      "sender_role": "author",
      "body": "Hello BookLeaf support team, I would like to check when the Q3 royalties for my book will be processed.",
      "is_from_staff": false,
      "is_internal_note": false,
      "created_at": "2026-10-26T00:20:00Z"
    }
  ]
}
```

### 4.4 Get Single Ticket & Conversation Thread
Retrieves full details and visible message thread for a ticket.

```http
GET /api/v1/me/tickets/{ticket_id}
```

* **Authentication:** Bearer Token (`role: author`)
* **Path Parameters:**
  * `ticket_id` *(string)*: Ticket identifier (e.g. `BL-1001`).
* **Security Behavior:** If `ticket_id` belongs to another author, returns `404 Not Found`. Internal staff notes (`is_internal_note: true`) are stripped from this view.
* **Response `200 OK`:**
```json
{
  "id": "BL-1001",
  "subject": "Missing Q3 royalty payment calculation",
  "description": "I would like to check my Q3 sales figures...",
  "status": "In progress",
  "priority": "Medium",
  "category": "royalty_inquiry",
  "book_id": "BK001",
  "book_title": "Whispers of the Ganges",
  "has_unread": false,
  "created_at": "2026-10-25T14:30:00Z",
  "updated_at": "2026-10-25T15:10:00Z",
  "messages": [
    {
      "id": "msg_BL-1001_1",
      "sender_name": "Priya Sharma",
      "sender_role": "author",
      "body": "I would like to check my Q3 sales figures...",
      "is_from_staff": false,
      "created_at": "2026-10-25T14:30:00Z"
    },
    {
      "id": "msg_BL-1001_2",
      "sender_name": "BookLeaf Support",
      "sender_role": "support",
      "body": "Dear Priya,\n\nThank you for reaching out regarding your royalties...",
      "is_from_staff": true,
      "created_at": "2026-10-25T15:10:00Z"
    }
  ]
}
```

### 4.5 Post Follow-up Message
Appends a message from the author to the conversation thread.

```http
POST /api/v1/me/tickets/{ticket_id}/messages
```

* **Authentication:** Bearer Token (`role: author`)
* **Request Body (`application/json`):**
```json
{
  "body": "Thank you for the update. Could you please confirm the bank account on file?"
}
```
* **Response `201 Created`:**
```json
{
  "id": "msg_BL-1001_3",
  "ticket_id": "BL-1001",
  "sender_name": "Priya Sharma",
  "sender_role": "author",
  "body": "Thank you for the update. Could you please confirm the bank account on file?",
  "is_from_staff": false,
  "created_at": "2026-10-26T00:25:00Z"
}
```

---

## 5. Admin Domain (`/api/v1/admin/*`)

These endpoints allow publishing staff to triage, prioritize, reassign, and respond to author tickets.

### 5.1 Operational Queue Metrics
Returns real-time KPI counter cards for queue management.

```http
GET /api/v1/admin/stats
GET /api/v1/admin/metrics
```

* **Authentication:** Bearer Token (`role: admin`)
* **Response `200 OK`:**
```json
{
  "total_in_queue": 14,
  "needs_first_reply": 6,
  "critical_escalations": 2,
  "resolved_today": 8,
  "avg_first_response_hours": 3.2
}
```

### 5.2 List All Support Tickets (Triage Queue)
Returns the global ticket queue with multi-field filtering and urgency sorting.

```http
GET /api/v1/admin/tickets
```

* **Authentication:** Bearer Token (`role: admin`)
* **Query Parameters:**
  * `status` *(string, optional)*: Filter by `Open`, `In progress`, `Resolved`, `Closed`, or `all`.
  * `priority` *(string, optional)*: Filter by `Critical`, `High`, `Medium`, `Low`.
  * `category` *(string, optional)*: Filter by issue classification.
  * `assignee` *(string, optional)*: Filter by assigned staff name.
  * `search` *(string, optional)*: Text search across subject, author name, or ticket ID.
* **Response `200 OK`:**
```json
[
  {
    "id": "BL-1001",
    "subject": "Missing Q3 royalty payment calculation",
    "author_id": "AUTH001",
    "author_name": "Priya Sharma",
    "status": "In progress",
    "priority": "Medium",
    "category": "royalty_inquiry",
    "assignee": "Ops Admin",
    "book_id": "BK001",
    "book_title": "Whispers of the Ganges",
    "has_unread": false,
    "ai_draft": "Dear Priya,\n\nWe have reviewed your Q3 earnings...",
    "created_at": "2026-10-25T14:30:00Z",
    "updated_at": "2026-10-25T15:10:00Z"
  }
]
```

### 5.3 Get Admin Ticket Detail
Retrieves full ticket context including internal staff notes, AI classification confidence, reasoning, and suggested drafts.

```http
GET /api/v1/admin/tickets/{ticket_id}
```

* **Authentication:** Bearer Token (`role: admin`)
* **Response `200 OK`:**
```json
{
  "id": "BL-1001",
  "subject": "Missing Q3 royalty payment calculation",
  "author_id": "AUTH001",
  "author_name": "Priya Sharma",
  "author_email": "priya.sharma@email.com",
  "status": "In progress",
  "priority": "Medium",
  "category": "royalty_inquiry",
  "assignee": "Ops Admin",
  "book_id": "BK001",
  "book_title": "Whispers of the Ganges",
  "ai_status": "completed",
  "ai_category": "royalty_inquiry",
  "ai_priority": "Medium",
  "ai_confidence": 0.94,
  "ai_reasoning": "Author questions Q3 royalty schedule. Account shows ₹3,570 pending balance exceeding the ₹1,000 threshold.",
  "ai_draft": "Dear Priya,\n\nThank you for reaching out to BookLeaf Support...",
  "messages": [
    {
      "id": "msg_BL-1001_1",
      "sender_name": "Priya Sharma",
      "sender_role": "author",
      "body": "I would like to check my Q3 sales figures...",
      "is_internal_note": false,
      "created_at": "2026-10-25T14:30:00Z"
    },
    {
      "id": "msg_BL-1001_note_1",
      "sender_name": "Support Lead",
      "sender_role": "admin",
      "body": "Verified NEFT transaction batch pending finance signoff.",
      "is_internal_note": true,
      "created_at": "2026-10-25T14:45:00Z"
    }
  ]
}
```

### 5.4 Update Ticket Status or Assignee
Modifies the operational lifecycle state or assigns a support agent.

```http
PATCH /api/v1/admin/tickets/{ticket_id}
```

* **Authentication:** Bearer Token (`role: admin`)
* **Request Body (`application/json`):**
```json
{
  "status": "Resolved",
  "assignee": "Support Lead",
  "priority": "High"
}
```
* **Allowed Values:**
  * `status`: `"Open"`, `"In progress"`, `"Resolved"`, `"Closed"`.
  * `priority`: `"Critical"`, `"High"`, `"Medium"`, `"Low"`.
* **Response `200 OK`:** Returns updated ticket object.

### 5.5 Post Staff Reply or Private Internal Note
Sends an official reply to the author or logs a staff-only internal note.

```http
POST /api/v1/admin/tickets/{ticket_id}/messages
POST /api/v1/admin/tickets/{ticket_id}/notes
```

* **Authentication:** Bearer Token (`role: admin`)
* **Request Body (`application/json`):**
```json
{
  "body": "Dear Priya,\n\nYour Q3 royalty disbursement of ₹3,570.00 has been approved and scheduled for transfer.",
  "is_internal_note": false
}
```
* **State Behavior:**
  * If `is_internal_note == false` on an `Open` ticket, status automatically transitions to `In progress`, decrementing the `needs_first_reply` KPI counter.
  * Internal notes (`is_internal_note: true`) do NOT bump public `updated_at` timestamps or trigger author notifications.

### 5.6 Generate / Regenerate AI Response Draft
Calls AWS Bedrock Mantle on demand to synthesize a policy-grounded draft response.

```http
POST /api/v1/admin/tickets/{ticket_id}/draft
```

* **Authentication:** Bearer Token (`role: admin`)
* **Query Parameters:**
  * `regenerate` *(boolean, optional, default: false)*: Force a fresh inference request if an existing draft is cached.
* **Response `200 OK`:**
```json
{
  "ticket_id": "BL-1001",
  "draft": "Dear Priya,\n\nThank you for reaching out regarding your royalties for 'Whispers of the Ganges'...\n\nWarm regards,\nBookLeaf Publishing Team",
  "source": "bedrock:minimax.minimax-m2.5",
  "unverified_figures": false,
  "confidence": 0.94
}
```

---

## 6. Real-Time Server-Sent Events (SSE)

Clients establish unidirectional streaming connections over standard HTTP to receive real-time ticket doorbell events without polling.

```http
GET /api/v1/me/stream
GET /api/v1/admin/stream
```

* **Authentication:** Query parameter `?token=<jwt_access_token>` or Bearer header.
* **Headers:** `Content-Type: text/event-stream`, `Cache-Control: no-cache`
* **Event Payload Structure:**
```
event: ticket.message_added
data: {"ticket_id": "BL-1001", "sender_role": "support", "timestamp": "2026-10-26T00:30:00Z"}

event: ticket.status_changed
data: {"ticket_id": "BL-1001", "old_status": "Open", "new_status": "In progress"}
```

---

## 7. Data Models & Schemas

### 7.1 Author Model
```json
{
  "id": "AUTH001",
  "name": "Priya Sharma",
  "email": "priya.sharma@email.com",
  "phone": "+91-98765-43210",
  "city": "Mumbai",
  "joined_date": "2023-03-15"
}
```

### 7.2 Book Model
```json
{
  "id": "BK001",
  "author_id": "AUTH001",
  "title": "Whispers of the Ganges",
  "status": "Published & Live",
  "isbn": "978-93-5400-101-1",
  "total_royalty_earned": 12500.00,
  "royalty_paid": 10000.00,
  "royalty_pending": 2500.00
}
```

### 7.3 Ticket Model
```json
{
  "id": "BL-1001",
  "author_id": "AUTH001",
  "book_id": "BK001",
  "subject": "Missing Q3 royalty payment calculation",
  "status": "In progress",
  "priority": "Medium",
  "category": "royalty_inquiry",
  "ai_status": "completed",
  "ai_draft": "string",
  "created_at": "ISO 8601 string",
  "updated_at": "ISO 8601 string"
}
```
