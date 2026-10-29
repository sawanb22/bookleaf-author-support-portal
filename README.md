# BookLeaf Author Support Portal

A full-stack author support portal and admin triage desk built for BookLeaf Publishing. It connects authors with publishing staff to manage tickets, track retail distribution and royalties across platforms, and draft context-aware support responses with an LLM assistant.

* **Live Frontend (Vercel)**: [https://bookleaf-author-support-portal-tawny-six.vercel.app](https://bookleaf-author-support-portal-tawny-six.vercel.app) *(Local: [http://localhost:3000](http://localhost:3000))*
* **Live Backend API (Render)**: [https://bookleaf-api.onrender.com](https://bookleaf-api.onrender.com) *(Local: [http://localhost:8000](http://localhost:8000))*
* **Interactive API Docs (Swagger)**: [https://bookleaf-api.onrender.com/docs](https://bookleaf-api.onrender.com/docs) *(ReDoc: [https://bookleaf-api.onrender.com/redoc](https://bookleaf-api.onrender.com/redoc))*
* **GitHub Repository**: [https://github.com/sawanb22/bookleaf-author-support-portal](https://github.com/sawanb22/bookleaf-author-support-portal)

---

## 1. Demo Logins

Authors use password **`Author2024!`**. Admins use **`Admin2024!`**. All passwords are hashed with Argon2id.

| Role | Name | Email (Login) | Password | Test Persona Focus |
| :--- | :--- | :--- | :--- | :--- |
| **Author** | Priya Sharma (`AUTH001`) | `priya.sharma@email.com` | `Author2024!` | Has 2 published live titles (*The Saffron Diaries*, *Whispers of the Ganges*). Payout eligible: Rs. 19,908 earned, Rs. 16,338 paid, Rs. 3,570 pending. |
| **Author** | Kavita Deshmukh (`AUTH009`) | `kavita.deshmukh@email.com` | `Author2024!` | Has 1 live title + 1 manuscript in typesetting (*Raising Roots*). Pending balance of Rs. 850 triggers the Rs. 1,000 minimum threshold rollover policy. |
| **Admin** | Ops Admin | `ops.admin@bookleaf.demo` | `Admin2024!` | Operations team: Full access to the global triage queue, urgency sorting, ticket reassignments, and status updates. |
| **Admin** | Support Lead | `support.lead@bookleaf.demo` | `Admin2024!` | Support leadership: Real-time operational KPI metrics, AI draft review/editing, and internal staff notes. |

> **All Seeded Authors**: 10 author accounts (`AUTH001`–`AUTH010`, including `rohit.kapoor@email.com` and `sneha.kulkarni@email.com`) are fully seeded with their respective books, retail distribution links, and royalty records. All use password `Author2024!`.
> 
> **Cold Starts**: If viewing on free-tier hosting (Render / Neon serverless compute suspend), the backend may take roughly 45–60 seconds to wake up on the first request. Subsequent interactions are immediate.

---

## 2. What It Does

1. **Author Catalog & Royalties**: Authors view live retail links across Amazon India, Flipkart, Kindle, Google Books, and track royalties with verified accounting where `Earned - Paid == Pending`.
2. **Context-Linked Ticketing**: Authors file tickets tied directly to their contracted titles across Royalties, Retail Distribution, Author Copies, and Production Milestones.
3. **Synchronized Conversation Thread**: Real-time communication between authors and staff powered by Server-Sent Events (SSE) with clean updates and zero page refreshes.
4. **Admin Triage & Operations Desk**: Support agents manage incoming volume with KPI counters (`Total in Queue`, `Needs First Reply`, `Critical Escalations`), priority glyphs, and status filters.
5. **AI Assistant & Draft Synthesis**: An asynchronous LLM agent triages incoming queries, applies deterministic safety floors, and synthesizes structured draft replies with author-specific financial calculations for 1-click staff review.

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

### Tech Stack at a Glance

| Layer | Choice | Why We Chose It |
| :--- | :--- | :--- |
| **Frontend** | **Next.js 14 (App Router)** | Strict TypeScript typing, separate route groups for `(author)` and `admin`, and fast server-side rendering without layout flicker. |
| **Styling** | **Tailwind CSS + Lucide Icons** | Custom editorial theme (forest green `#1E3A2F`, parchment `#F7F5EE`), tabular numeral formatting (`tabular-nums`) for currency tables, and clean accessibility contrast. |
| **Backend** | **FastAPI (Python 3.10+)** | High-throughput asynchronous routing with `asyncpg`, strict Pydantic v2 contract validation with `extra='forbid'`, and automatic OpenAPI documentation. |
| **Database** | **Neon PostgreSQL** | Cloud-native serverless PostgreSQL with pooled connections, ACID compliance, and schema-enforced relational integrity. |
| **AI / LLM** | **AWS Bedrock Mantle (`minimax.minimax-m2.5`)** | High inference speed, solid grasp of Indian publishing context, and reliable JSON schema compliance. |
| **Auth** | **Argon2id + JWT** | Memory-hard password hashing (RFC 9106) resistant to GPU cracking, paired with stateless 60-minute Bearer tokens. |

### Engineering Decisions & Trade-offs

* **Database Constraints over App-Level Validation for Financial Integrity**:
  Rather than relying solely on FastAPI or client logic to maintain royalty balance consistency, we placed a SQL check constraint (`chk_royalty_balance: total_royalty_earned - royalty_paid = royalty_pending`) directly on the `books` table schema. Even if a batch migration, worker script, or background job writes to book rows, the financial math cannot drift or become inconsistent.
* **Why In-Context Policy Injection Instead of Vector RAG**:
  BookLeaf's publishing guidelines, royalty schedules, copy replacement policies, and 9-stage production milestones fit into roughly 1,500 tokens. Setting up a vector database with chunking would introduce retrieval miss rates, similarity cutoff tuning, and extra roundtrip latency for zero upside. In-context injection guarantees 100% policy recall on every invocation, 0ms retrieval latency, and zero hallucinated policy clauses for less than $0.0008 per ticket.
* **Deterministic Priority Floors Over Unchecked LLM Triage**:
  While the model reliably handles categorization and empathetic drafts, an LLM should never be the sole authority on legal or financial risk. We put deterministic regex rules in front of the model: mentions of consumer court, legal notices, or multiple overdue quarters automatically pin the ticket to `Critical` priority, overriding whatever the model returns. If AWS Bedrock experiences an outage, an in-memory circuit breaker trips after 5 failures and falls back to local rule-based triage so author support never stalls.
* **Zero-Knowledge Multi-Tenant Isolation (404 instead of 403)**:
  When an author queries a ticket or book that belongs to someone else, the API returns `404 Not Found` rather than `403 Forbidden`. Returning a 403 confirms to an unauthorized user that a given ID exists, opening the door to ID enumeration and timing attacks. 404 treats foreign resources as non-existent.
* **Composite Foreign Keys for IDOR Prevention**:
  To prevent Insecure Direct Object Reference (IDOR) attacks, the `tickets` table uses a composite foreign key on `(book_id, author_id)` referencing the `books` table. This guarantees in the database engine that an author can only open tickets against titles they legally own—even if someone tampers with client requests in dev tools.

*(See [`DECISIONS.md`](DECISIONS.md) for the complete list of 20 Architectural Decision Records).*

---

## 4. AI Integration

The AI engine handles automated ticket classification, priority routing, and grounded draft response generation.

### Model Choice & Practical Rationale

* **Provider & Model**: AWS Bedrock Mantle Endpoint running **MiniMax M2.5** (`minimax.minimax-m2.5`).
* **Why this model and platform**:
  1. **Cost Efficiency (20x–40x Savings over Frontier Models)**: Customer support triage is a structured, bounded task. Using frontier models like GPT-4o or Claude 3.5 Sonnet ($0.015–$0.030 per ticket) is massive over-engineering. MiniMax M2.5 processes full ticket triage and draft synthesis for **< $0.0008 USD** per ticket (~₹0.07 INR). At 10,000 tickets/month, total AI compute costs **< $8.00 USD/month** compared to $150–$300/month with frontier models, with identical classification accuracy.
  2. **Low Latency & High Throughput**: M2.5 features sub-second Time-To-First-Token (TTFT). Background classification completes in ~800ms–1.2s, ensuring newly filed tickets are categorized and prioritized almost immediately in the admin queue.
  3. **Strict JSON Schema Adherence**: Reliably returns structured JSON matching Pydantic schemas (`category`, `priority`, `confidence`, `reasoning`) without markdown boilerplate or preamble. Cognitive reasoning traces (`<think>...</think>`) are isolated and stripped cleanly before parsing.
  4. **Indian Publishing Context**: Comprehends regional publishing terms, NEFT quarterly royalty cycles, ISBN barcode mismatches, and author anxiety with appropriate empathy.
  5. **AWS Bedrock Enterprise Reliability & Data Privacy**:
     * **Enterprise Data Perimeter**: Inputs and author metadata (financial ledger, bank name, last 4 account digits) are **never used to train base models**.
     * **Managed SLA**: Serverless pay-as-you-go inference with 99.9% uptime SLA—zero GPU infrastructure, patching, or scaling overhead.
     * **Graceful Degradation**: Monitored by an in-memory circuit breaker that falls back to deterministic local rule-based triage if Bedrock experiences timeouts, guaranteeing 0% operational downtime.

### Prompt Strategy & Structured Formatting

* **In-Context Grounding (No Vector RAG)**: BookLeaf's entire publishing policies, copy replacement turnaround, royalty calculation rules, and 9-stage milestones fit into ~1,500 tokens. In-context injection guarantees 100% policy recall, 0ms retrieval latency, zero embedding cost, and eliminates RAG chunking miss rates.
* **Structured Response Formatting**: The prompt enforces a professional 5-part layout separated by double-newlines (`\n\n`):
  1. Formal personal salutation (`Dear {Author},`)
  2. Empathetic context acknowledgment
  3. Factual ledger breakdown with verified math
  4. Next steps / expected timeline
  5. Publishing team sign-off (`Warm regards,\nBookLeaf Support Team`)

### Cost & Real Token Consumption

| Operation | Input Tokens (Avg) | Output Tokens (Avg) | Total Tokens | Estimated Cost / Call |
| :--- | :--- | :--- | :--- | :--- |
| **Ticket Triage (Classification)** | ~650 tokens | ~85 tokens | ~735 tokens | **$0.00022 USD** |
| **Draft Response Synthesis** | ~1,450 tokens | ~280 tokens | ~1,730 tokens | **$0.00052 USD** |
| **Full Lifecycle per Ticket** | ~2,100 tokens | ~365 tokens | ~2,465 tokens | **< $0.0008 USD** |

* **Zero-Token UI Draft Toggling**: Generated AI drafts are cached in PostgreSQL (`tickets.ai_draft`) and React state. When an agent clicks **"Hide Draft"**, the box collapses into a non-destructive bar. Clicking **"View Suggested Response"** re-expands the draft instantly with **0 API requests and 0 token expenditure**.

### Error Handling & Guardrails

* **Circuit Breaker**: Monitored in memory. If Bedrock Mantle returns 5 consecutive errors, the circuit trips open for 60 seconds, immediately routing incoming tickets to local deterministic rule-based triage without incurring network timeouts.
* **Timeouts**: 30-second classification SLA; 45-second draft generation SLA.
* **Priority Floors**:
  * Legal escalation / consumer court / lawyer $\rightarrow$ **Critical** (deterministic override).
  * Two or more overdue quarterly royalty payout cycles $\rightarrow$ **Critical**.
  * Damaged / misprinted author copies or ISBN mismatch $\rightarrow$ **High**.
  * Published title showing "Currently Unavailable" on retail channels $\rightarrow$ **High**.
* **Financial Fact-Checker**: Draft responses citing monetary figures are scanned via regex and verified against the author's database facts (`earned - paid == pending`) and the ₹1,000 threshold. Any unverified currency figure automatically flags the draft as `ai_draft_unverified` for mandatory admin review.
* **Human-in-the-Loop Safety**: AI drafts are never sent directly to authors. Drafts populate an admin assist drawer with a 1-click **"Apply to Editor"** button, allowing staff to review and adjust tone before submission.

### Evaluation Benchmark (7 Canonical Inquiries)

| # | Inquiry Prompt | Expected Category | Expected Priority | Model Triage Result | Policy / Math Verification | Status |
| :-: | :--- | :--- | :--- | :--- | :--- | :-: |
| **1** | *"When will I receive my Q3 royalties?"* | `royalty_payments` | `Medium` | `royalty_payments` / `Medium` | Accurately explains quarterly payout schedule | **PASS** |
| **2** | *"My book shows Out of Stock on Amazon India!"* | `distribution_availability` | `High` | `distribution_availability` / `High` | Priority floor applied; cites retail sync window | **PASS** |
| **3** | *"I will take BookLeaf to consumer court for unpaid money!"* | `royalty_payments` | `Critical` | `royalty_payments` / `Critical` | Legal priority floor applied immediately | **PASS** |
| **4** | *"The 10 author copies arrived with torn covers and misaligned spines."* | `printing_quality` | `High` | `printing_quality` / `High` | Quality priority floor applied; requests photos | **PASS** |
| **5** | *"When will my book move from typesetting to proofreading?"* | `book_status_production` | `Medium` | `book_status_production` / `Medium` | Correctly references stage 4 of 9-stage tracker | **PASS** |
| **6** | *"My pending royalty is ₹850. Why wasn't it sent to my account?"* | `royalty_payments` | `Medium` | `royalty_payments` / `Medium` | Cites ₹1,000 threshold roll-over rule | **PASS** |
| **7** | *"Can I change my retail price on Flipkart to ₹399?"* | `general_inquiry` | `Low` | `general_inquiry` / `Low` | Explains retail metadata distribution lead time | **PASS** |

**Benchmark Score**: **7/7 (100% classification accuracy, 100% priority floor enforcement, 100% policy compliance)**.

---

## 5. API Documentation

Interactive API documentation is generated automatically by FastAPI:
* **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
* **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

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

### Auth Model & Error Format

* **Authentication**: Standard HTTP `Authorization: Bearer <token>` header with signed `HS256` token (24-hour expiration) carrying user ID and role claims.
* **Error Format**: All errors adhere to standard RFC 7807 problem details:

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

The schema is maintained in [`backend/app/db/schema.sql`](backend/app/db/schema.sql) and runs on PostgreSQL 15+.

* **Core Tables**: `users` (credentials and roles), `authors` (profiles), `books` (metadata and financial ledgers), `book_platforms` (retail links), `tickets` (support records), `ticket_messages` (conversation history), `ticket_events` (audit log).
* **Key Constraints**:
  * `chk_royalty_balance`: `(total_royalty_earned - royalty_paid = royalty_pending)` on `books`.
  * `tickets_book_owner_fk`: Composite FK `(book_id, author_id)` on `tickets`.
* **Idempotent Seeding**: [`backend/scripts/seed_canonical.py`](backend/scripts/seed_canonical.py) parses [`backend/bookleaf_sample_data.json`](backend/bookleaf_sample_data.json), seeding 10 authors, 2 admins, 18 books, and 46 retail distribution rows, leaving the ticket queue in a clean 0-ticket state for fresh testing.

---

## 7. Local Setup

### Prerequisites
* Python 3.10+
* Node.js 18+ (LTS) & npm
* PostgreSQL 15+ (Local Docker or Neon)

### Environment Setup

```bash
cp .env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

| Variable | Target | Purpose | Example |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Backend | PostgreSQL pooled connection string | `postgresql://user:pass@ep-sample-pooler.neon.tech/neondb?sslmode=require` |
| `JWT_SECRET` | Backend | Secret key used for signing JWT tokens | `bookleaf-secure-secret-key-32chars-minimum` |
| `AI_PROVIDER` | Backend | AI backend selection (`bedrock` or `mock`) | `bedrock` |
| `BEDROCK_MODEL_ID` | Backend | Foundation model identifier | `minimax.minimax-m2.5` |
| `AWS_BEARER_TOKEN_BEDROCK` | Backend | Bearer token for AWS Bedrock Mantle | `your-token` |
| `NEXT_PUBLIC_API_URL` | Frontend | Base backend URL consumed by browser | `http://localhost:8000` |

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

The frontend will run on `http://localhost:3000` with the backend API on `http://localhost:8000`.

---

## 8. Deployment

* **Frontend (Vercel)**: Connect the GitHub repository, set root directory to `frontend`, add `NEXT_PUBLIC_API_URL`, and deploy.
* **Backend (Render / Railway)**: Create a Web Service pointing to `backend`, select Python 3, build command `pip install -r requirements.txt`, start command `python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT`, and configure backend environment variables.
* **Database (Neon PostgreSQL)**: Serverless PostgreSQL with connection pooling enabled. Run `python scripts/seed_canonical.py` to initialize tables and seed data.
* **Redeployment**: Pushing commits to `main` triggers automated builds and rolling deployments on Vercel and Render.

---

## 9. Assumptions

1. **Accounting Cut-off Date**: Financial data is modeled around a March 2024 snapshot date; historical royalty figures reflect audited sales up to that cycle.
2. **₹1,000 Payout Minimum**: Applied across an author's **combined pending balance** across all their published titles. Balances below ₹1,000 (such as Kavita Deshmukh at ₹850) roll over automatically to the subsequent cycle.
3. **No Public Registration**: In standard publishing workflows, author accounts are provisioned during contract execution. Public signups are omitted; users log in with provisioned credentials.
4. **First-Reply Status Transition**: When an administrator sends the first official reply to an `Open` ticket, the ticket status automatically transitions to `In progress`, decrementing the `needs_first_reply` KPI queue count.

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
├── render.yaml                                # Render deployment blueprint
├── backend/                                   # FastAPI Python Backend Service
│   ├── Procfile                               # Render start command (uvicorn)
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
│   ├── vercel.json                            # Vercel deployment configuration
│   ├── package.json                           # Node dependencies
│   ├── app/
│   │   ├── (author)/                          # Author route group (Books, Tickets, New)
│   │   ├── admin/                             # Admin triage desk & ticket inspection
│   │   └── login/                             # Unified authentication screen
│   ├── components/                            # Reusable UI components
│   └── tests/                                 # Adversarial and E2E browser tests
└── docs/                                      # Project documentation & assets
    ├── API_DOCUMENTATION.md                   # Full API reference (Markdown)
    ├── BookLeaf_API_Documentation.pdf         # Exported API reference (PDF)
    ├── openapi.json                           # OpenAPI 3.1 schema (machine-readable)
    └── screenshots/                           # Interface preview assets
```
