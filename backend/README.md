# BookLeaf Author Support Portal - FastAPI Backend

A standalone Python FastAPI service implementing the BookLeaf Author Support Portal REST API, Neon PostgreSQL persistence, and AWS Bedrock Mantle AI triage.

## Architecture

- **Framework**: FastAPI (Python 3.10+) with Pydantic v2 schemas.
- **Database**: Neon Serverless PostgreSQL with `asyncpg` connection pool.
- **Security**: JWT tokens (HS256) with role-based access control (`author` vs `admin`).
- **AI Engine**: Bedrock Mantle client (`minimax.minimax-m2.5` chat completions) with deterministic priority floors, circuit breaker, timeout guards, and numeric fact-checking.
- **Real-Time**: Server-Sent Events (SSE) at `/api/v1/me/stream` and `/api/v1/admin/stream`.

## Directory Structure

```
backend/
├── app/
│   ├── main.py                   # FastAPI application & lifecycle management
│   ├── core/
│   │   ├── config.py             # Settings, .env resolution
│   │   └── security.py           # JWT token creation/verification, password hashing
│   ├── db/
│   │   ├── session.py            # Neon asyncpg pool & query helpers
│   │   └── schema.sql            # PostgreSQL schema definition
│   ├── schemas/                  # Pydantic v2 schemas
│   │   ├── auth.py
│   │   ├── book.py
│   │   ├── ticket.py
│   │   └── ai.py
│   ├── services/                 # Business logic
│   │   ├── auth_service.py
│   │   ├── book_service.py
│   │   ├── ticket_service.py
│   │   ├── admin_ticket_service.py
│   │   └── event_bus.py
│   ├── ai/                       # AI triage & Bedrock client
│   │   ├── llm.py
│   │   ├── knowledge_base.py
│   │   └── guards.py
│   └── api/                      # REST API endpoints
│       ├── deps.py               # Auth & RBAC dependencies
│       ├── health.py             # /health & /health/ready
│       └── v1/                   # /api/v1/* routes
│           ├── auth.py           # /auth/login, /auth/me
│           ├── me.py             # /me/books, /me/tickets, /me/stream
│           └── admin.py          # /admin/tickets, /admin/stats, /admin/stream
├── tests/                        # Comprehensive pytest test suite
│   ├── conftest.py
│   ├── test_health.py
│   ├── test_auth_rbac.py
│   ├── test_books.py
│   ├── test_tickets.py
│   ├── test_admin.py
│   ├── test_ai_triage.py
│   └── test_db_integration.py
├── requirements.txt
├── pytest.ini
├── .env.example
└── README.md
```

## Setup & Running

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Configure Environment
Copy `.env.example` to `.env` and fill in `DATABASE_URL` (Neon PostgreSQL) and optional Bedrock keys:
```bash
cp .env.example .env
```

### 3. Run FastAPI Backend
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Interactive API documentation will be available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### 4. Run Test Suite
```bash
pytest
```
