#!/usr/bin/env python3
"""
BookLeaf Author Support Portal - Canonical Dataset Seeder
Milestone 1: Database Schema, Relational Invariants & Canonical Dataset Alignment (Gate 1).

Authoritative source: C:\\Users\\Administrator\\Downloads\\bookleaf_sample_data.json
Ensures:
- 10 Author Users + 2 Admin Users = 12 Users (all with argon2id password hashes)
- 10 Authors in `authors`
- 18 Books in `books` (16 Published & Live, 2 In Production: BK013 and BK015)
- 46 Platform Rows in `book_platforms`
- Financial Aggregates:
  * Sold: 7,205 copies
  * Earned: ₹2,43,382
  * Paid: ₹2,02,543
  * Pending: ₹40,839
- Invariant: total_royalty_earned - royalty_paid = royalty_pending (chk_royalty_balance)
- 8 Demo Tickets (D1-D8, including BL-1042 for Priya Sharma)
- 10 Public Tables: ai_calls, alembic_version, authors, book_platforms, books,
  ticket_events, ticket_messages, ticket_notes, tickets, users
"""

import os
import sys
import json
import asyncio
from pathlib import Path
from datetime import datetime, timezone

# Ensure backend root is on sys.path
backend_root = Path(__file__).resolve().parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import db

SAMPLE_DATA_PATH = backend_root / "bookleaf_sample_data.json"
if not SAMPLE_DATA_PATH.exists():
    SAMPLE_DATA_PATH = Path(r"C:\Users\Administrator\Downloads\bookleaf_sample_data.json")

# Bank details for realistic author facts block
AUTHOR_BANK_DETAILS = {
    "AUTH001": ("HDFC Bank", "4091"),
    "AUTH002": ("ICICI Bank", "1029"),
    "AUTH003": ("State Bank of India", "7821"),
    "AUTH004": ("Axis Bank", "5543"),
    "AUTH005": ("Federal Bank", "3390"),
    "AUTH006": ("Punjab National Bank", "9012"),
    "AUTH007": ("Canara Bank", "4418"),
    "AUTH008": ("Bank of Baroda", "6720"),
    "AUTH009": ("Union Bank of India", "8834"),
    "AUTH010": ("Kotak Mahindra Bank", "2156"),
}

ADMIN_USERS = [
    {
        "id": "admin_ops",
        "email": "ops.admin@bookleaf.demo",
        "name": "Ops Admin",
        "role": "admin",
        "title": "Operations Lead",
        "avatar_initials": "OA",
        "bank_name": None,
        "account_last4": None,
    },
    {
        "id": "admin_support",
        "email": "support.lead@bookleaf.demo",
        "name": "Support Lead",
        "role": "admin",
        "title": "Support Lead",
        "avatar_initials": "SL",
        "bank_name": None,
        "account_last4": None,
    },
]

DEMO_TICKETS = [
    {
        "id": "BL-1001",
        "author_id": "AUTH003",
        "book_id": "BK005",
        "book_title": "Between Two Temples",
        "subject": "No royalty received since my book was published",
        "description": "I published Between Two Temples 4 months ago and still haven't received any royalty payout. When will my earnings be disbursed?",
        "category": "royalty_payments",
        "priority": "Critical",
        "status": "Open",
        "assignee": None,
        "assignee_id": None,
        "ai_status": "completed",
        "ai_category": "royalty_payments",
        "ai_priority": "Critical",
        "created_at": "2026-10-23T10:00:00Z",
    },
    {
        "id": "BL-1002",
        "author_id": "AUTH005",
        "book_id": "BK009",
        "book_title": "Letters from Lakshadweep",
        "subject": "My royalty looks too low for 201 copies",
        "description": "I sold 201 copies of Letters from Lakshadweep but my statement shows ₹8,000 paid. Could you provide a detailed breakdown of deductions?",
        "category": "royalty_payments",
        "priority": "Medium",
        "status": "Open",
        "assignee": None,
        "assignee_id": None,
        "ai_status": "completed",
        "ai_category": "royalty_payments",
        "ai_priority": "Medium",
        "created_at": "2026-10-23T14:30:00Z",
    },
    {
        "id": "BL-1003",
        "author_id": "AUTH002",
        "book_id": "BK003",
        "book_title": "Code & Karma",
        "subject": "ISBN on Amazon differs from my printed copy",
        "description": "The ISBN listed on the Amazon product page does not match the ISBN printed on the back cover of my author copy.",
        "category": "isbn_metadata",
        "priority": "High",
        "status": "In progress",
        "assignee": "Ops Admin",
        "assignee_id": "admin_ops",
        "ai_status": "completed",
        "ai_category": "isbn_metadata",
        "ai_priority": "High",
        "created_at": "2026-10-24T09:15:00Z",
    },
    {
        "id": "BL-1004",
        "author_id": "AUTH007",
        "book_id": "BK011",
        "book_title": "The Algorithm of Love",
        "subject": "Author copies arrived with blurry, misaligned pages",
        "description": "My bundle of 20 author copies arrived yesterday. The chapter header images are visibly blurry and several pages in section 2 are misaligned.",
        "category": "printing_quality",
        "priority": "High",
        "status": "Open",
        "assignee": None,
        "assignee_id": None,
        "ai_status": "completed",
        "ai_category": "printing_quality",
        "ai_priority": "High",
        "created_at": "2026-10-24T11:45:00Z",
    },
    {
        "id": "BL-1005",
        "author_id": "AUTH010",
        "book_id": "BK018",
        "book_title": "Howrah Nights",
        "subject": "Showing as Currently Unavailable on Amazon",
        "description": "Readers contacted me today saying Howrah Nights is marked as 'Currently Unavailable' on Amazon India even though stock was reported live.",
        "category": "distribution_availability",
        "priority": "High",
        "status": "Open",
        "assignee": None,
        "assignee_id": None,
        "ai_status": "completed",
        "ai_category": "distribution_availability",
        "ai_priority": "High",
        "created_at": "2026-10-24T15:00:00Z",
    },
    {
        "id": "BL-1006",
        "author_id": "AUTH009",
        "book_id": "BK015",
        "book_title": "Raising Roots",
        "subject": "Still in typesetting, when will it be done",
        "description": "It has been over 3 weeks since my manuscript moved to typesetting. Could you give me an updated timeline for when proofreading begins?",
        "category": "book_status_production",
        "priority": "Medium",
        "status": "Open",
        "assignee": None,
        "assignee_id": None,
        "ai_status": "completed",
        "ai_category": "book_status_production",
        "ai_priority": "Medium",
        "created_at": "2026-10-25T08:30:00Z",
    },
    {
        "id": "BL-1007",
        "author_id": "AUTH009",
        "book_id": "BK016",
        "book_title": "The Nagpur Notebooks",
        "subject": "Why has nothing been paid yet",
        "description": "I see 34 copies sold of The Nagpur Notebooks earning ₹850, but my payout amount is zero. Why haven't funds been transferred?",
        "category": "royalty_payments",
        "priority": "Medium",
        "status": "Resolved",
        "assignee": "Support Lead",
        "assignee_id": "admin_support",
        "ai_status": "completed",
        "ai_category": "royalty_payments",
        "ai_priority": "Medium",
        "created_at": "2026-10-25T09:00:00Z",
    },
    {
        "id": "BL-1042",
        "author_id": "AUTH001",
        "book_id": "BK001",
        "book_title": "Whispers of the Ganges",
        "subject": "Can I update my book description on Amazon",
        "description": "Can I update the blurb and description of Whispers of the Ganges on Amazon? I have added a notable review quote from a literary festival.",
        "category": "general_inquiry",
        "priority": "Low",
        "status": "Open",
        "assignee": None,
        "assignee_id": None,
        "ai_status": "completed",
        "ai_category": "general_inquiry",
        "ai_priority": "Low",
        "created_at": "2026-10-25T09:45:00Z",
    },
]


async def apply_schema():
    """Ensure all 10 tables, triggers, indexes, and constraints exist in Neon DB."""
    schema_file = backend_root / "app" / "db" / "schema.sql"
    if not schema_file.exists():
        raise FileNotFoundError(f"Schema file not found at {schema_file}")
    
    sql = schema_file.read_text(encoding="utf-8")
    
    # Split statements carefully and execute
    pool = await db.get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            # Clean old mock records that may violate new composite constraints
            await conn.execute("""
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ticket_events') THEN
                        DELETE FROM ticket_events;
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ticket_notes') THEN
                        DELETE FROM ticket_notes;
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ticket_messages') THEN
                        DELETE FROM ticket_messages;
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tickets') THEN
                        DELETE FROM tickets;
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'book_platforms') THEN
                        DELETE FROM book_platforms;
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'books') THEN
                        DELETE FROM books;
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'authors') THEN
                        DELETE FROM authors;
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
                        DELETE FROM users;
                    END IF;
                END $$;
            """)

            # First ensure lower email unique index on users if users exists
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS users (

                    id VARCHAR(64) PRIMARY KEY,
                    email VARCHAR(255) NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    role VARCHAR(32) NOT NULL CHECK (role IN ('author', 'admin')),
                    password_hash VARCHAR(255) NOT NULL,
                    avatar_initials VARCHAR(8),
                    title VARCHAR(128),
                    bank_name VARCHAR(128),
                    account_last4 VARCHAR(8),
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
            """)

            # Drop old non-case-insensitive users_email_key constraint/index if it exists as normal btree(email)
            await conn.execute("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.table_constraints 
                        WHERE table_schema = 'public' 
                          AND table_name = 'users' 
                          AND constraint_name = 'users_email_key'
                    ) THEN
                        ALTER TABLE users DROP CONSTRAINT users_email_key;
                    END IF;
                    IF EXISTS (
                        SELECT 1 FROM pg_indexes 
                        WHERE schemaname = 'public' 
                          AND tablename = 'users' 
                          AND indexname = 'users_email_key'
                          AND indexdef NOT LIKE '%lower(%'
                    ) THEN
                        DROP INDEX users_email_key;
                    END IF;
                END $$;
                CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users (LOWER(email));
            """)


            # Create authors table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS authors (
                    id VARCHAR(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                    external_id VARCHAR(32) NOT NULL UNIQUE,
                    user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
                    name VARCHAR(255) NOT NULL,
                    email VARCHAR(255) NOT NULL,
                    phone VARCHAR(64),
                    city VARCHAR(128),
                    joined_date DATE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
            """)

            # Ensure books table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS books (
                    id VARCHAR(64) PRIMARY KEY,
                    external_id VARCHAR(32) NOT NULL UNIQUE,
                    author_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    title VARCHAR(255) NOT NULL,
                    isbn VARCHAR(64),
                    genre VARCHAR(128),
                    publication_date DATE,
                    status VARCHAR(64) NOT NULL,
                    stage VARCHAR(64),
                    mrp NUMERIC(10, 2),
                    author_royalty_per_copy NUMERIC(10, 2),
                    total_copies_sold INTEGER NOT NULL DEFAULT 0,
                    total_royalty_earned NUMERIC(10, 2) NOT NULL DEFAULT 0,
                    royalty_paid NUMERIC(10, 2) NOT NULL DEFAULT 0,
                    royalty_pending NUMERIC(10, 2) NOT NULL DEFAULT 0,
                    last_royalty_payout_date DATE,
                    print_partner VARCHAR(255),
                    platforms JSONB NOT NULL DEFAULT '[]'::jsonb,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    CONSTRAINT chk_royalty_balance CHECK (total_royalty_earned - royalty_paid = royalty_pending),
                    CONSTRAINT uq_books_author_id UNIQUE (author_id, id)
                );
            """)

            # Ensure author_royalty_per_copy column exists in books
            await conn.execute("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_schema = 'public' AND table_name = 'books' AND column_name = 'author_royalty_per_copy'
                    ) THEN
                        ALTER TABLE books ADD COLUMN author_royalty_per_copy NUMERIC(10, 2);
                    END IF;
                END $$;
            """)

            # Ensure uq_books_author_id exists in books
            await conn.execute("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.table_constraints 
                        WHERE table_schema = 'public' AND table_name = 'books' AND constraint_name = 'uq_books_author_id'
                    ) THEN
                        ALTER TABLE books ADD CONSTRAINT uq_books_author_id UNIQUE (author_id, id);
                    END IF;
                END $$;
            """)

            # Create book_platforms table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS book_platforms (
                    id SERIAL PRIMARY KEY,
                    book_id VARCHAR(64) NOT NULL REFERENCES books(id) ON DELETE CASCADE,
                    platform_name VARCHAR(128) NOT NULL,
                    url VARCHAR(512),
                    is_active BOOLEAN NOT NULL DEFAULT true,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    CONSTRAINT uq_book_platform UNIQUE (book_id, platform_name)
                );
                CREATE INDEX IF NOT EXISTS idx_platforms_book ON book_platforms (book_id);
            """)

            # Create ticket sequence and tickets table
            await conn.execute("""
                CREATE SEQUENCE IF NOT EXISTS ticket_seq START 1050;

                CREATE TABLE IF NOT EXISTS tickets (
                    id VARCHAR(64) PRIMARY KEY DEFAULT ('BL-' || NEXTVAL('ticket_seq')::TEXT),
                    subject VARCHAR(200) NOT NULL,
                    description TEXT NOT NULL,
                    author_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    book_id VARCHAR(64),
                    book_title VARCHAR(255),
                    status VARCHAR(32) NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In progress', 'Resolved', 'Closed')),
                    priority VARCHAR(32) NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Critical', 'High', 'Medium', 'Low')),
                    category VARCHAR(64) NOT NULL DEFAULT 'general_inquiry',
                    ai_category VARCHAR(64),
                    ai_priority VARCHAR(32),
                    ai_reasoning TEXT,
                    ai_confidence NUMERIC(3, 2),
                    ai_status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (ai_status IN ('pending', 'completed', 'failed')),
                    ai_draft TEXT,
                    ai_draft_missing_info JSONB DEFAULT '[]'::jsonb,
                    ai_draft_escalation BOOLEAN DEFAULT false,
                    ai_draft_unverified JSONB DEFAULT '[]'::jsonb,
                    category_overridden BOOLEAN NOT NULL DEFAULT false,
                    priority_overridden BOOLEAN NOT NULL DEFAULT false,
                    assignee VARCHAR(128),
                    assignee_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
                    has_unread BOOLEAN NOT NULL DEFAULT false,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
            """)

            # Set default id for tickets if not already set
            await conn.execute("""
                ALTER TABLE tickets ALTER COLUMN id SET DEFAULT ('BL-' || NEXTVAL('ticket_seq')::TEXT);
            """)

            # Ensure composite foreign key tickets_book_owner_fk
            await conn.execute("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.table_constraints 
                        WHERE table_schema = 'public' AND table_name = 'tickets' AND constraint_name = 'tickets_book_owner_fk'
                    ) THEN
                        -- drop old single-column FK if exists
                        IF EXISTS (
                            SELECT 1 FROM information_schema.table_constraints 
                            WHERE table_schema = 'public' AND table_name = 'tickets' AND constraint_name = 'tickets_book_id_fkey'
                        ) THEN
                            ALTER TABLE tickets DROP CONSTRAINT tickets_book_id_fkey;
                        END IF;
                        ALTER TABLE tickets ADD CONSTRAINT tickets_book_owner_fk 
                            FOREIGN KEY (author_id, book_id) REFERENCES books (author_id, id) ON DELETE SET NULL;
                    END IF;
                END $$;
            """)

            # Messages, notes, events, ai_calls
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS ticket_messages (
                    id VARCHAR(64) PRIMARY KEY,
                    ticket_id VARCHAR(64) NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
                    sender_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
                    sender_name VARCHAR(255) NOT NULL,
                    sender_role VARCHAR(32) NOT NULL CHECK (sender_role IN ('author', 'support', 'admin', 'ai')),
                    body TEXT NOT NULL,
                    is_from_staff BOOLEAN NOT NULL DEFAULT false,
                    is_internal_note BOOLEAN NOT NULL DEFAULT false,
                    from_ai_draft BOOLEAN NOT NULL DEFAULT false,
                    draft_edited BOOLEAN NOT NULL DEFAULT false,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS ticket_notes (
                    id VARCHAR(64) PRIMARY KEY DEFAULT ('note_' || SUBSTRING(MD5(RANDOM()::TEXT), 1, 12)),
                    ticket_id VARCHAR(64) NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
                    admin_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
                    author_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
                    author_name VARCHAR(255) DEFAULT 'Staff',
                    body TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );

                -- Ensure admin_id and default id on ticket_notes
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_schema = 'public' AND table_name = 'ticket_notes' AND column_name = 'admin_id'
                    ) THEN
                        ALTER TABLE ticket_notes ADD COLUMN admin_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL;
                    END IF;
                END $$;
                ALTER TABLE ticket_notes ALTER COLUMN id SET DEFAULT ('note_' || SUBSTRING(MD5(RANDOM()::TEXT), 1, 12));
                ALTER TABLE ticket_notes ALTER COLUMN author_id DROP NOT NULL;
                ALTER TABLE ticket_notes ALTER COLUMN author_name DROP NOT NULL;

                CREATE TABLE IF NOT EXISTS ticket_events (
                    id VARCHAR(64) PRIMARY KEY DEFAULT ('evt_' || SUBSTRING(MD5(RANDOM()::TEXT), 1, 12)),
                    ticket_id VARCHAR(64) NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
                    actor_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
                    actor_name VARCHAR(255),
                    event_type VARCHAR(64) NOT NULL,
                    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                ALTER TABLE ticket_events ALTER COLUMN id SET DEFAULT ('evt_' || SUBSTRING(MD5(RANDOM()::TEXT), 1, 12));

                CREATE TABLE IF NOT EXISTS ai_calls (
                    id SERIAL PRIMARY KEY,
                    ticket_id VARCHAR(64) REFERENCES tickets(id) ON DELETE SET NULL,
                    call_type VARCHAR(32) NOT NULL,
                    model VARCHAR(64) NOT NULL,
                    prompt_tokens INTEGER DEFAULT 0,
                    completion_tokens INTEGER DEFAULT 0,
                    latency_ms INTEGER DEFAULT 0,
                    status VARCHAR(32) NOT NULL,
                    error_message TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS alembic_version (
                    version_num VARCHAR(32) NOT NULL PRIMARY KEY
                );
            """)

            # Triggers: update tickets.updated_at on ticket_messages insert
            await conn.execute("""
                CREATE OR REPLACE FUNCTION fn_bump_ticket_updated_at()
                RETURNS TRIGGER AS $$
                BEGIN
                    UPDATE tickets SET updated_at = NOW() WHERE id = NEW.ticket_id;
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;

                DROP TRIGGER IF EXISTS trg_ticket_messages_bump ON ticket_messages;
                CREATE TRIGGER trg_ticket_messages_bump
                AFTER INSERT ON ticket_messages
                FOR EACH ROW
                EXECUTE FUNCTION fn_bump_ticket_updated_at();
            """)

            # Indexes
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_books_author ON books (author_id);
                CREATE INDEX IF NOT EXISTS idx_tickets_author ON tickets (author_id, created_at DESC);
                CREATE INDEX IF NOT EXISTS idx_tickets_queue ON tickets (status, priority, created_at ASC);
                CREATE INDEX IF NOT EXISTS tickets_queue_idx ON tickets (priority, created_at ASC) 
                    WHERE status IN ('Open', 'In progress', 'open', 'in_progress');
                CREATE INDEX IF NOT EXISTS idx_messages_ticket ON ticket_messages (ticket_id, created_at ASC);
                CREATE INDEX IF NOT EXISTS idx_notes_ticket ON ticket_notes (ticket_id, created_at ASC);
                CREATE INDEX IF NOT EXISTS idx_events_ticket ON ticket_events (ticket_id, created_at ASC);
            """)

    print("[OK] PostgreSQL schema, constraints, composite FK, triggers, and indexes aligned.")


async def seed_data():
    """Load canonical sample dataset and seed tables idempotently."""
    if not SAMPLE_DATA_PATH.exists():
        raise FileNotFoundError(f"Canonical sample data not found at {SAMPLE_DATA_PATH}")

    with open(SAMPLE_DATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    authors_data = data.get("authors", [])
    if len(authors_data) != 10:
        raise ValueError(f"Expected 10 authors, found {len(authors_data)}")

    demo_password_hash = hash_password("demo")
    assert demo_password_hash.startswith("$argon2id$"), "Password hash must be argon2id!"

    pool = await db.get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            print("[INFO] Cleaning any existing tickets, messages, notes, platforms for canonical reload...")
            # Clean old records to ensure clean canonical state
            await conn.execute("DELETE FROM ticket_events;")
            await conn.execute("DELETE FROM ticket_notes;")
            await conn.execute("DELETE FROM ticket_messages;")
            await conn.execute("DELETE FROM tickets;")
            await conn.execute("DELETE FROM book_platforms;")
            await conn.execute("DELETE FROM books;")
            await conn.execute("DELETE FROM authors;")
            await conn.execute("DELETE FROM users;")

            # 1. Seed 10 Author Users + 2 Admin Users = 12 Users
            print("[INFO] Seeding 12 users (10 authors + 2 admins)...")
            user_tuples = []
            author_tuples = []

            for author in authors_data:
                author_id = author["author_id"]
                name = author["name"]
                email = author["email"].lower().strip()
                phone = author["phone"]
                city = author["city"]
                joined = datetime.strptime(author["joined_date"], "%Y-%m-%d").date()

                # Initials
                parts = name.split()
                initials = (parts[0][0] + parts[-1][0]).upper() if len(parts) >= 2 else name[:2].upper()

                bank_name, acct_last4 = AUTHOR_BANK_DETAILS.get(author_id, ("HDFC Bank", "1234"))

                user_tuples.append((
                    author_id, email, name, "author", demo_password_hash,
                    initials, "Author", bank_name, acct_last4
                ))
                author_tuples.append((
                    author_id, author_id, author_id, name, email, phone, city, joined
                ))

            for admin in ADMIN_USERS:
                user_tuples.append((
                    admin["id"], admin["email"], admin["name"], admin["role"],
                    demo_password_hash, admin["avatar_initials"], admin["title"],
                    admin["bank_name"], admin["account_last4"]
                ))

            await conn.executemany("""
                INSERT INTO users (
                    id, email, name, role, password_hash, avatar_initials, title, bank_name, account_last4
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            """, user_tuples)

            # 2. Seed 10 Authors
            print("[INFO] Seeding 10 authors...")
            await conn.executemany("""
                INSERT INTO authors (
                    id, external_id, user_id, name, email, phone, city, joined_date
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            """, author_tuples)

            # 3. Seed 18 Books & 46 Book Platforms
            print("[INFO] Seeding 18 books and 46 platform entries...")
            book_tuples = []
            platform_tuples = []

            for author in authors_data:
                author_id = author["author_id"]
                for b in author.get("books", []):
                    book_id = b["book_id"]
                    external_id = book_id
                    title = b["title"]
                    isbn = b.get("isbn")
                    genre = b.get("genre")
                    pub_date_str = b.get("publication_date")
                    pub_date = datetime.strptime(pub_date_str, "%Y-%m-%d").date() if pub_date_str else None
                    status = b["status"]
                    
                    # Stage extraction for in-production
                    stage = None
                    if "In Production" in status:
                        if "Cover Design" in status:
                            stage = "Cover Design"
                        elif "Typesetting" in status:
                            stage = "Typesetting"
                        elif "Editing" in status:
                            stage = "Editing"

                    mrp = float(b["mrp"]) if b.get("mrp") is not None else None
                    royalty_per_copy = float(b["author_royalty_per_copy"]) if b.get("author_royalty_per_copy") is not None else None
                    copies_sold = int(b.get("total_copies_sold") or 0)
                    earned = float(b.get("total_royalty_earned") or 0.0)
                    paid = float(b.get("royalty_paid") or 0.0)
                    pending = float(b.get("royalty_pending") or 0.0)

                    # Verify invariant before writing
                    assert round(earned - paid, 2) == round(pending, 2), (
                        f"Invariant violated for {book_id}: {earned} - {paid} != {pending}"
                    )

                    last_payout_str = b.get("last_royalty_payout_date")
                    last_payout = datetime.strptime(last_payout_str, "%Y-%m-%d").date() if last_payout_str else None
                    partner = b.get("print_partner")
                    available_on = b.get("available_on") or []

                    book_tuples.append((
                        book_id, external_id, author_id, title, isbn, genre,
                        pub_date, status, stage, mrp, royalty_per_copy,
                        copies_sold, earned, paid, pending, last_payout,
                        partner, json.dumps(available_on)
                    ))

                    for p in available_on:
                        platform_tuples.append((book_id, p, True))

            await conn.executemany("""
                INSERT INTO books (
                    id, external_id, author_id, title, isbn, genre,
                    publication_date, status, stage, mrp, author_royalty_per_copy,
                    total_copies_sold, total_royalty_earned, royalty_paid, royalty_pending,
                    last_royalty_payout_date, print_partner, platforms
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::jsonb
                )
            """, book_tuples)

            await conn.executemany("""
                INSERT INTO book_platforms (book_id, platform_name, is_active)
                VALUES ($1, $2, $3)
            """, platform_tuples)

            # 4. Seed Demo Tickets (D1 to D8)
            print("[INFO] Seeding 8 demo tickets (D1-D8)...")
            ticket_tuples = []
            msg_tuples = []
            event_tuples = []

            for dt in DEMO_TICKETS:
                t_id = dt["id"]
                created_dt = datetime.fromisoformat(dt["created_at"].replace("Z", "+00:00"))
                ticket_tuples.append((
                    t_id, dt["subject"], dt["description"], dt["author_id"],
                    dt["book_id"], dt["book_title"], dt["status"], dt["priority"],
                    dt["category"], dt["ai_status"], dt["ai_category"], dt["ai_priority"],
                    dt["assignee"], dt["assignee_id"], created_dt
                ))

                # Initial author message
                msg_tuples.append((
                    f"msg_{t_id}_1", t_id, dt["author_id"],
                    "Priya Sharma" if dt["author_id"] == "AUTH001" else "Author",
                    "author", dt["description"], False, False, created_dt
                ))

                # Creation audit event
                event_tuples.append((
                    f"evt_{t_id}_created", t_id, dt["author_id"], "Author",
                    "ticket.created", json.dumps({"category": dt["category"], "priority": dt["priority"]}),
                    created_dt
                ))

            await conn.executemany("""
                INSERT INTO tickets (
                    id, subject, description, author_id, book_id, book_title,
                    status, priority, category, ai_status, ai_category, ai_priority,
                    assignee, assignee_id, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15)
            """, ticket_tuples)

            # Special messages for resolved ticket D7 (Kavita Deshmukh roll-over explanation)
            msg_tuples.append((
                "msg_BL-1007_reply", "BL-1007", "admin_support", "Support Lead",
                "support",
                "Hello Kavita, BookLeaf processes quarterly royalty disbursements for cumulative balances exceeding the ₹1,000 minimum threshold. Your current pending royalty across The Nagpur Notebooks is ₹850, which rolls over automatically to the upcoming quarter ending December 31.",
                True, False, datetime.fromisoformat("2026-10-25T09:30:00+00:00")
            ))

            await conn.executemany("""
                INSERT INTO ticket_messages (
                    id, ticket_id, sender_id, sender_name, sender_role, body, is_from_staff, is_internal_note, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            """, msg_tuples)

            await conn.executemany("""
                INSERT INTO ticket_events (
                    id, ticket_id, actor_id, actor_name, event_type, payload, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
            """, event_tuples)

            # 5. Alembic Version
            await conn.execute("""
                INSERT INTO alembic_version (version_num) 
                VALUES ('0001_canonical_alignment')
                ON CONFLICT (version_num) DO NOTHING;
            """)

    print("[OK] Canonical dataset seeding completed successfully.")


async def verify_canonical():
    """Run verification queries against live database and assert exact specification alignment."""
    print("\n" + "=" * 60)
    print("CANONICAL DATASET VERIFICATION DRILL (GATE 1)")
    print("=" * 60)

    # 1. 10 Tables Check
    tables = await db.fetch_all("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY 1
    """)
    table_names = [t["table_name"] for t in tables]
    expected_tables = [
        "ai_calls", "alembic_version", "authors", "book_platforms",
        "books", "ticket_events", "ticket_messages", "ticket_notes",
        "tickets", "users"
    ]
    print(f"Tables present ({len(table_names)}): {table_names}")
    assert table_names == expected_tables, f"Tables mismatch! Expected {expected_tables}, got {table_names}"
    print("[PASS] Exactly 10 tables exist in public schema.")

    # 2. Table Counts
    counts = await db.fetch_one("""
        SELECT (SELECT count(*) FROM users WHERE role = 'author') AS author_users,
               (SELECT count(*) FROM users WHERE role = 'admin')  AS admin_users,
               (SELECT count(*) FROM authors)        AS authors,
               (SELECT count(*) FROM books)          AS books,
               (SELECT count(*) FROM book_platforms) AS platform_rows,
               (SELECT count(*) FROM tickets)        AS tickets;
    """)
    print("\nRow Counts:")
    print(f"  Author Users:  {counts['author_users']} (Expected: 10)")
    print(f"  Admin Users:   {counts['admin_users']} (Expected: 2)")
    print(f"  Authors:       {counts['authors']} (Expected: 10)")
    print(f"  Books:         {counts['books']} (Expected: 18)")
    print(f"  Platform Rows: {counts['platform_rows']} (Expected: 46)")
    print(f"  Tickets:       {counts['tickets']} (Expected: 8)")

    assert counts["author_users"] == 10, f"Expected 10 author users, got {counts['author_users']}"
    assert counts["admin_users"] == 2, f"Expected 2 admin users, got {counts['admin_users']}"
    assert counts["authors"] == 10, f"Expected 10 authors, got {counts['authors']}"
    assert counts["books"] == 18, f"Expected 18 books, got {counts['books']}"
    assert counts["platform_rows"] == 46, f"Expected 46 platforms, got {counts['platform_rows']}"
    assert counts["tickets"] == 8, f"Expected 8 tickets, got {counts['tickets']}"
    print("[PASS] All entity counts match exact specification.")

    # 3. Financial Aggregates & Book Status
    fin = await db.fetch_one("""
        SELECT count(*) FILTER (WHERE publication_date IS NOT NULL) AS published,
               count(*) FILTER (WHERE publication_date IS NULL)     AS in_production,
               sum(total_copies_sold) AS sold, sum(total_royalty_earned) AS earned,
               sum(royalty_paid) AS paid, sum(royalty_pending) AS pending
        FROM books;
    """)
    print("\nCatalog & Financial Totals:")
    print(f"  Published & Live: {fin['published']} (Expected: 16)")
    print(f"  In Production:    {fin['in_production']} (Expected: 2: BK013 & BK015)")
    print(f"  Copies Sold:      {fin['sold']} (Expected: 7,205)")
    print(f"  Total Earned:     ₹{fin['earned']} (Expected: ₹2,43,382)")
    print(f"  Total Paid:       ₹{fin['paid']} (Expected: ₹2,02,543)")
    print(f"  Total Pending:    ₹{fin['pending']} (Expected: ₹40,839)")

    assert fin["published"] == 16, f"Expected 16 live, got {fin['published']}"
    assert fin["in_production"] == 2, f"Expected 2 in prod, got {fin['in_production']}"
    assert fin["sold"] == 7205, f"Expected 7205 copies, got {fin['sold']}"
    assert fin["earned"] == 243382, f"Expected 243382 earned, got {fin['earned']}"
    assert fin["paid"] == 202543, f"Expected 202543 paid, got {fin['paid']}"
    assert fin["pending"] == 40839, f"Expected 40839 pending, got {fin['pending']}"
    print("[PASS] All financial aggregates match canonical dataset exactly.")

    # 4. Check Constraint Verification (total_royalty_earned - royalty_paid = royalty_pending)
    invalid_books = await db.fetch_all("""
        SELECT external_id, total_royalty_earned, royalty_paid, royalty_pending
        FROM books
        WHERE total_royalty_earned - royalty_paid != royalty_pending;
    """)
    assert len(invalid_books) == 0, f"Found books violating chk_royalty_balance: {invalid_books}"
    print("[PASS] chk_royalty_balance constraint holds for 100% of books.")

    # 5. Password Hash Check
    non_argon = await db.fetch_val("SELECT count(*) FROM users WHERE password_hash NOT LIKE '$argon2id$%';")
    assert non_argon == 0, f"Found {non_argon} users with non-argon2id password hash!"
    print(f"[PASS] 100% of users ({counts['author_users'] + counts['admin_users']}) have valid $argon2id$ password hashes.")

    # 6. Author pending join
    author_pending = await db.fetch_all("""
        SELECT a.external_id, sum(b.royalty_pending) AS pending
        FROM authors a JOIN books b ON b.author_id = a.id GROUP BY 1 ORDER BY 1;
    """)
    expected_pending = {
        "AUTH001": 3570,
        "AUTH002": 13024,
        "AUTH003": 2546,
        "AUTH004": 3350,
        "AUTH005": 3055,
        "AUTH006": 2464,
        "AUTH007": 7865,
        "AUTH008": 0,
        "AUTH009": 850,
        "AUTH010": 4115,
    }
    for row in author_pending:
        auth_id = row["external_id"]
        assert row["pending"] == expected_pending[auth_id], (
            f"Pending mismatch for {auth_id}: expected {expected_pending[auth_id]}, got {row['pending']}"
        )
    print("[PASS] Author pending royalties breakdown matches Section 4.1 exactly.")

    print("\n" + "=" * 60)
    print("ALL GATE 1 VERIFICATION DRILLS PASSED!")
    print("=" * 60)


async def main():
    await db.connect()
    try:
        await apply_schema()
        await seed_data()
        await verify_canonical()
    finally:
        await db.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
