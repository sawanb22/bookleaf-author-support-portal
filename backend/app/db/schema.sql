-- BookLeaf Author Support Portal - PostgreSQL Schema for Neon
-- Optimized for relational integrity, composite foreign keys, partial indexing, and auditability

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

-- Case-insensitive unique index for users.email
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users (LOWER(email));

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

CREATE TABLE IF NOT EXISTS book_platforms (
    id SERIAL PRIMARY KEY,
    book_id VARCHAR(64) NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    platform_name VARCHAR(128) NOT NULL,
    url VARCHAR(512),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_book_platform UNIQUE (book_id, platform_name)
);

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
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT tickets_book_owner_fk FOREIGN KEY (author_id, book_id) REFERENCES books (author_id, id) ON DELETE SET NULL
);

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

CREATE TABLE IF NOT EXISTS ticket_events (
    id VARCHAR(64) PRIMARY KEY DEFAULT ('evt_' || SUBSTRING(MD5(RANDOM()::TEXT), 1, 12)),
    ticket_id VARCHAR(64) NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    actor_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    actor_name VARCHAR(255),
    event_type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

-- Trigger: Bump tickets.updated_at on author-visible messages
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

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_books_author ON books (author_id);
CREATE INDEX IF NOT EXISTS idx_tickets_author ON tickets (author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_queue ON tickets (status, priority, created_at ASC);
CREATE INDEX IF NOT EXISTS tickets_queue_idx ON tickets (priority, created_at ASC) WHERE status IN ('Open', 'In progress', 'open', 'in_progress');
CREATE INDEX IF NOT EXISTS idx_messages_ticket ON ticket_messages (ticket_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_notes_ticket ON ticket_notes (ticket_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_events_ticket ON ticket_events (ticket_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_platforms_book ON book_platforms (book_id);
