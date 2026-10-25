# Architectural Decision Records (ADR) — BookLeaf Author Support Portal

## Core 5 Engineering Defenses for Technical Interviews

1. **Database-Enforced Financial Invariants vs. Application Code**:
   * *Decision*: The constraint `chk_royalty_balance` (`total_royalty_earned - royalty_paid = royalty_pending`) is enforced directly in PostgreSQL schema.
   * *Defense*: Application-level validation can fail under concurrent race conditions or bug regressions. Putting the invariant in the PostgreSQL engine guarantees mathematical ledger integrity at the storage layer regardless of what API or background worker touches it.
2. **Multi-Tenant Data Isolation (404 Not Found vs. 403 Forbidden)**:
   * *Decision*: Querying a ticket or book that belongs to another author returns `404 Not Found`, never `403 Forbidden`.
   * *Defense*: Returning 403 leaks that a private resource exists, enabling ID enumeration and timing attacks. Returning 404 maintains strict zero-knowledge tenant isolation.
3. **In-Context Policy Injection vs. Vector RAG**:
   * *Decision*: The entire BookLeaf operational publishing policy (~1,500 tokens) is injected directly into the LLM system prompt without vector search.
   * *Defense*: RAG introduces chunking miss rates, vector similarity cutoffs, and embedding roundtrip latency. Because the policy is compact, direct injection achieves 100% recall, 0ms retrieval latency, and zero chunk hallucinations for < $0.0008 per ticket.
4. **Deterministic Priority Floors & Circuit Breakers**:
   * *Decision*: Hardcoded regex keyword rules override LLM priority predictions for legal threats and multi-quarter payout delays. A circuit breaker trips after 5 downstream failures.
   * *Defense*: LLMs should assist staff, not govern legal or financial risk. If an author mentions consumer court, the priority must be Critical 100% of the time, even if the model hallucinates a Medium. If Bedrock goes down, the circuit breaker protects API latency by degrading to deterministic rule triage.
5. **Composite Foreign Key Authorization Boundary**:
   * *Decision*: Database foreign key `tickets_book_owner_fk` spans `(book_id, author_id)`.
   * *Defense*: Prevents IDOR (Insecure Direct Object Reference) vulnerabilities at the database layer: an author cannot file a ticket against a book ID they do not own, even if they tamper with client-side dropdown requests.

---

## Complete Systems Decision Reference (Gates 1–8)

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
