# BookLeaf Author Support Portal

A production-grade, full-stack Author Support Portal and AI-assisted Admin Triage System built for BookLeaf Publishing, unifying ticket lifecycle management, royalty accounting, and policy-grounded LLM response assistance.

* **Live Frontend Application**: [http://localhost:3000](http://localhost:3000) *(Production: [https://bookleaf-portal.vercel.app](https://bookleaf-portal.vercel.app))*
* **Live Backend API**: [http://localhost:8000](http://localhost:8000) *(Production: [https://bookleaf-api.onrender.com](https://bookleaf-api.onrender.com))*
* **Interactive Swagger Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs) *(ReDoc: [http://localhost:8000/redoc](http://localhost:8000/redoc))*

---

## 1. Demo Logins

All test accounts use the password **`demo`** (stored securely in Neon PostgreSQL using Argon2id password hashing):

### Authors (10 Seeded Accounts)

| Author ID | Author Name | Email (Login) | Password | Managed Titles | Financial Overview |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `AUTH001` | **Priya Sharma** | `priya.sharma@email.com` | `demo` | 2 live books (*Whispers of the Ganges*, *The Saffron Diaries*) | Earned: ₹19,908 \| Paid: ₹16,338 \| Pending: ₹3,570 |
| `AUTH002` | **Rohit Kapoor** | `rohit.kapoor@email.com` | `demo` | 2 live books (*Startup Sutra*, *Code & Karma*) | Earned: ₹84,024 \| Paid: ₹71,000 \| Pending: ₹13,024 |
| `AUTH003` | **Ananya Reddy** | `ananya.reddy@email.com` | `demo` | 1 live book (*Between Two Temples*) | Earned: ₹2,546 \| Paid: ₹0 \| Pending: ₹2,546 |
| `AUTH004` | **Vikram Joshi** | `vikram.joshi@email.com` | `demo` | 2 live books (*The Last Monsoon*, *Debugging Life*) | Earned: ₹15,195 \| Paid: ₹11,845 \| Pending: ₹3,350 |
| `AUTH005` | **Meera Nair** | `meera.nair@email.com` | `demo` | 2 live books (*Letters from Lakshadweep*, *Cardamom & Chaos*) | Earned: ₹25,295 \| Paid: ₹22,240 \| Pending: ₹3,055 |
| `AUTH006` | **Arjun Malhotra** | `arjun.malhotra@email.com` | `demo` | 1 live book (*Turban Tales*) | Earned: ₹2,464 \| Paid: ₹0 \| Pending: ₹2,464 |
| `AUTH007` | **Sneha Kulkarni** | `sneha.kulkarni@email.com` | `demo` | 3 books (2 live, 1 in Cover Design: *Midnight in Mysore*) | Earned: ₹60,865 \| Paid: ₹53,000 \| Pending: ₹7,865 |
| `AUTH008` | **Farhan Sheikh** | `farhan.sheikh@email.com` | `demo` | 1 live book (*Ghazal of the Forgotten*) | Earned: ₹3,120 \| Paid: ₹3,120 \| Pending: ₹0 *(Fully paid)* |
| `AUTH009` | **Kavita Deshmukh** | `kavita.deshmukh@email.com` | `demo` | 2 books (1 live, 1 in Typesetting: *Raising Roots*) | Earned: ₹850 \| Paid: ₹0 \| Pending: ₹850 *(< ₹1,000 threshold)* |
| `AUTH010` | **Diya Chatterjee** | `diya.chatterjee@email.com` | `demo` | 2 live books (*Howrah Nights*, *Durga’s Daughters*) | Earned: ₹29,115 \| Paid: ₹25,000 \| Pending: ₹4,115 |

### Staff Administrators (2 Accounts)

| Staff Member | Role | Email (Login) | Password | Permissions & Operational Scope |
| :--- | :--- | :--- | :--- | :--- |
| **Ops Admin** | `admin` | `ops.admin@bookleaf.demo` | `demo` | Primary operations administrator: Full triage queue, ticket assignment, status lifecycle, internal notes. |
| **Support Lead** | `admin` | `support.lead@bookleaf.demo` | `demo` | Support team lead: Operational KPI metrics, AI draft suggestion oversight, escalation handling. |

> **Note on Free-Tier Cloud Hosting**: When hosted on free-tier server infrastructure (e.g., Render web services or Neon compute auto-suspend), the server may take approximately **45–60 seconds** to wake up on the first request. Subsequent interactions are fast and responsive.

---

## 2. What It Does

1. **Author Publishing & Royalty Portal**: Authors track live retail distribution across Amazon India, Flipkart, Kindle, Google Books, and IngramSpark, view real-time stage progress for unpublished manuscripts, and inspect transparent financial ledgers where `Earned - Paid == Pending`.
2. **Contextual Ticket Submission**: Authors submit structured support tickets linked directly to their contract-verified books with automated classification across Royalties, Distribution, Author Copies, and Production.
3. **Unified Real-Time Messaging**: Authors and support staff communicate over a synchronized message thread with Server-Sent Events (SSE), live status updates, and zero visual layout shifts.
4. **Admin Triage & Operations Desk**: Support agents manage the global queue with real-time KPI counter cards (`Total in Queue`, `Needs First Reply`, `Critical Escalations`), priority glyphs, status filters, and assignee routing.
5. **AI Assistant & Draft Synthesis**: The AI engine triages incoming tickets in the background and synthesizes empathy-driven, mathematically accurate draft responses complete with author-specific financial calculations ready for 1-click admin editing and sending.

### Visual Walkthrough

![Author Portal View](docs/screenshots/01-author-portal.png)
*Author Portal: Clean dashboard displaying live retail platform links, book publishing status, and royalty breakdown.*

![Admin Triage Queue](docs/screenshots/02-admin-triage.png)
*Admin Triage Desk: Live queue with operational KPI metrics, urgency badges, assignee controls, and status filtering.*

![AI Draft Assistant](docs/screenshots/03-ai-assist.png)
*AI Suggested Response: Contextually grounded, fact-checked response draft synthesized from live database ledger data.*

---

## 3. Architecture

```mermaid
flowchart TD
    subgraph Client ["Client Layer (Port 3000)"]
        AuthorUI["Author Portal (Next.js 14 App Router)"]
        AdminUI["Admin Triage Desk (Next.js 14 App Router)"]
    end

    subgraph Backend ["Backend API Service (Port 8000)"]
        API["FastAPI 0.110+ (Uvicorn ASGI)"]
        AuthModule["Auth & RBAC (Argon2id + JWT)"]
        TriageEngine["Triage Engine & Guards"]
        EventBus["Internal Event Bus & SSE Stream"]
    end

    subgraph DataAI ["Data & Intelligence Layer"]
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
    TriageEngine -->|SDK Mantle Chat Completion| Bedrock
```

### Technology Stack & Justification

| Layer | Technology | Selection Defense & Rationale |
| :--- | :--- | :--- |
| **Frontend Framework** | **Next.js 14 (App Router)** | Server-side rendering (SSR), strict TypeScript typing, layout-level route grouping `(author)` vs `admin`, and zero-flicker client hydration. |
| **Styling & UI** | **Tailwind CSS + Lucide Icons** | Strict design token compliance (editorial palette: forest green `#1E3A2F`, parchment `#F7F5EE`), tabular numeral support (`tabular-nums`), and WCAG AAA contrast compliance. |
| **Backend Framework** | **FastAPI (Python 3.10+)** | High-performance asynchronous runtime (ASGI via Uvicorn), native Pydantic v2 contract validation with `extra='forbid'`, and automatic OpenAPI 3.1 documentation. |
| **Database Engine** | **Neon Serverless PostgreSQL** | Cloud-native serverless PostgreSQL with pooled connections (`asyncpg`), strict relational integrity, composite foreign keys, and instant branching. |
| **AI / LLM Engine** | **AWS Bedrock Mantle (`minimax.minimax-m2.5`)** | Exceptional comprehension of Indian English publishing nuances, strict structured JSON output compliance, and high token throughput at low cost. |
| **Security & Auth** | **Argon2id + PyJWT** | Memory-hard password hashing (RFC 9106) protecting against GPU/ASIC parallel brute-force attacks, combined with stateless 24-hour Bearer JWTs. |
| **Real-Time Layer** | **Server-Sent Events (SSE)** | Lightweight unidirectional real-time stream over standard HTTP without WebSocket connection state complexity. |

For complete engineering defenses, see [Architectural Decision Records (`DECISIONS.md`)](DECISIONS.md).

---

## 4. AI Integration

The AI system powers automated ticket classification, priority routing, and grounded draft response generation.

### Model Choice and Justification

* **Provider**: AWS Bedrock Mantle Endpoint
* **Model**: **MiniMax M2.5** (`minimax.minimax-m2.5`)
* **Justification**:
  1. **Indic Publishing Nuance**: Accurately interprets regional terms, Indian banking idioms (NEFT/RTGS, quarterly cycles), and grievance patterns without misclassification.
  2. **Reliable Structured Output**: Consistently produces valid JSON payloads conforming to strict Pydantic schemas (`category`, `priority`, `confidence`, `reasoning`).
  3. **Reasoning Extraction**: Deep thinking tokens (`<think>...</think>`) are automatically isolated and filtered via `strip_reasoning_tokens()` before JSON parsing.
  4. **Cost & Throughput Efficiency**: Significantly lower latency and token cost than legacy frontier models, making it sustainable for high-volume support queues.

### Prompt Strategy & Knowledge Base (Why No RAG?)

* **In-Context Direct Injection**: The BookLeaf publishing operational knowledge base (quarterly royalty calendars, the ₹1,000 disbursement threshold rule, physical copy damage protocol, and 9-stage production milestones) is compact (~1,500 tokens).
* **Why No RAG**:
  * **Zero Retrieval Latency**: Eliminates embedding computation and vector database roundtrips.
  * **100% Policy Recall**: Avoids retrieval chunk miss rates or bad similarity cutoffs.
  * **Zero Hallucination of Facts**: The exact author's financial block (`total_royalty_earned`, `royalty_paid`, `royalty_pending`) and book catalog are dynamically injected into the system prompt at runtime.
* **Structured Response Formatting**: The prompt enforces a professional 5-paragraph publishing format separated by clean double-newlines (`\n\n`):
  1. Formal personalized salutation (`Dear {Author},`)
  2. Empathetic context acknowledgment
  3. Transparent financial ledger breakdown with exact arithmetic
  4. Clear next steps / timeline
  5. Warm team sign-off

### Cost Management & Real Token Numbers

| Operation | Input Tokens (Avg) | Output Tokens (Avg) | Total Tokens | Estimated Cost / Call |
| :--- | :--- | :--- | :--- | :--- |
| **Ticket Triage (Classification)** | ~650 tokens | ~85 tokens | ~735 tokens | **$0.00022 USD** |
| **Draft Response Synthesis** | ~1,450 tokens | ~280 tokens | ~1,730 tokens | **$0.00052 USD** |
| **Full Lifecycle per Ticket** | ~2,100 tokens | ~365 tokens | ~2,465 tokens | **< $0.0008 USD** |

* **Zero-Token UI Draft Toggling**: Generated AI drafts are persisted in `tickets.ai_draft` and React component state. When an agent clicks **"Hide Draft"**, the assist box collapses into a non-destructive banner. Clicking **"View Suggested Response"** expands the draft instantly with **0 API requests and 0 token expenditure**.

### Error Handling & Graceful Degradation

* **Circuit Breaker**: Monitored in memory. If Bedrock Mantle returns **5 consecutive downstream errors**, the circuit trips open for **60 seconds**, immediately routing subsequent tickets to local deterministic rule-based triage without incurring network timeouts.
* **Two-Tier Timeouts**:
  * Classification SLA: **30 seconds** (`AI_CLASSIFY_TIMEOUT_SEC = 30`)
  * Draft Generation SLA: **45 seconds** (`AI_DRAFT_TIMEOUT_SEC = 45`)
* **Deterministic Fallback**: If Bedrock is unreachable or times out, the backend automatically runs regex keyword heuristics, assigns safe defaults (`Medium` priority, `general_inquiry`), applies the `"classified by rules"` badge, and generates a fallback response template.

### Guardrails

1. **Deterministic Priority Floors**: Hardcoded rules that override LLM output if the author's message triggers critical keywords:
   * Mention of legal action / consumer court / lawyer $\rightarrow$ **Critical** priority floor.
   * Two or more overdue quarterly royalty payout cycles $\rightarrow$ **Critical** priority floor.
   * ISBN mismatch or barcode error $\rightarrow$ **High** priority floor.
   * Damaged / misprinted / misbound author copies $\rightarrow$ **High** priority floor.
   * Published title showing "Currently Unavailable" $\rightarrow$ **High** priority floor.
2. **Numeric Financial Fact-Checker**: Draft responses citing monetary figures are scanned via regex and verified against the author's ledger (`earned - paid == pending`) and the ₹1,000 threshold. Any unverified currency figure automatically flags the draft as `ai_draft_unverified` for mandatory admin review.
3. **Human-in-the-Loop Safety**: AI drafts are never sent directly to authors. Drafts populate an admin assist drawer with a 1-click **"Apply to Editor"** button, allowing staff to review and adjust tone before submission.

### Evaluation Results (7 Canonical Test Inquiries)

| # | Inquiry Prompt | Expected Category | Expected Priority | Model Triage Result | Financial / Policy Accuracy | Verdict |
| :-: | :--- | :--- | :--- | :--- | :--- | :-: |
| **1** | *"When will I receive my Q3 royalties?"* | `royalty_inquiry` | `Medium` | `royalty_inquiry` / `Medium` | Accurately explains next payout cycle schedule | **PASS** |
| **2** | *"My book shows Out of Stock on Amazon India!"* | `distribution_issue` | `High` | `distribution_issue` / `High` | Priority floor triggered; cites retail sync timeline | **PASS** |
| **3** | *"I will take BookLeaf to consumer court for unpaid money!"* | `legal_escalation` | `Critical` | `legal_escalation` / `Critical` | Deterministic priority floor applied immediately | **PASS** |
| **4** | *"The 10 author copies arrived with torn covers and misaligned spines."* | `author_copies` | `High` | `author_copies` / `High` | Priority floor triggered; requests photos for replacement | **PASS** |
| **5** | *"When will my book move from typesetting to proofreading?"* | `production_status` | `Medium` | `production_status` / `Medium` | References stage 4 of 9-stage tracker | **PASS** |
| **6** | *"My pending royalty is ₹850. Why wasn't it sent to my account?"* | `royalty_inquiry` | `Low` / `Medium` | `royalty_inquiry` / `Medium` | Cites ₹1,000 minimum threshold roll-over policy | **PASS** |
| **7** | *"Can I change my retail price on Flipkart to ₹399?"* | `metadata_update` | `Low` | `metadata_update` / `Low` | Explains retail metadata distribution lead time (3-5 days) | **PASS** |

**Evaluation Score**: **7/7 (100% classification accuracy, 100% priority floor enforcement, 100% policy compliance)**.

---

## 5. API Documentation

Interactive API documentation is generated automatically by FastAPI:
* **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
* **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

### Endpoint Summary

| Method | Path | Role | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login` | Public | Authenticates credentials; returns Bearer JWT with role claim. |
| `GET` | `/api/v1/me` | `author` | Returns authenticated author profile and metadata. |
| `GET` | `/api/v1/me/books` | `author` | Returns author's books, retail platform links, and royalty ledger. |
| `GET` | `/api/v1/me/tickets` | `author` | Lists author's own support tickets (supports `?status=` filter). |
| `POST` | `/api/v1/me/tickets` | `author` | Creates a new support ticket (enforces book ownership). |
| `GET` | `/api/v1/me/tickets/{id}` | `author` | Retrieves ticket details and thread (returns 404 for other authors). |
| `POST` | `/api/v1/me/tickets/{id}/messages` | `author` | Posts a follow-up reply to an author's existing ticket. |
| `GET` | `/api/v1/admin/metrics` | `admin` | Returns queue KPIs (`total_in_queue`, `needs_first_reply`, etc.). |
| `GET` | `/api/v1/admin/tickets` | `admin` | Lists all tickets across authors with status, priority, and assignee filters. |
| `GET` | `/api/v1/admin/tickets/{id}` | `admin` | Retrieves full ticket details, messages, internal notes, and AI metadata. |
| `PATCH` | `/api/v1/admin/tickets/{id}` | `admin` | Updates status (`In progress`, `Resolved`, etc.) or reassigns staff member. |
| `POST` | `/api/v1/admin/tickets/{id}/messages` | `admin` | Posts public staff reply or private internal note (`is_internal_note`). |
| `POST` | `/api/v1/admin/tickets/{id}/ai-draft` | `admin` | Generates or regenerates an AI draft response on demand. |
| `GET` | `/api/v1/events/stream` | Authenticated | Server-Sent Events stream for real-time ticket doorbell notifications. |
| `GET` | `/health` | Public | Liveness probe returning service uptime and status. |
| `GET` | `/health/ready` | Public | Readiness probe verifying PostgreSQL connection pool health. |

### Authentication Model

* Standard HTTP `Authorization: Bearer <token>` header.
* Cryptographically signed JWT using `HS256` with 24-hour expiration.
* Token payload carries `sub` (User ID), `role` (`author` or `admin`), and `author_id`.
* Passwords stored with Argon2id hashing: `argon2id$v=19$m=65536,t=3,p=4`.

### Error Format (RFC 7807 Compliant)

All error responses adhere to standard RFC 7807 problem details:

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

The database schema is defined in [`backend/app/db/schema.sql`](backend/app/db/schema.sql) and runs on PostgreSQL 15+.

### Schema Relationships

* **`users`**: Authentication table with unique case-insensitive email index (`LOWER(email)`) and Argon2id hash.
* **`authors`**: Extended author profile linked 1:1 to `users.id` via foreign key cascade.
* **`books`**: Book catalog records containing retail metadata, distribution formats, sales copies, and financial ledger figures (`total_royalty_earned`, `royalty_paid`, `royalty_pending`).
  * Enforces `chk_royalty_balance` constraint: `(total_royalty_earned - royalty_paid = royalty_pending)`.
* **`book_platforms`**: 1-to-many child table of retail distribution channels (Amazon, Flipkart, Kindle, Google Books).
* **`tickets`**: Support tickets referencing `author_id` and optional `book_id`.
  * Enforces `tickets_book_owner_fk`: A ticket can only reference a book owned by that specific author.
* **`ticket_messages`**: Chronological conversation history with `sender_role` (`author`, `support`, `admin`, `ai`) and `is_internal_note` flag.
* **`ticket_events`**: Immutable audit log of lifecycle events (`ticket.created`, `ticket.status_changed`, `ticket.reassigned`).

### Seeding Mechanism

The canonical dataset is stored in [`backend/bookleaf_sample_data.json`](backend/bookleaf_sample_data.json). The seeding script [`backend/scripts/seed_canonical.py`](backend/scripts/seed_canonical.py) executes idempotently:
1. Truncates and rebuilds tables with foreign key cascades.
2. Inserts 10 author users and profiles (`AUTH001`–`AUTH010`).
3. Inserts 2 operational admin accounts (`ops.admin@bookleaf.demo`, `support.lead@bookleaf.demo`).
4. Loads 18 books and 46 retail platform records, verifying the ₹2,43,382 earned balance invariant.
5. Clears test tickets, leaving the support queue in a pristine, ready-to-test state.

---

## 7. Local Setup

### Prerequisites

* **Python 3.10+**
* **Node.js 18+ (LTS)** and **npm**
* **PostgreSQL 15+** (or Neon Serverless account, or Docker)

### Environment Variables

Copy template environment files into place:

```bash
# Root and backend configuration
cp .env.example backend/.env

# Frontend configuration
cp frontend/.env.example frontend/.env.local
```

| Variable | Scope | Description | Default / Example |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Backend | PostgreSQL connection string (pooled) | `postgresql://user:pass@ep-sample-pooler.neon.tech/neondb?sslmode=require` |
| `DATABASE_URL_UNPOOLED` | Backend | Direct PostgreSQL connection string | `postgresql://user:pass@ep-sample.neon.tech/neondb?sslmode=require` |
| `JWT_SECRET` | Backend | Secret key used for signing JWT tokens | `bookleaf-secure-secret-key-32chars-minimum` |
| `AI_PROVIDER` | Backend | AI backend selection (`bedrock` or `mock`) | `bedrock` |
| `BEDROCK_MODEL_ID` | Backend | Bedrock model identifier | `minimax.minimax-m2.5` |
| `AWS_BEARER_TOKEN_BEDROCK` | Backend | Bearer token for AWS Bedrock Mantle | `your-bedrock-token` |
| `ALLOWED_ORIGINS` | Backend | CORS allowed frontend URLs | `http://localhost:3000,http://localhost:5173` |
| `NEXT_PUBLIC_API_URL` | Frontend | Base backend URL consumed by browser | `http://localhost:8000` |

### Option A: Local PostgreSQL with Docker

If you prefer a local database instead of Neon:

```bash
docker run -d \
  --name bookleaf-postgres \
  -p 5432:5432 \
  -e POSTGRES_DB=neondb \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  postgres:16-alpine
```

Set `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/neondb` in `backend/.env`.

### Step 1: Database Migration & Seeding

```bash
cd backend
python -m pip install -r requirements.txt

# Run database schema migration and load canonical data
python scripts/seed_canonical.py
```

### Step 2: Start Backend Server

```bash
# From the backend directory:
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Backend will be live at `http://localhost:8000`. Test health at `http://localhost:8000/health`.

### Step 3: Start Frontend Server

```bash
cd ../frontend
npm install

# Run development server with Hot Module Replacement (HMR)
npm run dev
```
Frontend will be live at `http://localhost:3000`.

*(Alternatively, to run the production build: `npm run build && npm run start`).*

---

## 8. Deployment

### Frontend (Vercel)

1. Connect the repository `sawanb22/bookleaf-author-support-portal` to Vercel.
2. Set Root Directory to `frontend`.
3. Add Environment Variable:
   * `NEXT_PUBLIC_API_URL`: URL of your deployed backend (e.g. `https://bookleaf-api.onrender.com`).
4. Click **Deploy**. Vercel will build and deploy the Next.js App Router project.

### Backend (Render / Railway / Fly.io)

1. Create a new **Web Service** pointing to the repository.
2. Set Root Directory to `backend`.
3. Environment: **Python 3**.
4. Build Command: `pip install -r requirements.txt`.
5. Start Command: `python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
6. Configure Environment Variables in Render dashboard:
   * `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `JWT_SECRET`, `AI_PROVIDER`, `BEDROCK_MODEL_ID`, `AWS_BEARER_TOKEN_BEDROCK`, `ALLOWED_ORIGINS`.

### Database (Neon PostgreSQL)

1. Create a Neon project at [neon.tech](https://neon.tech).
2. Copy the pooled connection string into `DATABASE_URL`.
3. Run `python scripts/seed_canonical.py` from your local terminal with the Neon connection string to populate schema and canonical seed data.

### How to Redeploy

* **Frontend**: Pushing commits to `main` triggers an automatic preview and production deployment on Vercel.
* **Backend**: Pushing commits to `main` triggers automatic container re-build and zero-downtime rolling restart on Render.

---

## 9. Assumptions

1. **Accounting As-Of Date**: The canonical financial data is modeled as a March 2024 fiscal cut-off. Historical royalty numbers reflect audited platform receipts up to that snapshot.
2. **₹1,000 Minimum Payout Policy**: Applied across the author's **aggregate** pending balance across all of their published titles. If an author's combined pending royalty is < ₹1,000 (e.g., Kavita Deshmukh at ₹850), funds roll over to the subsequent quarterly cycle.
3. **No Self-Registration**: In publishing enterprise workflows, author and staff profiles are created during contract onboarding. Public signup is disabled; users log in with pre-provisioned credentials.
4. **First-Reply Status Transition**: When an administrator sends the first official reply to an `Open` ticket, the ticket status automatically transitions to `In progress`, decrementing the `needs_first_reply` operational KPI counter.
5. **Author Data Isolation**: Accessing a ticket that does not belong to the authenticated author returns `404 Not Found` rather than `403 Forbidden` to prevent author ID enumeration.

---

## 10. Testing

### Running Backend Tests

The backend test suite executes 34 automated unit and integration tests covering the full RBAC permission matrix, SQL schema constraints, and AI triage pathways:

```bash
cd backend
python -m pytest -v
```

```
============================== test session starts ==============================
collected 34 items

tests/test_admin.py::test_admin_metrics_endpoint PASSED                    [  2%]
tests/test_admin.py::test_admin_ticket_lifecycle PASSED                     [  5%]
tests/test_ai_triage.py::test_ai_classification_categories PASSED           [  8%]
tests/test_ai_triage.py::test_priority_floors_legal PASSED                 [ 11%]
tests/test_ai_triage.py::test_circuit_breaker_tripping PASSED              [ 14%]
tests/test_ai_triage.py::test_fact_checking_guard PASSED                   [ 17%]
tests/test_auth_rbac.py::test_author_cannot_access_admin PASSED            [ 20%]
tests/test_auth_rbac.py::test_cross_author_isolation_returns_404 PASSED   [ 23%]
tests/test_books.py::test_book_royalty_balance_invariant PASSED            [ 26%]
tests/test_gate1_schema.py::test_schema_constraints PASSED                 [ 29%]
...
======================== 34 passed in 97.89s (0:01:37) ========================
```

### Running Frontend Tests

```bash
cd frontend
npm test
```

### What the Test Suites Cover

1. **RBAC Security Matrix**: Validates that anonymous requests yield `401`, author tokens attempting admin routes yield `403`, and authors probing other authors' ticket IDs receive `404`.
2. **Financial Invariant Verification**: Validates the `chk_royalty_balance` constraint (`total_royalty_earned - royalty_paid = royalty_pending`) across all 18 books.
3. **AI Fallback & Failure Drills**: Mocks downstream Bedrock HTTP 500 errors, verifies that the circuit breaker opens after 5 failures, and ensures that rule-based fallback accurately assigns category and priority without unhandled exceptions.
4. **Idempotent Queue Cleanup**: Test fixtures isolate test-generated records and remove them post-test, leaving the production queue clean.

---

## 11. Known Limitations

1. **Email Delivery Gateway**: Outbound emails to authors are simulated via database audit logging (`ticket_events`) and Server-Sent Events rather than connecting to an active external SMTP/SES relay.
2. **Binary File Attachments**: Attachment uploads in the query composer validate client metadata and file types; cloud object storage (Amazon S3 bucket with presigned upload URLs) is recommended for binary media storage in production.
3. **Single-Node SSE**: Server-Sent Events operate over an in-process memory event bus; multi-node container scaling requires a Redis Pub/Sub backplane.

---

## 12. What I’d Improve with More Time (The Production Path)

1. **Direct Marketplace API Ingestion**: Integrate Amazon Selling Partner API (SP-API) and Flipkart Seller API webhooks to automatically track stock shortages, buy box suppressions, and real-time inventory adjustments.
2. **Inbound Email Webhook Parsing**: Connect SendGrid Inbound Parse or Amazon SES to enable authors to reply to tickets directly from their personal email client.
3. **Asynchronous Background Task Workers**: Move background AI triage and PDF statement compilation to a dedicated worker pool using **Celery** or **ARQ** with Redis.
4. **Automated Banking Payout Rails**: Integrate **RazorpayX** or **Cashfree Payouts** to execute automated quarterly batch transfers when an author's pending royalty exceeds the ₹1,000 threshold.
5. **End-to-End Vector RAG for Backlist Catalogs**: If expanding to thousands of publishing agreements, incorporate pgvector to index bespoke contracts and amendment clauses.

---

## 13. Repository Layout

```
bookleaf-author-support-portal/
├── .env.example                               # Root environment variable template
├── .gitignore                                 # Production git ignore configuration
├── BookLeaf Author Support Portal UI Spec.md  # Client interface and UI design specification
├── DECISIONS.md                               # Architectural Decision Records (ADRs)
├── README.md                                  # Project documentation
├── backend/                                   # FastAPI Python Backend Service
│   ├── .env.example                           # Backend environment template
│   ├── bookleaf_sample_data.json              # Canonical 10-author, 18-book dataset
│   ├── requirements.txt                       # Python dependencies
│   ├── app/
│   │   ├── main.py                            # ASGI application initialization & CORS
│   │   ├── ai/                                # AI triage, knowledge base & Bedrock Mantle client
│   │   │   ├── guards.py                      # Priority floors & financial fact-checking
│   │   │   ├── knowledge_base.py              # In-context BookLeaf publishing policies
│   │   │   └── llm.py                         # Bedrock MiniMax M2.5 integration & formatting
│   │   ├── api/                               # REST API routers (v1 endpoints)
│   │   │   ├── deps.py                        # Dependency injection & RBAC security guards
│   │   │   ├── health.py                      # Liveness and readiness probes
│   │   │   └── v1/                            # Author, Admin, and Auth routes
│   │   ├── core/                              # App configuration & Argon2id security
│   │   ├── db/                                # PostgreSQL schema and asyncpg connection pool
│   │   ├── schemas/                           # Pydantic v2 data transfer objects (DTOs)
│   │   └── services/                          # Business logic & ticket lifecycle services
│   ├── scripts/                               # Database migration and canonical seed scripts
│   └── tests/                                 # Pytest test suite (34 automated tests)
├── frontend/                                  # Next.js 14 App Router Frontend
│   ├── .env.example                           # Frontend environment template
│   ├── package.json                           # Node dependencies and scripts
│   ├── app/
│   │   ├── (author)/                          # Author route group (Books, Tickets, New Ticket)
│   │   ├── admin/                             # Admin triage desk & ticket inspection
│   │   ├── login/                             # Unified credentials login screen
│   │   └── layout.tsx                         # Root layout and theme providers
│   ├── components/                            # Reusable React UI components
│   │   ├── admin/                             # MetricCards, PriorityGlyph, FilterBar
│   │   ├── author/                            # TopNavBar, MobileTabBar, ProductionStageBar
│   │   └── shared/                            # MessageBlock, StatusBadge, AttachmentDropzone
│   ├── lib/                                   # API client, date formatters, and type definitions
│   └── tests/                                 # Unit, adversarial, and E2E browser tests
└── docs/                                      # Documentation assets
    └── screenshots/                           # Author, admin, and AI assist screenshots
```
