# Architectural Decision Records (ADR) — BookLeaf Author Support Portal

Single-line architectural decision defenses for key engineering, security, data, and design choices across Gates 1–8:

1. **Neon Serverless PostgreSQL with asyncpg Pool**: Selected for zero cold-start pooled connections, ACID compliance, and native PostgreSQL constraint enforcement at serverless scale.
2. **Argon2id Password Hashing**: Selected over bcrypt/PBKDF2 to resist GPU/ASIC parallel cracking while meeting modern cryptographic storage standards.
3. **Case-Insensitive Unique Email Index (`LOWER(email)`)**: Enforces account uniqueness regardless of capitalization variations, eliminating duplicate account vulnerabilities.
4. **Composite Foreign Key (`tickets_book_owner_fk`)**: Enforces at the database engine level that support tickets can only be filed against books owned by the ticket author.
5. **Check Constraint `chk_royalty_balance`**: Enforces the immutable financial accounting invariant `total_royalty_earned - royalty_paid = royalty_pending` directly in the table schema.
6. **Partial Index on Active Queue (`tickets_queue_idx`)**: Accelerates admin triage queries on active statuses (`Open`, `In progress`) while excluding high-volume resolved/closed records.
7. **Selective `updated_at` Trigger**: Advances ticket activity timestamp on public author messages while suppressing bumps on internal staff notes to prevent information leaks.
8. **Cross-Author 404 Isolation (Never 403)**: Returns HTTP 404 Not Found for any foreign ticket access, entirely preventing ID enumeration and probe discovery.
9. **Strict Pydantic `extra='forbid'` Validation**: Rejects payload pollution and unauthorized field injections (e.g., `author_id`, `status`) at the REST contract boundary.
10. **AWS Bedrock MiniMax M2.5 (`minimax.minimax-m2.5`)**: Selected for high reasoning accuracy on bilingual Indic nuances, low latency JSON generation, and high cost-efficiency.
11. **Two-Tier Timeout Strategy (30s Classify / 45s Draft)**: Provides fast triage classification within 30 seconds while giving rich multi-turn draft generation 45 seconds before fallback.
12. **Deterministic Priority Floors**: Hardcodes mandatory priority minimums (Critical for legal action, High for ISBN mismatches and damaged author copies), immune to LLM hallucination.
13. **Circuit Breaker (5 Failures / 60s Reset)**: Halts remote LLM calls after 5 consecutive failures, instantly switching to deterministic keyword triage to protect system latency.
14. **Numeric Fact-Checking Hallucination Guard**: Cross-examines all currency figures in generated drafts against the author's verified financial facts block before staff preview.
15. **Server-Sent Events (SSE) for Real-Time Updates**: Provides unidirectional live ticket notification doorbells over standard HTTP without WebSocket server state overhead.
16. **Environment Sanitization (Gate 6)**: Eliminates database credentials from `frontend/.env.local`, exposing only public `NEXT_PUBLIC_*` endpoints to client bundles.
17. **Dynamic Idempotent Test Isolation**: Pytest test suite dynamically provisions and cleans up tickets in `try...finally` blocks, preserving a pristine queue for client testing.
18. **Dual Navigation Shells**: Distinct 56px white top bar for Authors and dark `#18211D` top bar for Admins prevent cognitive confusion and role misrouting.
19. **Tabular Numerals (`tabular-nums`)**: Applied across currency figures (`₹`) and operational KPI cards to guarantee strict monospaced column alignment.
20. **Pristine Ticket Queue on Deployment**: Truncated all pre-seeded tickets in PostgreSQL so the client evaluates fresh, genuine ticket creation and AI triage workflows.
