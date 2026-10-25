# BookLeaf Author Support Portal

A production-grade, full-stack Author Support Portal and Admin Triage System built for BookLeaf Publishing. The platform pairs a high-performance **FastAPI (Python 3.10+)** backend with a responsive **Next.js 14 (App Router)** frontend, powered by **Neon Serverless PostgreSQL** and **AWS Bedrock AI** for intelligent support ticket classification, priority routing, and draft response generation.

---

## 1. Quick Startup Instructions

### Prerequisites
- Python 3.10+
- Node.js 18+ (LTS) & npm
- PostgreSQL connection (pre-configured via Neon in `backend/.env`)

### 1. Backend Service (FastAPI)
```bash
# Navigate to backend directory
cd backend

# Install dependencies
pip install -r requirements.txt

# Start FastAPI server with live reload on port 8000
uvicorn app.main:app --port 8000 --reload
```
- API Base URL: `http://localhost:8000`
- Interactive Swagger UI: `http://localhost:8000/docs`
- Health Probes: `http://localhost:8000/health` and `http://localhost:8000/health/ready`

### 2. Frontend Application (Next.js)
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Build production bundle
npm run build

# Start production server on port 3000
npm run start
```
*(For local frontend development with fast refresh, run `npm run dev` instead).*
- Application URL: `http://localhost:3000`

---

## 2. Demo Credentials

All test accounts use the password `demo` (stored securely in Neon PostgreSQL using Argon2id password hashing):

| User | Role | Email | Password | Context & Invariants |
| :--- | :--- | :--- | :--- | :--- |
| **Priya Sharma** (`AUTH001`) | `author` | `priya.sharma@email.com` | `demo` | 2 live books (`BK001`, `BK002`). Royalty: ₹19,908 earned, ₹16,338 paid, ₹3,570 pending. |
| **Kavita Deshmukh** (`AUTH009`) | `author` | `kavita.deshmukh@email.com` | `demo` | 2 books: `BK014` (live) & `BK015` (in typesetting, 9-stage tracker). ₹850 pending triggers ₹1,000 threshold roll-over note. |
| **Admin 1 (Primary)** | `admin` | `admin@bookleaf.test` | `demo` | Operations Admin: Full triage queue access, urgency sorting, status updates, team assignment. |
| **Admin 2 (Operations)** | `admin` | `ops.admin@bookleaf.demo` | `demo` | Support Lead: KPI operational metrics, AI draft suggestion reviews, internal staff notes. |

---

## 3. Database Architecture & Catalog Integrity

The database is deployed on **Neon Serverless PostgreSQL** with schema-enforced relational integrity:

### Core Dataset Totals (100% Intact)
- **Users**: 12 accounts (10 authors, 2 admins)
- **Authors**: 10 author profiles (`AUTH001` through `AUTH010`)
- **Books**: 18 titles (16 live published titles, 2 in production: `BK013` and `BK015`)
- **Platform Links**: 46 retail channel distribution records across Amazon, Flipkart, Kindle, and Google Books

### Financial Accounting Invariants
- **Copies Sold**: Exactly `7,205` copies
- **Total Royalty Earned**: Exactly `₹2,43,382.00`
- **Total Royalty Paid**: Exactly `₹2,02,543.00`
- **Total Royalty Pending**: Exactly `₹40,839.00`
- **Integrity Rule**: `chk_royalty_balance` constraint (`total_royalty_earned - royalty_paid = royalty_pending`) is enforced on every book row.

### Clean Slate Support Ticket Queue
Per client deployment requirements, all pre-seeded tickets in `tickets`, `ticket_messages`, `ticket_notes`, and `ticket_events` have been cleared (`count = 0`). The support ticket queue is 100% clean and ready for fresh end-to-end client testing and AI evaluation.

---

## 4. AI Engine: AWS Bedrock Mantle (`minimax.minimax-m2.5`)

### Model Selection Rationale
The platform connects to AWS Bedrock Mantle leveraging the **MiniMax M2.5** (`minimax.minimax-m2.5`) chat completion model:
1. **Bilingual & Indic Context Understanding**: Excels at interpreting Indian English publishing idioms, author grievances, and contextual queries (e.g., royalty cycles, author copy physical damages).
2. **Reliable Structured Output**: Consistently outputs valid, schema-compliant JSON payloads for automated classification (`category`, `priority`, `confidence`, `reasoning`).
3. **Reasoning Token Filtering**: Embedded `<think>...</think>` cognitive traces are automatically stripped via `strip_reasoning_tokens()` before parsing to prevent downstream JSON parse exceptions.
4. **Cost and Throughput Performance**: High inference throughput with low per-token cost, ideal for high-volume support triage.

### SLA Timeouts & Safety Guards
- **Two-Tier Timeouts**:
  - Classification Triage: **30 seconds** (`AI_CLASSIFY_TIMEOUT_SEC = 30`)
  - Draft Response Synthesis: **45 seconds** (`AI_DRAFT_TIMEOUT_SEC = 45`)
- **Deterministic Priority Floors**:
  - Legal escalation / Consumer court mentions: **Critical** priority floor.
  - Two or more overdue quarterly royalty payout cycles: **Critical** priority floor.
  - ISBN mismatch / retail metadata error: **High** priority floor.
  - Damaged / blurry / misaligned author copies: **High** priority floor.
  - Live book showing "Currently Unavailable": **High** priority floor.
- **Circuit Breaker**:
  - Monitors consecutive downstream Bedrock failures.
  - Trips open after **5 consecutive failures** with a **60-second recovery timeout**.
  - While open, requests instantly bypass remote network calls to deterministic local keyword triage, preventing request latency pileups.
- **Numeric Fact-Checking Guard**:
  - All currency amounts cited in generated draft responses are verified against the author's database facts block (`total_royalty_earned`, `royalty_paid`, `royalty_pending`) and BookLeaf's ₹1,000 payout policy.
  - Hallucinated or unverified figures are automatically flagged in `ai_draft_unverified` for administrative review.

---

## 5. Security & Isolation Architecture

1. **Role-Based Access Control (RBAC)**:
   - Anonymous requests to `/api/v1/me/*` or `/api/v1/admin/*` are rejected with `401 Unauthorized`.
   - Author tokens attempting to access `/api/v1/admin/*` are rejected with `403 Forbidden`.
2. **Strict Cross-Author Data Isolation**:
   - Accessing a ticket that belongs to another author returns `404 Not Found` (never `403`), preventing author ID enumeration or timing probe attacks.
3. **Payload Hardening**:
   - Pydantic models enforce `extra='forbid'`, blocking payload spoofing (e.g., injecting `author_id` or forcing `status`).
4. **Environment Sanitization (Gate 6)**:
   - `frontend/.env.local` contains exclusively public browser-safe configuration (`NEXT_PUBLIC_API_URL=http://localhost:8000`).
   - Neon PostgreSQL connection URIs, JWT secrets, and AWS Bearer tokens reside strictly in `backend/.env` and are excluded from git via root and backend `.gitignore`.

---

## 6. Build & Test Verification (Gates 6, 7 & 8)

### Backend Test Suite
All 34 backend automated tests pass cleanly with dynamic test entity isolation:
```bash
cd backend
python -m pytest
```
Output:
```
======================== 34 passed in 97.89s (0:01:37) ========================
```
- Tests cover health probes, JWT auth & RBAC, book catalog invariants, ticket lifecycle & data isolation, admin triage actions, AI classification heuristics & priority floors, and PostgreSQL relational constraints.
- Tests dynamically create and clean up test tickets in `try...finally` blocks, leaving the PostgreSQL support queue 100% clean post-test.

### Frontend Production Build
Frontend compiles cleanly with zero TypeScript errors and zero bundle warnings:
```bash
cd frontend
npm run build
```
Output:
```
 ✓ Compiled successfully
 ✓ Generating static pages (9/9)
Route (app)                              Size     First Load JS
┌ ○ /                                    1.39 kB        95.4 kB
├ ○ /_not-found                          873 B          88.2 kB
├ ○ /admin/tickets                       10.8 kB         114 kB
├ ƒ /admin/tickets/[id]                  5.28 kB         108 kB
├ ○ /books                               5.65 kB         109 kB
├ ○ /login                               5.43 kB        99.4 kB
├ ○ /tickets                             5.94 kB         109 kB
├ ƒ /tickets/[id]                        7.86 kB         111 kB
└ ○ /tickets/new                         9.35 kB         112 kB
```

---

## 7. Known Architectural Limitations & Operational Boundaries

1. **Email Notification Gateway**: Outbound author email notification delivery is modeled via database event logging (`ticket_events`) and Server-Sent Events (SSE); integration with an external SMTP/SES provider is planned for a future release.
2. **File Attachment Storage**: File attachments in the support query composer are staged on the client with metadata tracking; cloud object storage (S3 bucket with presigned URLs) can be attached for persistent binary uploads.
3. **SSE Connection Limits**: Server-Sent Events connections utilize standard HTTP streaming; in high-density multi-tenant deployments, an edge reverse proxy (e.g., NGINX / Cloudflare) with HTTP/2 is recommended for persistent stream multiplexing.
