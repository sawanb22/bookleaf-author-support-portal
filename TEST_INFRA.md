# E2E Test Infra: BookLeaf Author Support Portal

## Test Philosophy
- Opaque-box, requirement-driven. Derived from user specifications, UI design spec, and Stitch reference screens rather than internal code details.
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial Testing + Real-World Workload Testing.
- Progressive testability: verification mechanisms do not depend on features more complex than what they verify.

## Feature Inventory
| # | Feature | Source (Requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---------|---------------------|:------:|:------:|:------:|
| 1 | Sign in form & authentication | ORIGINAL_REQUEST §R2, UI Spec §5.1 | 5 | 5 | ✓ |
| 2 | Demo account quick switchers | ORIGINAL_REQUEST §R2, Stitch afd7a20 | 5 | 5 | ✓ |
| 3 | Author Shell & navigation | ORIGINAL_REQUEST §R1, UI Spec §3.1 | 5 | 5 | ✓ |
| 4 | Mobile bottom tab bar (<768px) | ORIGINAL_REQUEST §R1, UI Spec §3.1 | 5 | 5 | ✓ |
| 5 | Royalties summary band | ORIGINAL_REQUEST §R2, UI Spec §5.2 | 5 | 5 | ✓ |
| 6 | Books table & responsive card layout | ORIGINAL_REQUEST §R2, Stitch 2e13e38 | 5 | 5 | ✓ |
| 7 | In-production 9-stage progress bar | ORIGINAL_REQUEST §R2, UI Spec §5.2 | 5 | 5 | ✓ |
| 8 | Book edge cases (<1000, paid in full) | UI Spec §5.2, Sample Records BK001-BK018 | 5 | 5 | ✓ |
| 9 | Submit query form & validation | ORIGINAL_REQUEST §R2, UI Spec §5.3 | 5 | 5 | ✓ |
| 10 | LocalStorage draft recovery | ORIGINAL_REQUEST §R2, UI Spec §5.3 | 5 | 5 | ✓ |
| 11 | Mock file attachment dropzone | ORIGINAL_REQUEST §R2, UI Spec §5.3 | 5 | 5 | ✓ |
| 12 | My Tickets list & status filters | ORIGINAL_REQUEST §R2, UI Spec §5.4 | 5 | 5 | ✓ |
| 13 | Unread official reply green dot | ORIGINAL_REQUEST §R2, UI Spec §3.4 | 5 | 5 | ✓ |
| 14 | My Tickets zero empty state | Stitch c9fa8ebb, UI Spec §3.8 | 5 | 5 | ✓ |
| 15 | 4-node ticket status line stepper | ORIGINAL_REQUEST §R2, UI Spec §5.5 | 5 | 5 | ✓ |
| 16 | Message thread styling & roles | ORIGINAL_REQUEST §R2, UI Spec §3.6 | 5 | 5 | ✓ |
| 17 | Live ticket polling simulation | UI Spec §3.9 | 5 | 5 | ✓ |
| 18 | Admin dark shell (#18211D) | ORIGINAL_REQUEST §R1, UI Spec §3.1 | 5 | 5 | ✓ |
| 19 | Admin queue table & KPI cards | ORIGINAL_REQUEST §R2, Stitch 463bd84 | 5 | 5 | ✓ |
| 20 | 4-bar priority glyph indicators | ORIGINAL_REQUEST §R2, UI Spec §3.4 | 5 | 5 | ✓ |
| 21 | AI override indicator | UI Spec §3.4 | 5 | 5 | ✓ |
| 22 | Quick self-assignment | Stitch 463bd84 | 5 | 5 | ✓ |
| 23 | Keyboard navigation (J/K) | Stitch 463bd84 | 5 | 5 | ✓ |

## Test Architecture
- **Contract Verification Runner**: `tests/verify-contracts.mjs` (Node-based runner for data calculations, currency formatters, seed data validation, and invariant rules).
- **E2E Playwright Suite**: `tests/e2e/*.spec.ts` using Playwright across Chromium, Firefox, WebKit and mobile viewports (`375x667`, `640x900`, `768x1024`, `1024x768`, `1280x800`).
- **Dev Server Invocation**: `npm.cmd run dev` on port 3000.
- **Pass / Fail Semantics**: Zero test failures, zero console runtime exceptions, exit code 0.

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | First-time author login, viewing royalties, and raising query for pending payout | F1, F2, F3, F5, F6, F9, F15 | High |
| 2 | In-production author checking manuscript typesetting stage and raising pre-pub question | F1, F6, F7, F8, F9, F15 | High |
| 3 | Author drafting query, experiencing browser refresh, restoring draft, and submitting | F9, F10, F11, F15, F16 | High |
| 4 | Mobile author navigating via bottom tab bar, viewing empty ticket state, creating query | F1, F4, F12, F14, F9 | Medium |
| 5 | Author inspecting BL-1042, observing 4-node status line and BookLeaf official reply | F1, F12, F13, F15, F16, F17 | High |
| 6 | Operations admin logging in, inspecting KPI cards, sorting queue, and self-assigning ticket | F1, F2, F18, F19, F20, F21, F22 | High |
| 7 | Keyboard-only operator triaging tickets with J/K navigation and opening ticket details | F18, F19, F23 | Medium |

## Coverage Thresholds
- Tier 1: ≥5 test cases per feature (≥115 test cases)
- Tier 2: ≥5 boundary/corner cases per feature (≥115 test cases)
- Tier 3: Pairwise combinations across major feature interactions (≥25 test cases)
- Tier 4: ≥7 realistic end-to-end user application workflows
- **Total Threshold: ≥262 test cases across contract and E2E layers**
