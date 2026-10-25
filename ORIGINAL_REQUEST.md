# Original User Request

## 2026-10-24T21:58:32Z

Build a 1:1 pixel-perfect, responsive frontend for the BookLeaf Author Support Portal based on Google Stitch project projects/2419278803113923090 and the UI Design Spec, using Next.js (App Router), TypeScript, and Tailwind CSS.

Working directory: d:\book_leaf\frontend
Integrity mode: development

---

## Target Screens (Stitch Project 2419278803113923090)

1. **Sign in** (`/login`) — Screen ID: `afd7a20dfbe2498ea4330f72373e9518`
2. **My Books** (`/books`) — Screen ID: `2e13e38711dc4b76af5f5143ea8c8ca7`
3. **Submit a Support Query** (`/tickets/new`) — Screen ID: `09b248a41d8d4fe687441d7015f78e06`
4. **My Tickets** (`/tickets`) — Screen ID: `42cf5b2decca45d394f28d513835e4f3` (plus empty state `c9fa8ebb45ba41bf8acfba7a9b5dfba4`)
5. **Ticket Details BL-1042** (`/tickets/[id]`) — Screen ID: `f3c1b9b006a142abb0cddeee21a61275`
6. **Admin Queue** (`/admin/tickets`) — Screen ID: `463bd84a2ecc4bdb884aac780450fc49`

---

## Requirements

### R1. Scaffolding & Design System Tokens Setup
- Initialize Next.js project with App Router, TypeScript, and Tailwind CSS inside `d:\book_leaf\frontend`.
- Configure Google Fonts: `Literata` (serif for titles, headers, book titles) and `IBM Plex Sans` (sans for UI body, forms, tables with tabular figures `font-variant-numeric: tabular-nums`).
- Define exact design tokens on `:root` and Tailwind config:
  - App Background: `#F5F7F6` (`color-page`)
  - Surface: `#FFFFFF` (`color-surface`), Sunken: `#EDF1EF` (`color-surface-sunken`)
  - Dividers: `#DDE2DF` (`color-border`), Hover/Strong: `#C3CBC6` (`color-border-strong`)
  - Primary: `#1B6B4F`, Hover: `#145740`, Pressed: `#0F4733`, Tint: `#E6F1EC`
  - Text: `#18211D` (ink with green undertone), Muted: `#55625B`, Subtle: `#66726B`
  - Status & Priority color pairs (WCAG AA compliant)
- Implement global App Shells:
  - **Author Shell**: 56px white top bar, Literata wordmark, underline on active item, user menu, responsive bottom tab bar on mobile (`< 768px`).
  - **Admin Shell**: 56px dark top bar (`#18211D` background, white text) with "Admin" indicator.

### R2. Modular Page Implementations (Per-Page Isolation)
- **Sign in (`/login`)**: 400px centered column, email/password inputs with show/hide toggle, demo account switchers (`priya.sharma@email.com` and `admin@bookleaf.test`) filling demo credentials.
- **My Books (`/books`)**: Summary band (Earned, Paid, Pending with ₹ in tabular figures), responsive books list/table, edge cases (no payout yet, paid in full, below ₹1000 minimum payout caption), and 9-stage visual production progress bar for in-production books.
- **Submit a Support Query (`/tickets/new`)**: Book selector showing status & pending royalty helper text, subject input with character limit counter, description textarea, attachment dropzone (mock/demo UI), localStorage draft preservation.
- **My Tickets (`/tickets`)**: Segmented status filters (All, Open, In progress, Resolved, Closed) with count badges, unread dot indicator, tabular activity timestamps, and empty state screen.
- **Ticket Details (`/tickets/[id]`)**: 4-node status progress line (`Open` -> `In progress` -> `Resolved` -> `Closed`), helper text with response target ("We aim to reply within 48 hours"), message thread styling (Author vs BookLeaf reply with 3px primary border).
- **Admin Queue (`/admin/tickets`)**: Dark top bar navigation, sortable table headers, category/priority indicators with 4-bar glyphs, ticket preview and action controls.

### R3. Visual Verification & Automated Polish
- Start local dev server (`npm run dev`) on an available port.
- Capture/inspect rendered pages and compare 1:1 against Stitch reference screenshots and HTML layout structure.
- Check alignment, margins, padding, typography scale, colors, and responsive collapsing at breakpoints (`640px`, `768px`, `1024px`).
- Apply iterative refinements until all views achieve pixel-perfect match.

---

## Acceptance Criteria

### Visual & Functional Match
- [ ] All 6 core screens exist and render without compilation or runtime errors.
- [ ] Exact font pairings (Literata & IBM Plex Sans) loaded and active.
- [ ] Tabular numerals applied to all currency (`₹`) and count values.
- [ ] Author shell (white) and Admin shell (dark) differentiate context cleanly.
- [ ] 4-node ticket progress bar renders accurately across mobile and desktop.
- [ ] Visual verification confirms pixel-perfect alignment against Stitch designs.

## 2026-10-25T09:43:48Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Multi-agent execution across Gates 1-9 via teamwork_preview
> Requested team: Full team (Specialized verification, backend/frontend alignment, and gate auditing agents)

Verify, audit, and align the BookLeaf Author Support Portal with the official Technical Assignment PDF, canonical sample JSON dataset (10 authors, 18 books), and Final Build Spec across all 9 pre-deploy verification gates.

Working directory: d:/book_leaf
Integrity mode: development

## Requirements

### R1. Database Verification & Seed Alignment (Gate 1)
- Verify Neon PostgreSQL schema against `schema.sql` (10 tables: `ai_calls`, `alembic_version`, `authors`, `book_platforms`, `books`, `ticket_events`, `ticket_messages`, `ticket_notes`, `tickets`, `users`).
- Verify exact dataset totals from `bookleaf_sample_data.json`: 10 author users, 2 admin users, 10 authors, 18 books (16 live, 2 in production: BK013 and BK015), 46 platform rows.
- Verify financial aggregates: exactly 7,205 copies sold, ₹2,43,382 total earned, ₹2,02,543 paid, and ₹40,839 pending.
- Ensure all relational constraints (case-insensitive unique emails, composite book ownership check `tickets_book_owner_fk`, balance check `royalty_balances`) and triggers are active and enforced.

### R2. API Contract, Isolation & RBAC Matrix (Gate 2)
- Fast-path verification of all 17 REST paths / 19 operations under `/api/v1` and health checks (`/health`, `/health/ready`).
- Verify strict RBAC: anonymous calls return `401 Unauthorized`; author token accessing `/api/v1/admin/*` returns `403 Forbidden`.
- Enforce strict per-author data isolation: cross-author access returns `404 Not Found` (never `403`), preventing ID enumeration.
- Enforce `extra='forbid'` and Pydantic validation (e.g., rejecting unexpected fields like `author_id` in request bodies).

### R3. AI Engine Calibration & Guardrails (Gate 3)
- Connect to AWS Bedrock Mantle endpoint (`minimax.minimax-m2.5`) with 30s classify / 45s draft timeouts and circuit breaker.
- Run classification evaluation across the 7 canonical sample queries from the assignment:
  1. No royalty after 4 months -> `royalty_payments`, `High`
  2. Sold 200 copies, received ₹3,000 -> `royalty_payments`, `Medium`
  3. Amazon ISBN mismatch -> `isbn_metadata`, `High` (policy floor)
  4. Blurry/misaligned author copies -> `printing_quality`, `High`
  5. Published but "Currently Unavailable" -> `distribution_availability`, `High`
  6. Three weeks in typesetting -> `book_status_production`, `Medium`
  7. Update Amazon description -> `general_inquiry`, `Low`
- Verify draft quality against the 8 demo tickets (D1–D8): drafts must use the author's real facts block, acknowledge the issue first, own faults, apply correct BookLeaf policy (80/20 split, quarterly payout, ₹1,000 threshold roll-over, 5-7 days reprint), and flag unverified figures.
- Verify graceful degradation: fallback to keyword triage and manual drafting if AI times out or credentials are unset.

### R4. Real-Time Updates & Frontend UI Completeness (Gates 4 & 5)
- Verify Server-Sent Events (SSE) doorbells at `/api/v1/me/stream` and `/api/v1/admin/stream` with heartbeats and cross-author isolation.
- Verify author UI for Priya Sharma (`AUTH001`), Kavita Deshmukh (`AUTH009` with roll-over note and BK015 production tracker), and Ananya Reddy (`AUTH003`).
- Verify admin triage queue sorted by urgency (unresolved critical first, oldest first, age badges turning amber at 24h and red at 72h).
- Zero console errors, fully responsive down to 375px mobile viewport, and accessibility adherence (status chips carry explicit text, not color alone).

### R5. Security, Documentation & Pre-Deploy Readiness (Gates 6, 7 & 8)
- Verify that no API keys or secrets are leaked into client-side static bundles or tracked in git.
- Verify complete documentation: `README.md` (architecture, setup, Bedrock model justification, demo credentials), `DECISIONS.md`, and 1-page technical write-up.
- Ensure both backend pytest (`22/22 passed`) and frontend Next.js production build (`npm run build`) pass cleanly.

## Acceptance Criteria

### Data & Relational Integrity (Gate 1)
- [ ] Database contains exactly 10 authors, 18 books (16 live, 2 in production), and 46 platform rows matching `bookleaf_sample_data.json`.
- [ ] Sum of books equals: 7,205 sold, ₹2,43,382 earned, ₹2,02,543 paid, ₹40,839 pending.
- [ ] Check constraints and composite foreign keys block invalid balances and foreign book ticket creation.

### API & RBAC Security (Gate 2)
- [ ] Anonymous requests to protected routes return 401.
- [ ] Author accessing admin routes returns 403.
- [ ] Accessing a foreign ticket returns 404.
- [ ] OpenAPI documentation is complete with all endpoints documented.

### AI Model Accuracy & Guardrails (Gate 3)
- [ ] 7 sample queries achieve >= 6/7 category accuracy and >= 5/7 priority accuracy.
- [ ] ISBN errors and legal escalation triggers enforce High/Critical priority floors.
- [ ] Draft generator flags missing info and catches hallucinated monetary figures.
- [ ] System degrades gracefully to fallback rules when AI is disabled or unreachable.

### UI Experience & Real-Time (Gates 4 & 5)
- [ ] Real-time updates delivered over SSE within 2 seconds without page refresh.
- [ ] Kavita Deshmukh's view correctly displays the ₹1,000 threshold roll-over note and 9-stage production tracker for BK015.
- [ ] Admin queue correctly prioritizes critical/high urgency tickets.
- [ ] Frontend compiles with 0 errors via `npm run build`.

### Documentation & Packaging (Gates 6 & 7)
- [ ] `README.md` contains setup instructions, architecture rationale, Bedrock M2.5 model justification, demo credentials, and limitations.
- [ ] `DECISIONS.md` records single-line decision defenses.
- [ ] No secrets or keys exposed in git history or client bundles.
