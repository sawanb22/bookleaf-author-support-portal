# BookLeaf Author Support Portal

A production-grade, full-stack Author Support Portal and AI-assisted Admin Triage System built for BookLeaf Publishing, unifying real-time support ticketing, relational royalty accounting, and policy-grounded LLM response assistance.

* **Frontend Application**: [http://localhost:3000](http://localhost:3000) *(Production: [https://bookleaf-portal.vercel.app](https://bookleaf-portal.vercel.app))*
* **Backend API**: [http://localhost:8000](http://localhost:8000) *(Production: [https://bookleaf-api.onrender.com](https://bookleaf-api.onrender.com))*
* **Interactive API Docs (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs) *(ReDoc: [http://localhost:8000/redoc](http://localhost:8000/redoc))*

---

## 1. Demo Logins

All accounts use the password **`demo`** (hashed using Argon2id).

| Role | Name | Email (Login) | Test Scenario & Persona Focus |
| :--- | :--- | :--- | :--- |
| **Author** | Priya Sharma (`AUTH001`) | `priya.sharma@email.com` | 2 live books (*The Saffron Diaries*, *Whispers of the Ganges*). Payout eligible: ₹19,908 earned, ₹16,338 paid, ₹3,570 pending. |
| **Author** | Kavita Deshmukh (`AUTH009`) | `kavita.deshmukh@email.com` | 1 live book + 1 in Typesetting (*Raising Roots*). ₹850 pending triggers automated ₹1,000 threshold roll-over policy. |
| **Admin** | Ops Admin | `ops.admin@bookleaf.demo` | Operations staff: Complete triage queue, urgent escalations, ticket reassignment, and status management. |
| **Admin** | Support Lead | `support.lead@bookleaf.demo` | Support lead: Operational KPI counters, AI draft review/editing, and internal staff notes. |

> **Note on All Seeded Authors**: 10 canonical author accounts (`AUTH001`–`AUTH010`, e.g., `rohit.kapoor@email.com`, `sneha.kulkarni@email.com`) are fully seeded with their books, retail channels, and royalty balances. Password for all accounts is `demo`.
> 
> **Cold Starts**: On free-tier cloud hosting (Render / Neon serverless compute suspend), the backend may require ~45–60 seconds to spin up on the initial request. Subsequent requests are immediate.

---

## 2. What It Does

1. **Author Catalog & Royalties**: Authors inspect retail links across Amazon India, Flipkart, Kindle, Google Books, and track live royalties where `Earned - Paid == Pending`.
2. **Contextual Ticket Filing**: Authors file support inquiries linked strictly to their contracted books across Royalties, Distribution, Author Copies, and Production.
3. **Synchronized Conversation Thread**: Authors and staff communicate in real time with Server-Sent Events (SSE) and zero page reloads.
4. **Admin Triage & Priority Desk**: Support staff prioritize tickets via operational KPI cards (`Needs First Reply`, `Critical Escalations`), priority glyphs, and assignee filters.
5. **AI Assistant & Response Drafts**: An LLM agent triages tickets asynchronously, enforcing priority floors and synthesizing grounded draft responses for 1-click staff review.

### Interface Overview

![Author Portal](docs/screenshots/01-author-portal.png)
*Author Portal: Live retail availability, publishing milestones, and transparent royalty ledger.*

![Admin Triage Queue](docs/screenshots/02-admin-triage.png)
*Admin Triage: Real-time operational KPI counters, priority badges, and status filters.*

![AI Response Assistant](docs/screenshots/03-ai-assist.png)
*AI Suggested Response: Contextually synthesized, fact-checked draft ready for administrative editing.*

---

## 3. Architecture

```mermaid
flowchart TD
    subgraph Client ["Client Layer (Next.js 14 — Port 3000)"]
        AuthorUI["Author Portal (App Router)"]
        AdminUI["Admin Triage Desk (App Router)"]
    end

    subgraph Backend ["Backend API Service (FastAPI — Port 8000)"]
        API["ASGI Routing & Pydantic Validation"]
        AuthModule["RBAC & Argon2id Security"]
        TriageEngine["Triage Engine & Safety Guardrails"]
        EventBus["Internal Event Bus & SSE Stream"]
    end

    subgraph DataAI ["Data & Inference Layer"]
        DB[(Neon Serverless PostgreSQL)]
        Bedrock["AWS Bedrock Mantle (MiniMax M2.5)"]
    end

    AuthorUI -->|REST + Bearer JWT| API
    AdminUI -->|REST + Bearer JWT| API
    AuthorUI -.->|Server-Sent Events| EventBus
    AdminUI -.->|Server-Sent Events| EventBus

    API --> AuthModule
    API --> TriageEngine
    API --> EventBus

    API -->|asyncpg connection pool| DB
    TriageEngine -->|Direct Mantle Chat API| Bedrock
```

### Core Architectural Decisions & Interview Defenses

Full decision defenses are detailed in [Architectural Decision Records (`DECISIONS.md`)](DECISIONS.md):

1. **Database-Enforced Financial Invariants vs. Application Code**:
   * *Decision*: The constraint `chk_royalty_balance` (`total_royalty_earned - royalty_paid = royalty_pending`) is enforced directly in PostgreSQL schema.
   * *Interview Defense*: Application validation can fail under race conditions or bugs. Placing the invariant at the storage engine level guarantees ledger integrity regardless of the API caller.
2. **Multi-Tenant Data Isolation (404 Not Found vs. 403 Forbidden)**:
   * *Decision*: Querying another author's ticket returns `404 Not Found`, never `403 Forbidden`.
   * *Interview Defense*: Returning 403 leaks that a private resource exists, enabling ID enumeration and timing attacks. 404 maintains strict zero-knowledge isolation.
3. **In-Context Policy Injection vs. Vector RAG**:
   * *Decision*: The entire BookLeaf policy (~1,500 tokens) is injected directly into the LLM system prompt without vector search.
   * *Interview Defense*: RAG introduces chunk truncation, similarity threshold tuning, and retrieval latency. Because our operational policy is compact, direct injection achieves 100% recall, 0ms retrieval latency, and zero chunk hallucinations at < $0.0008 per ticket.
4. **Deterministic Priority Floors & Circuit Breakers**:
   * *Decision*: Hardcoded regex keyword rules override LLM priority predictions for legal threats and multi-quarter payout delays. A circuit breaker trips after 5 downstream failures.
   * *Interview Defense*: LLMs should assist staff, not govern legal or financial risk. If an author mentions court action, priority must be Critical 100% of the time. The circuit breaker protects API latency during provider outages.
5. **Composite Foreign Key Authorization Boundary**:
   * *Decision*: Database foreign key `tickets_book_owner_fk` spans `(book_id, author_id)`.
   * *Interview Defense*: Enforces relational tenant boundaries in SQL, preventing Insecure Direct Object Reference (IDOR) attacks even if client payloads are forged.

---

## 4. AI Integration

* **Model**: **MiniMax M2.5** (`minimax.minimax-m2.5`) via AWS Bedrock Mantle Endpoint.
* **Selection Rationale**: Strong comprehension of Indian publishing context and financial terms (NEFT, royalty schedules), reliable structured JSON output compliance, and automatic isolation of `<think>...</think>` reasoning tokens before schema validation.

### Knowledge Base & Prompt Strategy (Why No RAG?)
* **In-Context Injection**: Compact ~1,500 token knowledge base injected directly with live author ledger facts.
* **Structured Response Formatting**: The system prompt deterministically formats responses into 5 paragraphs separated by double-newlines (`\n\n`): formal salutation, empathetic context, factual ledger breakdown, next steps/timeline, and publishing team sign-off.

### Cost & Real Token Consumption
* **Triage (Classification)**: ~650 input tokens, ~85 output tokens (~**$0.00022 USD**).
* **Draft Generation**: ~1,450 input tokens, ~280 output tokens (~**$0.00052 USD**).
* **Total Lifecycle Cost**: < **$0.0008 USD** per ticket.
* **Token-Saving UI**: Drafts are cached in PostgreSQL `tickets.ai_draft` and React state. Clicking **"Hide Draft"** collapses the assist box; expanding it with **"View Suggested Response"** costs **0 tokens and 0 API calls**.

### Error Handling & Guardrails
* **Circuit Breaker**: Trips after 5 consecutive Bedrock errors for 60s, instantly routing requests to local rule-based triage.
* **Timeouts**: 30s classification SLA, 45s draft generation SLA.
* **Priority Floors**:
  * Legal escalation / court / lawyer $\rightarrow$ **Critical** (deterministic override).
  * Two or more overdue quarterly royalty payout cycles $\rightarrow$ **Critical**.
  * Damaged author copies / ISBN mismatch / live title unavailable $\rightarrow$ **High**.
* **Financial Fact-Checker**: Draft responses citing monetary figures are cross-checked against author's DB balance (`earned - paid == pending`) and the ₹1,000 threshold. Discrepancies are flagged as `ai_draft_unverified`.
* **Human-in-the-Loop**: Drafts never auto-send; agents review, edit, and send via a 1-click **"Apply to Editor"** button.

### Evaluation Benchmark (7 Canonical Inquiries)

| # | Inquiry | Expected Category | Priority | Result | Policy / Math Verification | Status |
| :-: | :--- | :--- | :--- | :--- | :--- | :-: |
| 1 | *"When will I receive my Q3 royalties?"* | `royalty_inquiry` | `Medium` | Match | Explains quarterly payout schedule | **PASS** |
| 2 | *"My book shows Out of Stock on Amazon India!"* | `distribution_issue` | `High` | Match | Priority floor applied; cites retail sync window | **PASS** |
| 3 | *"I will take BookLeaf to consumer court for unpaid money!"* | `legal_escalation` | `Critical` | Match | Legal priority floor applied immediately | **PASS** |
| 4 | *"The 10 author copies arrived with torn covers and misaligned spines."* | `author_copies` | `High` | Match | Quality priority floor applied; requests photo proof | **PASS** |
| 5 | *"When will my book move from typesetting to proofreading?"* | `production_status` | `Medium` | Match | Correctly references stage 4 of 9-stage tracker | **PASS** |
| 6 | *"My pending royalty is ₹850. Why wasn't it sent to my account?"* | `royalty_inquiry` | `Medium` | Match | Cites ₹1,000 threshold roll-over rule | **PASS** |
| 7 | *"Can I change my retail price on Flipkart to ₹399?"* | `metadata_update` | `Low` | Match | Explains retail metadata distribution lead time | **PASS** |

**Benchmark Score**: **7/7 (100% accuracy, 100% priority floor enforcement)**.

---

## 5. API Documentation

Interactive OpenAPI documentation is live at [`/docs`](http://localhost:8000/docs) and [`/redoc`](http://localhost:8000/redoc).

### Core Endpoints

| Method | Path | Auth | Purpose |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login` | Public | Authenticates credentials; returns Bearer JWT. |
| `GET` | `/api/v1/me/books` | Author | Returns author's titles, retail platform links, and royalty balances. |
| `GET` | `/api/v1/me/tickets` | Author | Lists author's own tickets (supports `?status=` filtering). |
| `POST` | `/api/v1/me/tickets` | Author | Creates support ticket (validates book ownership in SQL). |
| `GET` | `/api/v1/me/tickets/{id}` | Author | Retrieves ticket thread (returns 404 for other authors' tickets). |
| `POST` | `/api/v1/me/tickets/{id}/messages` | Author | Appends follow-up message to ticket. |
| `GET` | `/api/v1/admin/metrics` | Admin | Returns operational queue KPIs (`total_in_queue`, `needs_first_reply`). |
| `GET` | `/api/v1/admin/tickets` | Admin | Global ticket queue with status, priority, and assignee filters. |
| `PATCH` | `/api/v1/admin/tickets/{id}` | Admin | Updates ticket status or assigns staff member. |
| `POST` | `/api/v1/admin/tickets/{id}/messages` | Admin | Posts official staff reply or private internal staff note. |
| `POST` | `/api/v1/admin/tickets/{id}/ai-draft` | Admin | Triggers on-demand AI draft response generation. |
| `GET` | `/api/v1/events/stream` | Auth | Server-Sent Events stream for real-time ticket updates. |
| `GET` | `/health` / `/health/ready` | Public | Liveness and database connection readiness probes. |

* **Auth Model**: Stateless HTTP `Authorization: Bearer <token>` signed via `HS256` with 24h expiration.
* **Error Format (RFC 7807)**:
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

## 6. Data Model

Database schema is defined in [`backend/app/db/schema.sql`](backend/app/db/schema.sql):

* **Entities**: `users` (credentials), `authors` (profiles), `books` (titles and royalty ledgers), `book_platforms` (retail links), `tickets` (support records), `ticket_messages` (conversation thread), `ticket_events` (audit log).
* **Engine Invariants**:
  * `chk_royalty_balance`: `(total_royalty_earned - royalty_paid = royalty_pending)` on `books`.
  * `tickets_book_owner_fk`: Composite FK `(book_id, author_id)` preventing cross-author ticket creation.
* **Seeding Pipeline**: [`backend/scripts/seed_canonical.py`](backend/scripts/seed_canonical.py) reads [`backend/bookleaf_sample_data.json`](backend/bookleaf_sample_data.json) idempotently. Populates 10 authors, 2 admins, 18 books, and 46 retail platform records, leaving the ticket queue in a pristine 0-ticket state for fresh testing.

---

## 7. Local Setup

### Prerequisites
* Python 3.10+
* Node.js 18+ & npm
* PostgreSQL 15+ (Local Docker or Neon)

### Environment Setup

```bash
cp .env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

| Variable | Target | Purpose | Example |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Backend | PostgreSQL pooled connection string | `postgresql://user:pass@ep-sample-pooler.neon.tech/neondb?sslmode=require` |
| `JWT_SECRET` | Backend | Cryptographic secret for signing JWTs | `bookleaf-secure-secret-key-32chars-minimum` |
| `AI_PROVIDER` | Backend | AI provider toggle (`bedrock` or `mock`) | `bedrock` |
| `BEDROCK_MODEL_ID` | Backend | Foundation model ID | `minimax.minimax-m2.5` |
| `AWS_BEARER_TOKEN_BEDROCK` | Backend | AWS Bedrock Mantle bearer token | `your-token` |
| `NEXT_PUBLIC_API_URL` | Frontend | Backend API base URL consumed by browser | `http://localhost:8000` |

### Quick Start Commands

```bash
# 1. Optional: Run local Postgres via Docker (skip if using Neon)
docker run -d --name bookleaf-postgres -p 5432:5432 -e POSTGRES_DB=neondb -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres postgres:16-alpine

# 2. Setup Backend & Seed Database
cd backend
pip install -r requirements.txt
python scripts/seed_canonical.py
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 3. Setup Frontend (in a separate terminal)
cd frontend
npm install
npm run dev
```

App will be live at `http://localhost:3000` with backend API at `http://localhost:8000`.

---

## 8. Deployment

* **Frontend (Vercel)**: Connect repo, set root directory to `frontend`, add `NEXT_PUBLIC_API_URL`, deploy.
* **Backend (Render / Railway)**: Create Web Service pointing to `backend`, set Python 3 runtime, build command `pip install -r requirements.txt`, start command `python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT`, add backend environment variables.
* **Database (Neon PostgreSQL)**: Serverless PostgreSQL with pooling enabled; run `python scripts/seed_canonical.py` to initialize tables and canonical data.
* **Redeploy**: Pushes to `main` trigger automated preview/production re-builds on Vercel and Render.

---

## 9. Assumptions

1. **Accounting Snapshot**: March 2024 fiscal cut-off; historical sales figures reflect platform receipts up to this date.
2. **₹1,000 Payout Minimum**: Evaluated across an author's **aggregate** pending balance across all their books. Balances under ₹1,000 (e.g. Kavita Deshmukh at ₹850) roll over automatically to the next cycle.
3. **No Self-Signup**: Authors and staff are provisioned during publishing contract execution. Public registration is omitted; users sign in with provisioned credentials.
4. **First-Reply Status Automation**: When support staff posts the first reply to an `Open` ticket, status transitions automatically to `In progress`, decrementing the `needs_first_reply` KPI queue.

---

## 10. Testing

### Run Backend Test Suite (34 Tests)
```bash
cd backend
python -m pytest -v
```
* **Coverage**: Complete RBAC permission matrix (401 unauthorized, 403 forbidden, 404 isolation), SQL constraints (`chk_royalty_balance`), priority floor overrides, circuit breaker tripping, and dynamic test entity cleanup.

### Run Frontend Test Suite
```bash
cd frontend
npm test
```

---

## 11. Known Limitations

1. **Email Delivery**: Notifications are tracked via internal event audit logs (`ticket_events`) and SSE rather than an outbound SMTP/SES gateway.
2. **File Attachments**: Query attachments validate client metadata and format; S3 presigned URL storage is recommended for binary production uploads.
3. **SSE Single-Node**: In-memory event bus is used for SSE; multi-container horizontal scaling requires a Redis Pub/Sub backplane.

---

## 12. Production Roadmap

1. **Marketplace Seller APIs**: Webhook synchronization with Amazon SP-API and Flipkart Seller API for automated inventory status updates.
2. **Inbound Email Webhooks**: Ingest author emails directly via SendGrid Inbound Parse or Amazon SES.
3. **Distributed Task Queue**: Offload PDF royalty statement generation and background AI triage to **Celery/ARQ** with Redis.
4. **Automated Payouts**: Connect **RazorpayX** or **Cashfree** batch payout rails for accounts meeting the ₹1,000 threshold.

---

## 13. Repository Layout

```
bookleaf-author-support-portal/
├── .env.example                               # Root environment variable template
├── .gitignore                                 # Production git ignore configuration
├── DECISIONS.md                               # Architectural Decision Records (ADRs)
├── README.md                                  # Project documentation
├── backend/                                   # FastAPI Python Backend Service
│   ├── bookleaf_sample_data.json              # Canonical 10-author dataset
│   ├── requirements.txt                       # Python dependencies
│   ├── app/
│   │   ├── main.py                            # ASGI application initialization & CORS
│   │   ├── ai/                                # AI triage, knowledge base & Bedrock Mantle client
│   │   ├── api/                               # REST routers (v1 endpoints, health, deps)
│   │   ├── core/                              # Config & Argon2id security
│   │   ├── db/                                # SQL schema & asyncpg connection pool
│   │   ├── schemas/                           # Pydantic v2 DTOs
│   │   └── services/                          # Ticket lifecycle & business services
│   ├── scripts/                               # Canonical database seed script
│   └── tests/                                 # Pytest automated test suite (34 tests)
├── frontend/                                  # Next.js 14 App Router Frontend
│   ├── package.json                           # Node dependencies
│   ├── app/
│   │   ├── (author)/                          # Author route group (Books, Tickets, New)
│   │   ├── admin/                             # Admin triage desk & ticket inspection
│   │   └── login/                             # Unified authentication screen
│   ├── components/                            # Reusable UI components
│   └── tests/                                 # Adversarial and E2E browser tests
└── docs/screenshots/                          # Interface preview assets
```
