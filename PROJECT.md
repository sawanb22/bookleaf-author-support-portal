# Project: BookLeaf Author Support Portal

## Architecture
- **Framework**: Next.js 14 App Router, React 18, TypeScript, Tailwind CSS 3.4.
- **Visual Design System**: "Quiet Publishing Desk" design language with deep leaf-green primary accent (`#1B6B4F`), paper surface (`#FFFFFF`), light green-grey page background (`#F5F7F6`), ink text (`#18211D`), and serif headings (`Literata`).
- **Typography**: `Literata` for titles and book headings; `IBM Plex Sans` for UI, labels, and tabular numerals (`font-variant-numeric: tabular-nums`) with Indian Rupee (`₹`) symbol formatting.
- **Layout Boundaries**:
  - `app/layout.tsx`: Root layout with Google Fonts, global CSS tokens on `:root`, and AuthProvider.
  - `app/(author)/layout.tsx`: Author Shell with 56px white top navigation, active 2px bottom primary underline, user menu, max-width `1040px`, and responsive mobile bottom tab bar (`< 768px`).
  - `app/admin/layout.tsx`: Admin Shell with 56px dark top navigation (`#18211D`), "Admin" badge, max-width `1320px`, and status indicator.
  - `app/login/page.tsx`: Isolated auth page with 400px centered column, password toggle, and demo account switchers.
- **Data & Mock Layer**: `lib/mock/db.ts` providing an in-memory and `localStorage` reactive data store with initial seed records (BK001-BK018, BL-1042, BL-1031), reactive hooks (`useLiveTicket`), demo auth switching, and idempotent ticket creation.

## Code Layout
```
d:\book_leaf\frontend/
├── package.json
├── tsconfig.json
├── next.config.mjs
├── tailwind.config.ts
├── postcss.config.mjs
├── app/
│   ├── layout.tsx
│   ├── globals.css
│   ├── page.tsx                      # Root redirect (/ -> /books or /login)
│   ├── login/
│   │   └── page.tsx                  # Sign In (400px column, demo switchers)
│   ├── (author)/
│   │   ├── layout.tsx                # 56px white top bar + bottom mobile tab bar (<768px)
│   │   ├── books/
│   │   │   └── page.tsx              # My Books (Summary band, Table/Cards, 9-stage line)
│   │   ├── tickets/
│   │   │   ├── page.tsx              # My Tickets (Segmented filters, unread dot, empty state)
│   │   │   ├── new/
│   │   │   │   └── page.tsx          # Submit Support Query (Draft preservation, Dropzone)
│   │   │   └── [id]/
│   │   │       └── page.tsx          # Ticket Details (4-node status line, thread, reply)
│   └── admin/
│       ├── layout.tsx                # 56px dark top bar (#18211D), Admin badge
│       └── tickets/
│           └── page.tsx              # Admin Queue (KPI cards, priority glyphs, sorting)
├── components/
│   ├── author/
│   │   ├── TopNavBar.tsx
│   │   ├── MobileTabBar.tsx
│   │   ├── UserMenu.tsx
│   │   └── ProductionStageBar.tsx
│   ├── admin/
│   │   ├── AdminTopNavBar.tsx
│   │   ├── MetricCards.tsx
│   │   └── PriorityGlyph.tsx
│   └── shared/
│       ├── StatusBadge.tsx
│       ├── StatusProgressLine.tsx
│       ├── MessageBlock.tsx
│       ├── AttachmentDropzone.tsx
│       └── EmptyState.tsx
├── lib/
│   ├── formatters.ts
│   ├── constants.ts
│   └── mock/
│       ├── db.ts
│       ├── seed.ts
│       ├── auth-context.tsx
│       └── hooks.ts
└── tests/
    ├── verify-contracts.mjs
    ├── e2e/
    │   ├── auth.spec.ts
    │   ├── books.spec.ts
    │   ├── tickets.spec.ts
    │   ├── ticket-details.spec.ts
    │   └── admin-queue.spec.ts
    └── playwright.config.ts
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Scaffolding & Config | Next.js 14 App Router, TypeScript, Tailwind config, and PostCSS in `frontend` | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Typography Tokens | Literata serif and IBM Plex Sans with tabular numbers (`tabular-nums`) and `₹` formatting | M1 | UI Spec §2.2 |
| 3 | Design Token System | CSS variables on `:root` and Tailwind theme mappings (colors, radiuses, spacing, shadows) | M1 | UI Spec §2.1 |
| 4 | Mock Database & Seeding | In-memory + localStorage store with BK001-BK018, BL-1042, BL-1031, idempotency | M1 | UI Spec §5.2, §9 |
| 5 | Auth Session Context | Reactive React AuthContext supporting demo account state and role switching | M1 | UI Spec §5.1 |
| 6 | Sign In Page | Centered 400px column with email and password inputs, 48px primary button | M2 | Stitch afd7a20dfbe2498ea4330f72373e9518 |
| 7 | Password Visibility Toggle | Show / Hide toggle inside password field with `aria-pressed` | M2 | UI Spec §5.1 |
| 8 | Demo Account Switcher | Sunken panel with 1-click credential fill for Priya Sharma (Author) and Admin | M2 | Stitch afd7a20dfbe2498ea4330f72373e9518 |
| 9 | Author Shell Top Bar | 56px white top bar, Literata wordmark, 2px bottom active underline, user menu | M2 | UI Spec §3.1 |
| 10 | Author Mobile Bottom Bar | 56px bottom navigation tab bar for viewports `< 768px` (Books, New Query, Tickets) | M2 | UI Spec §3.1 |
| 11 | Royalties Summary Band | 3-column bordered band with Earned ₹19,908, Paid ₹16,338, Pending ₹3,570 in tabular figures | M2 | UI Spec §5.2 |
| 12 | Books List / Table View | 12-column grid table collapsing to definition list cards on responsive viewports | M2 | Stitch 2e13e38711dc4b76af5f5143ea8c8ca7 |
| 13 | Production 9-Stage Progress | Visual 9-segment progress bar for books in production with active pulsing ring | M2 | UI Spec §5.2 |
| 14 | Books Edge Cases Handling | Paid in full caption, below ₹1000 rollover caption, unlisted platforms, typographic apostrophes | M2 | UI Spec §5.2 |
| 15 | Per-Book Query Deep Link | "Raise a query" button on book row routing to `/tickets/new?book=<external_id>` | M2 | UI Spec §5.2 |
| 16 | Support Query Form | 640px form with book selector, subject input, description, and submit action | M3 | Stitch 09b248a41d8d4fe687441d7015f78e06 |
| 17 | Book Selector Context Pill | Helper pill displaying status and pending royalties for selected book | M3 | UI Spec §5.3 |
| 18 | Live Character Counters | Counter on subject (120 limit) and description (3000 limit) appearing at 80% | M3 | UI Spec §3.3 |
| 19 | Mock Attachment Dropzone | 104px dashed dropzone with disclaimer note (`NEXT_PUBLIC_ATTACHMENTS_ENABLED`) | M3 | UI Spec §5.3 |
| 20 | LocalStorage Draft Storage | Form auto-saves to `draft:new-ticket` and restores on reload; clears on submit | M3 | UI Spec §5.3 |
| 21 | Segmented Status Filter Tabs | Status tabs (All, Open, In progress, Resolved, Closed) with live count badges | M3 | Stitch 42cf5b2decca45d394f28d513835e4f3 |
| 22 | Unread Update Dot | 8px primary green dot on tickets with new official replies + bold subject | M3 | UI Spec §3.4 |
| 23 | My Tickets Empty State | Dedicated zero-state view with icon, copy, CTA, and 2x2 common topic guide | M3 | Stitch c9fa8ebb45ba41bf8acfba7a9b5dfba4 |
| 24 | 4-Node Signature Status Line | Stepper (`Open` -> `In progress` -> `Resolved` -> `Closed`) with 24px active halo | M3 | UI Spec §5.5 |
| 25 | Message Thread Blocks | Author message (white) vs BookLeaf reply (tint bg, 3px primary border, Official badge) | M3 | UI Spec §3.6 |
| 26 | Live Ticket Polling | Simulation hook `useLiveTicket` with 1200ms highlight on new incoming replies | M3 | UI Spec §3.9 |
| 27 | Follow-up Reply Composer | Textarea and Send Reply action appending messages to ticket thread | M3 | UI Spec §5.5 |
| 28 | Admin Shell Dark Bar | 56px `#18211D` dark top bar with "Admin" badge, white active underline, user avatar | M4 | UI Spec §3.1 |
| 29 | Operational KPI Metrics | 5 summary cards (Total in Queue, Needs Reply, Awaiting Author, AI Draft, Resolved Today) | M4 | Stitch 463bd84a2ecc4bdb884aac780450fc49 |
| 30 | Admin Queue Table & Sorting | High-density operational table with sorting, category filters, and bulk select | M4 | Stitch 463bd84a2ecc4bdb884aac780450fc49 |
| 31 | 4-Bar Priority Indicators | Visual 4 vertical bars (Critical 4, High 3, Medium 2, Low 1) with contrast styling | M4 | UI Spec §3.4 |
| 32 | AI Override Indicator | Pencil icon and tooltip when category or priority was modified from AI suggestion | M4 | UI Spec §3.4 |
| 33 | Quick Self-Assignment | Ghost button `[ Assign to me ]` in Assignee column updating ticket assignment | M4 | Stitch 463bd84a2ecc4bdb884aac780450fc49 |
| 34 | Keyboard Navigation | `J` / `K` keys to navigate rows, `Enter` to open ticket details | M4 | Stitch 463bd84a2ecc4bdb884aac780450fc49 |
| 35 | Live Queue Updates Pill | "2 new tickets. Show" notification pill above queue table | M4 | UI Spec §3.9 |
| 36 | Contract Verification Suite | Node contract test runner validating data invariants and calculation rules | M5 | Arch Explorer handoff |
| 37 | End-to-End Test Suite | Comprehensive Playwright test suite covering Tiers 1-4 across viewports | M5 | Dual-Track E2E |
| 38 | Adversarial Coverage (Tier 5)| White-box boundary stress testing and edge-case coverage hardening | M5 | Final Milestone Phase 2 |
| 39 | 1:1 Pixel-Perfect Polish | Visual comparison against Stitch reference screens across all breakpoints | M5 | ORIGINAL_REQUEST §R3 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Scaffolding & Design System Tokens | Project config, fonts, CSS variables, Tailwind tokens, mock database, auth context | none | DONE |
| M2 | Author Shell, Sign In & My Books | Author top bar & mobile tab bar, `/login` with demo switchers, `/books` with summary band, table, cards, and 9-stage progress | M1 | DONE |
| M3 | Support Queries & Tickets | `/tickets/new` with draft preservation & dropzone, `/tickets` with filters & empty state, `/tickets/[id]` with 4-node status line & thread | M1, M2 | DONE |
| M4 | Admin Shell & Queue | Admin dark top bar, `/admin/tickets` with 5 KPI cards, table sorting, 4-bar priority glyphs, AI indicator, keyboard nav | M1 | DONE |
| M5 | E2E Testing, Adversarial Verification & Polish | 100% E2E test pass, Tier 5 adversarial hardening, pixel-perfect comparison vs Stitch | M2, M3, M4 | DONE |




## Interface Contracts

### `lib/mock/db.ts` ↔ UI Components
```typescript
export interface Book {
  id: string;
  external_id: string; // BK001, etc.
  title: string;
  isbn: string;
  genre: string;
  publication_date: string | null;
  status: 'Published & Live' | 'In production';
  stage?: string; // e.g. "Cover Design", "Typesetting"
  mrp: number | null;
  total_copies_sold: number | null;
  total_royalty_earned: number;
  royalty_paid: number;
  royalty_pending: number;
  last_royalty_payout_date: string | null;
  print_partner: string | null;
  platforms: string[];
}

export interface TicketMessage {
  id: string;
  sender_name: string;
  sender_role: 'author' | 'support' | 'admin' | 'ai';
  body: string;
  created_at: string;
  is_internal_note?: boolean;
}

export interface Ticket {
  id: string; // "BL-1042"
  subject: string;
  description: string;
  book_id: string | null;
  book_title: string | null;
  author_id: string;
  author_name: string;
  status: 'Open' | 'In progress' | 'Resolved' | 'Closed';
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  category: string;
  category_overridden?: boolean;
  priority_overridden?: boolean;
  assignee: string | null;
  has_unread: boolean;
  created_at: string;
  updated_at: string;
  messages: TicketMessage[];
}
```

### Auth Context (`lib/mock/auth-context.tsx`)
```typescript
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'author' | 'admin';
}

export interface AuthContextType {
  user: User | null;
  login: (email: string, role?: 'author' | 'admin') => void;
  logout: () => void;
  isAuthenticated: boolean;
}
```
