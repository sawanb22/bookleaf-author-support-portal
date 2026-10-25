# Architectural Decision Records (ADR) — BookLeaf Author Support Portal

This document records the architectural choices, tradeoffs, and system boundaries implemented across the BookLeaf Author Support Portal.

---

### ADR-01: PostgreSQL Check Constraints for Royalty Invariants

* **Context**: Author royalty balances (`earned - paid = pending`) are calculated from retail sales and manual adjustments. Handling balance reconciliation solely in application-level code leaves the system vulnerable to drift during concurrent writes, background batch migrations, or unhandled exceptions.
* **Decision**: Enforced an immutable check constraint directly in the table schema: `chk_royalty_balance: (total_royalty_earned - royalty_paid = royalty_pending)` on the `books` table.
* **Consequences & Trade-offs**: 
  * *Positive*: Mathematical consistency is guaranteed at the storage engine level. No API caller or worker script can create corrupt balance states.
  * *Negative*: Any update modifying one financial column must supply valid corresponding values across all three columns or the transaction will abort.

---

### ADR-02: Zero-Knowledge Multi-Tenant Data Isolation (404 vs 403)

* **Context**: When an author attempts to view or update a ticket or book belonging to another author, standard RBAC patterns often return `403 Forbidden`.
* **Decision**: All cross-author unauthorized lookups return `404 Not Found`.
* **Consequences & Trade-offs**:
  * *Positive*: Prevents resource enumeration attacks and timing probes. An unauthorized user cannot determine whether a given ticket ID exists on the system.
  * *Negative*: Slightly more ambiguous during internal frontend debugging when an author token accidentally accesses an unowned ID.

---

### ADR-03: In-Context Policy Injection Instead of Vector RAG

* **Context**: Support ticket triage and draft response generation require grounding in BookLeaf's operational guidelines (royalty payout schedules, the ₹1,000 disbursement threshold, author copy replacement protocols, and production tracking milestones).
* **Decision**: The entire publishing policy (~1,500 tokens) is injected directly into the LLM system prompt alongside the author's live database ledger facts, omitting vector databases and chunked retrieval.
* **Consequences & Trade-offs**:
  * *Positive*: Guarantees 100% policy recall on every invocation, eliminates vector embedding latency, and prevents chunk truncation hallucinations. Costs less than $0.0008 per ticket lifecycle.
  * *Negative*: If the publishing manual expands to hundreds of pages of bespoke contract amendments in the future, transitioning to hybrid vector search (pgvector) will be necessary.

---

### ADR-04: Deterministic Priority Floors and Circuit Breaker

* **Context**: While LLMs excel at conversational tone and summarization, relying purely on model output for operational and legal prioritization introduces hallucination risk. Additionally, external AI provider outages can cause request timeouts across the triage queue.
* **Decision**: Deterministic regex rules evaluate the incoming message before and after model inference. Mentions of consumer court, legal notices, or multiple overdue quarters automatically pin the ticket to `Critical` priority. An in-memory circuit breaker trips after 5 consecutive provider failures, falling back to local heuristic triage.
* **Consequences & Trade-offs**:
  * *Positive*: Legal and financial risks are governed deterministically. The support queue continues operating smoothly even during complete third-party AI outages.
  * *Negative*: Edge cases with hyperbolic phrasing ("I could sue, haha") will still trigger priority floors, erring on the side of administrative caution.

---

### ADR-05: Composite Foreign Key for IDOR Prevention

* **Context**: When authors file support inquiries, they link the ticket to a specific book. Relying only on application-level dropdown filtering allows malicious or modified payloads to submit tickets referencing other authors' book IDs.
* **Decision**: Applied a composite foreign key constraint `tickets_book_owner_fk` on `(book_id, author_id)` referencing `books(external_id, author_id)`.
* **Consequences & Trade-offs**:
  * *Positive*: Blocks Insecure Direct Object Reference (IDOR) attacks directly in the PostgreSQL engine.
  * *Negative*: Requires compound foreign key indexing and composite key lookups in database schemas.

---

### ADR-06: Argon2id Password Hashing

* **Context**: User credentials must be securely stored against brute-force attacks and credential dumping.
* **Decision**: Implemented Argon2id (`argon2id$v=19$m=65536,t=3,p=4`) using the standard `pwdlib` library.
* **Consequences & Trade-offs**:
  * *Positive*: Memory-hard password hashing (RFC 9106) provides strong resistance to GPU and ASIC parallel cracking.
  * *Negative*: Requires slightly higher memory and CPU allocation per authentication request compared to legacy bcrypt.

---

### ADR-07: Server-Sent Events (SSE) for Real-Time Updates

* **Context**: Authors and administrators need real-time notifications when new messages or status changes occur on open tickets.
* **Decision**: Implemented unidirectional Server-Sent Events over standard HTTP (`/api/v1/events/stream`) paired with an in-process asyncio event bus.
* **Consequences & Trade-offs**:
  * *Positive*: Lightweight, firewall-friendly, works natively over standard HTTP without WebSocket connection handshake and state overhead.
  * *Negative*: In-memory event bus is bound to a single worker instance; multi-node container scaling requires a Redis Pub/Sub backplane.
