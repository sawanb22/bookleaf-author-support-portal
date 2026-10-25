import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { mockDb, MockDatabase } from '../lib/mock/db';
import { SEED_BOOKS, SEED_TICKETS, SEED_USERS, INITIAL_ADMIN_METRICS } from '../lib/mock/seed';
import { Ticket, TicketMessage, Book, User, TicketPriority } from '../lib/mock/types';
import { formatINR, formatCount, formatDate, formatRelativeTime, formatTicketId } from '../lib/formatters';
import { StatusProgressLine } from '../components/shared/StatusProgressLine';
import { StatusBadge } from '../components/shared/StatusBadge';
import { PriorityGlyph } from '../components/admin/PriorityGlyph';
import { MessageBlock } from '../components/shared/MessageBlock';
import { EmptyState } from '../components/shared/EmptyState';
import { ProductionStageBar } from '../components/author/ProductionStageBar';
import { formatTicketActivity } from '../lib/formatters';

console.log('================================================================');
console.log('  MILESTONE 5: TIER 5 WHITE-BOX ADVERSARIAL STRESS SUITE        ');
console.log('  Stress Testing Route Guards, Idempotency, SSR, Math & Privacy ');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

export interface AdversarialFinding {
  suite: string;
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';
  title: string;
  description: string;
  empiricalResult: string;
  remediation: string;
}

const findings: AdversarialFinding[] = [];

function check(suite: string, id: string, name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ [${suite}] [${id}] ${name}`);
  } catch (err: any) {
    failedTests++;
    console.error(`  ✗ [${suite}] [${id}] ${name}`);
    console.error(`    Error: ${err.message}`);
  }
}

function recordFinding(finding: AdversarialFinding) {
  findings.push(finding);
}

// =============================================================================
// SUITE 1: CROSS-ROLE ROUTE PROTECTION & REDIRECTION
// =============================================================================
console.log('--- SUITE 1: Cross-Role Route Protection & Redirection ---');

/**
 * Functional simulation of AuthorLayout route guard logic:
 * app/(author)/layout.tsx:18-26
 */
function simulateAuthorRouteGuard(authState: {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: { role: string } | null;
}): string | null {
  if (authState.isLoading) return null; // No redirect while loading
  if (!authState.isAuthenticated) return '/login';
  if (authState.user?.role === 'admin') return '/admin/tickets';
  return null; // Allowed access to author routes (/books, /tickets, etc.)
}

/**
 * Functional simulation of AdminLayout route guard logic:
 * app/admin/layout.tsx:19-27
 */
function simulateAdminRouteGuard(authState: {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: { role: string } | null;
}): string | null {
  if (authState.isLoading) return null; // No redirect while loading
  if (!authState.isAuthenticated) return '/login';
  if (authState.user?.role === 'author') return '/books';
  return null; // Allowed access to admin routes (/admin/tickets, etc.)
}

/**
 * Functional simulation of RootPage route guard logic:
 * app/page.tsx:12-22
 */
function simulateRootRouteGuard(authState: {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: { role: string } | null;
}): string | null {
  if (authState.isLoading) return null;
  if (!authState.isAuthenticated || !authState.user) return '/login';
  if (authState.user.role === 'admin') return '/admin/tickets';
  return '/books';
}

check('ROUTE-GUARD', 'RG-01', 'Unauthenticated user accessing /books redirected to /login', () => {
  const redirect = simulateAuthorRouteGuard({
    isAuthenticated: false,
    isLoading: false,
    user: null,
  });
  assert.equal(redirect, '/login', 'Unauthenticated accessing author route must redirect to /login');
});

check('ROUTE-GUARD', 'RG-02', 'Unauthenticated user accessing /admin/tickets redirected to /login', () => {
  const redirect = simulateAdminRouteGuard({
    isAuthenticated: false,
    isLoading: false,
    user: null,
  });
  assert.equal(redirect, '/login', 'Unauthenticated accessing admin route must redirect to /login');
});

check('ROUTE-GUARD', 'RG-03', 'Author user accessing /admin/tickets redirected to /books', () => {
  const redirect = simulateAdminRouteGuard({
    isAuthenticated: true,
    isLoading: false,
    user: { role: 'author' },
  });
  assert.equal(redirect, '/books', 'Author user accessing admin route must redirect to /books');
});

check('ROUTE-GUARD', 'RG-04', 'Admin user accessing /books redirected to /admin/tickets', () => {
  const redirect = simulateAuthorRouteGuard({
    isAuthenticated: true,
    isLoading: false,
    user: { role: 'admin' },
  });
  assert.equal(redirect, '/admin/tickets', 'Admin user accessing author route must redirect to /admin/tickets');
});

check('ROUTE-GUARD', 'RG-05', 'Author accessing /books is permitted without redirection', () => {
  const redirect = simulateAuthorRouteGuard({
    isAuthenticated: true,
    isLoading: false,
    user: { role: 'author' },
  });
  assert.equal(redirect, null, 'Author user accessing author route must not be redirected');
});

check('ROUTE-GUARD', 'RG-06', 'Admin accessing /admin/tickets is permitted without redirection', () => {
  const redirect = simulateAdminRouteGuard({
    isAuthenticated: true,
    isLoading: false,
    user: { role: 'admin' },
  });
  assert.equal(redirect, null, 'Admin user accessing admin route must not be redirected');
});

check('ROUTE-GUARD', 'RG-07', 'Route guards suppress premature redirection while isLoading is true', () => {
  const authorLoadingRedirect = simulateAuthorRouteGuard({
    isAuthenticated: false,
    isLoading: true,
    user: null,
  });
  const adminLoadingRedirect = simulateAdminRouteGuard({
    isAuthenticated: false,
    isLoading: true,
    user: null,
  });
  assert.equal(authorLoadingRedirect, null, 'Author guard must not redirect while loading');
  assert.equal(adminLoadingRedirect, null, 'Admin guard must not redirect while loading');
});

check('ROUTE-GUARD', 'RG-08', 'Root route / redirects correctly across all authentication roles', () => {
  assert.equal(simulateRootRouteGuard({ isAuthenticated: false, isLoading: false, user: null }), '/login');
  assert.equal(simulateRootRouteGuard({ isAuthenticated: true, isLoading: false, user: { role: 'author' } }), '/books');
  assert.equal(simulateRootRouteGuard({ isAuthenticated: true, isLoading: false, user: { role: 'admin' } }), '/admin/tickets');
});

// =============================================================================
// SUITE 2: IDEMPOTENCY ISOLATION STRESS TEST
// =============================================================================
console.log('\n--- SUITE 2: Idempotency Isolation Stress Test ---');

mockDb.resetToSeed();

check('IDEMPOTENCY', 'IDEM-01', 'Ticket creation with idempotency key returns exact same ticket on repeated invocations', () => {
  const initialTicketCount = mockDb.getTickets().length;
  const initialMetrics = mockDb.getAdminMetrics();
  const testKey = `ticket_idem_${Date.now()}_alpha`;

  const input = {
    author_id: 'author_priya',
    book_id: 'BK001',
    subject: 'Idempotency Stress Query',
    description: 'Verifying that multiple form submissions with identical key do not duplicate.',
    category: 'Royalty & Payments',
    priority: 'Medium' as TicketPriority,
  };

  // First invocation
  const firstTicket = mockDb.createTicket(input, testKey);
  assert.ok(firstTicket.id.startsWith('BL-'), 'Ticket ID must start with BL-');

  // 50 Repeated invocations simulating duplicate clicks, double network packets, or aggressive retries
  for (let i = 0; i < 50; i++) {
    const duplicate = mockDb.createTicket(input, testKey);
    assert.equal(duplicate.id, firstTicket.id, 'Repeated call must return identical ticket ID');
  }

  // Database size must have grown by EXACTLY 1
  const afterTicketCount = mockDb.getTickets().length;
  assert.equal(afterTicketCount, initialTicketCount + 1, 'Database must contain exactly 1 new ticket, not 51');

  // Metrics must have incremented by EXACTLY 1
  const afterMetrics = mockDb.getAdminMetrics();
  assert.equal(afterMetrics.total_in_queue, initialMetrics.total_in_queue + 1, 'total_in_queue must increment by 1');
  assert.equal(afterMetrics.needs_first_reply, initialMetrics.needs_first_reply + 1, 'needs_first_reply must increment by 1');
});

check('IDEMPOTENCY', 'IDEM-02', 'Idempotency key guards against payload mutation attempts', () => {
  const testKey = `ticket_idem_${Date.now()}_mutation_check`;
  const originalInput = {
    author_id: 'author_priya',
    book_id: 'BK001',
    subject: 'Original Subject',
    description: 'Original Description',
  };

  const originalTicket = mockDb.createTicket(originalInput, testKey);

  // Attempt to call again with SAME key but altered description and subject
  const mutatedInput = {
    author_id: 'author_priya',
    book_id: 'BK002',
    subject: 'MUTATED HACKED SUBJECT',
    description: 'MUTATED HACKED DESCRIPTION',
  };

  const returnedTicket = mockDb.createTicket(mutatedInput, testKey);
  assert.equal(returnedTicket.id, originalTicket.id);
  assert.equal(returnedTicket.subject, 'Original Subject', 'Idempotent key must protect original subject from mutation');
  assert.equal(returnedTicket.description, 'Original Description', 'Idempotent key must protect original description from mutation');
});

check('IDEMPOTENCY', 'IDEM-03', 'Reply submission with idempotency key prevents duplicate messages', () => {
  const ticket = mockDb.getTicket('BL-1042');
  assert.ok(ticket, 'BL-1042 must exist');
  const initialMsgCount = ticket.messages.length;
  const replyKey = `reply_idem_${Date.now()}_beta`;

  const replyInput = {
    sender_name: 'Priya Sharma',
    sender_role: 'author' as const,
    body: 'Follow-up reply on payout timeline.',
  };

  // 1st invocation
  const firstReply = mockDb.addMessage('BL-1042', replyInput, replyKey);
  assert.ok(firstReply.id, 'Reply message must have ID');

  // 50 Rapid duplicate invocations
  for (let i = 0; i < 50; i++) {
    const dupReply = mockDb.addMessage('BL-1042', replyInput, replyKey);
    assert.equal(dupReply.id, firstReply.id, 'Duplicate reply must return existing message ID');
  }

  // Refresh ticket and check message length
  const refreshedTicket = mockDb.getTicket('BL-1042')!;
  assert.equal(refreshedTicket.messages.length, initialMsgCount + 1, 'Ticket messages length must increase by exactly 1');
});

check('IDEMPOTENCY', 'IDEM-04', 'Distinct idempotency keys create distinct independent entries', () => {
  const key1 = `ticket_distinct_${Date.now()}_1`;
  const key2 = `ticket_distinct_${Date.now()}_2`;

  const t1 = mockDb.createTicket({ author_id: 'author_priya', book_id: null, subject: 'Ticket 1', description: 'Desc 1' }, key1);
  const t2 = mockDb.createTicket({ author_id: 'author_priya', book_id: null, subject: 'Ticket 2', description: 'Desc 2' }, key2);

  assert.notEqual(t1.id, t2.id, 'Distinct keys must yield distinct ticket IDs');
});

// =============================================================================
// SUITE 3: SSR SAFETY & LOCALSTORAGE HYDRATION RESILIENCE
// =============================================================================
console.log('\n--- SUITE 3: SSR Safety & LocalStorage Hydration Resilience ---');

check('SSR-RESILIENCE', 'SSR-01', 'Pure Node/SSR environment (window === undefined) initializes cleanly', () => {
  assert.equal(typeof window, 'undefined', 'Test runner runs in Node environment where window is undefined');
  const freshDb = new MockDatabase();
  assert.ok(freshDb.getAllBooks().length >= 18, 'MockDatabase must load seed books without window');
  assert.ok(freshDb.getTickets().length >= 5, 'MockDatabase must load seed tickets without window');
});

check('SSR-RESILIENCE', 'SSR-02', 'All formatters execute cleanly in SSR without DOM dependencies', () => {
  assert.equal(formatINR(25000), '₹25,000');
  assert.equal(formatCount(1420), '1,420');
  assert.ok(formatDate('2026-10-25T10:00:00Z').includes('2026'));
  assert.ok(formatRelativeTime('2026-10-25T10:00:00Z').length > 0);
  assert.equal(formatTicketId('1042'), 'BL-1042');
});

check('SSR-RESILIENCE', 'SSR-03', 'Core components render to static HTML via renderToStaticMarkup without crash', () => {
  const stageBarHtml = renderToStaticMarkup(
    React.createElement(ProductionStageBar, { stage: 'Cover Design' })
  );
  assert.ok(stageBarHtml.includes('Cover Design'));

  const statusProgressHtml = renderToStaticMarkup(
    React.createElement(StatusProgressLine, { status: 'In progress' })
  );
  assert.ok(statusProgressHtml.includes('In progress'));

  const badgeHtml = renderToStaticMarkup(
    React.createElement(StatusBadge, { status: 'Open' })
  );
  assert.ok(badgeHtml.includes('Open'));

  const glyphHtml = renderToStaticMarkup(
    React.createElement(PriorityGlyph, { priority: 'Critical' })
  );
  assert.ok(glyphHtml.includes('Critical'));

  const emptyStateHtml = renderToStaticMarkup(
    React.createElement(EmptyState)
  );
  assert.ok(emptyStateHtml.includes('No tickets yet'));
});

check('SSR-RESILIENCE', 'SSR-04', 'Simulated QuotaExceededError in localStorage does not crash database persist', () => {
  const simulatedStorage: Record<string, string> = {};
  const mockLocalStorage = {
    getItem: (key: string) => simulatedStorage[key] || null,
    setItem: () => {
      const err = new Error('The quota has been exceeded.');
      err.name = 'QuotaExceededError';
      throw err;
    },
    removeItem: (key: string) => { delete simulatedStorage[key]; },
    clear: () => {},
  };

  (global as any).window = { localStorage: mockLocalStorage };
  (global as any).localStorage = mockLocalStorage;

  try {
    const testDb = new MockDatabase();
    assert.doesNotThrow(() => {
      testDb.createTicket({
        author_id: 'author_priya',
        book_id: null,
        subject: 'Quota test subject',
        description: 'Quota test description',
      });
    }, 'QuotaExceededError in localStorage must be caught gracefully without throwing');
  } finally {
    delete (global as any).window;
    delete (global as any).localStorage;
  }
});

check('SSR-RESILIENCE', 'SSR-05', 'Corrupted / malformed JSON in localStorage triggers safe seed fallback', () => {
  const simulatedStorage: Record<string, string> = {
    bookleaf_db_store_v1: '{ "broken_json": [ unclosed array ',
  };
  const mockLocalStorage = {
    getItem: (key: string) => simulatedStorage[key] || null,
    setItem: (key: string, val: string) => { simulatedStorage[key] = val; },
    removeItem: (key: string) => { delete simulatedStorage[key]; },
    clear: () => {},
  };

  (global as any).window = { localStorage: mockLocalStorage };
  (global as any).localStorage = mockLocalStorage;

  try {
    assert.doesNotThrow(() => {
      const testDb = new MockDatabase();
      assert.ok(testDb.getAllBooks().length >= 18, 'Must fall back to SEED_BOOKS on corrupted JSON');
    });
  } finally {
    delete (global as any).window;
    delete (global as any).localStorage;
  }
});

check('SSR-RESILIENCE', 'SSR-06', 'Adversarial Audit: StatusBadge null/undefined input robustness', () => {
  // Test if StatusBadge handles null or undefined status without crashing
  try {
    const htmlUndefined = renderToStaticMarkup(React.createElement(StatusBadge, { status: undefined as any }));
    const htmlNull = renderToStaticMarkup(React.createElement(StatusBadge, { status: null as any }));
    assert.ok(htmlUndefined.includes('<span'), 'StatusBadge renders safe span on undefined');
    assert.ok(htmlNull.includes('<span'), 'StatusBadge renders safe span on null');
  } catch (err: any) {
    recordFinding({
      suite: 'SSR-RESILIENCE',
      id: 'ADV-03',
      severity: 'MEDIUM',
      title: 'StatusBadge component crashes when status prop is undefined or null',
      description: 'In components/shared/StatusBadge.tsx:12, `status.startsWith("In Production")` executes without optional chaining (`status?.startsWith(...)`). If a caller renders StatusBadge with undefined or null status, it throws `TypeError: Cannot read properties of undefined (reading startsWith)` instead of rendering a safe fallback badge.',
      empiricalResult: `Threw TypeError: ${err.message}`,
      remediation: 'Update StatusBadge.tsx:12 to `const isProduction = status === "In production" || status?.startsWith("In Production");` and default `status` to an empty string.',
    });
    throw err;
  }
});

// =============================================================================
// SUITE 4: FINANCIAL INVARIANTS RESILIENCE
// =============================================================================
console.log('\n--- SUITE 4: Financial Invariants Resilience ---');

check('FINANCE-RESILIENCE', 'FIN-01', 'Zero books author royalty calculations and invariants', () => {
  const authorId = 'author_zero_books';
  const summary = mockDb.getAuthorRoyaltySummary(authorId);
  assert.equal(summary.earned, 0);
  assert.equal(summary.paid, 0);
  assert.equal(summary.pending, 0);
  assert.equal(summary.paid + summary.pending, summary.earned, '0 + 0 === 0 invariant');
  assert.equal(formatINR(summary.earned), '₹0');
  assert.equal(formatINR(summary.paid), '₹0');
  assert.equal(formatINR(summary.pending), '₹0');
});

check('FINANCE-RESILIENCE', 'FIN-02', '100 books collection massive aggregation stress test', () => {
  const largeBookList: Book[] = [];
  let expectedEarned = 0;
  let expectedPaid = 0;
  let expectedPending = 0;

  for (let i = 1; i <= 100; i++) {
    const paid = i * 150;
    const pending = i * 50;
    const earned = paid + pending;
    expectedEarned += earned;
    expectedPaid += paid;
    expectedPending += pending;

    largeBookList.push({
      id: `bk_stress_${i}`,
      external_id: `BK${1000 + i}`,
      title: `Stress Book Volume ${i}`,
      isbn: `978-93-${1000000 + i}`,
      genre: 'Fiction',
      publication_date: '2025-01-01',
      status: 'Published & Live',
      author_id: 'author_large_catalog',
      mrp: 399,
      total_copies_sold: 200,
      total_royalty_earned: earned,
      royalty_paid: paid,
      royalty_pending: pending,
      last_royalty_payout_date: '2025-06-30',
      print_partner: 'Repro Books',
      platforms: ['Amazon.in', 'Flipkart'],
    });
  }

  const startTime = Date.now();
  const totalEarned = largeBookList.reduce((sum, b) => sum + b.total_royalty_earned, 0);
  const totalPaid = largeBookList.reduce((sum, b) => sum + b.royalty_paid, 0);
  const totalPending = largeBookList.reduce((sum, b) => sum + b.royalty_pending, 0);
  const duration = Date.now() - startTime;

  assert.equal(totalEarned, expectedEarned);
  assert.equal(totalPaid, expectedPaid);
  assert.equal(totalPending, expectedPending);
  assert.equal(totalPaid + totalPending, totalEarned, 'Sum of paid + pending must exactly equal total earned across 100 books');
  assert.ok(duration < 20, `Calculation took ${duration}ms, expected < 20ms`);

  // Verify INR formatting handles crore/lakh magnitudes accurately
  assert.ok(formatINR(totalEarned).startsWith('₹'));
});

check('FINANCE-RESILIENCE', 'FIN-03', 'Negative royalty adjustments / chargebacks guarded without crash', () => {
  const negAmount = -1500;
  const formattedNeg = formatINR(negAmount);
  assert.ok(formattedNeg.includes('1,500'), 'Formatted negative amount must include 1,500');
  assert.ok(formattedNeg.includes('-'), 'Formatted negative amount must include minus sign');
  assert.ok(formattedNeg.includes('₹'), 'Formatted negative amount must include rupee symbol');

  const negPaise = formatINR(-2450.75, { showPaiseIfNonZero: true });
  assert.ok(negPaise.includes('2,450.75'), 'Formatted negative paise amount must include 2,450.75');
});

check('FINANCE-RESILIENCE', 'FIN-04', 'Floating-point rounding and IEEE 754 precision safeguards', () => {
  // Standard floating point issue: 0.1 + 0.2 = 0.30000000000000004
  const sum = 0.1 + 0.2;
  const res = formatINR(sum, { showPaiseIfNonZero: true });
  assert.equal(res, '₹0.30', `Expected '₹0.30', got '${res}'`);

  // Half-up rounding without paise
  assert.equal(formatINR(1234.49), '₹1,234');
  assert.equal(formatINR(1234.50), '₹1,235');
  assert.equal(formatINR(19.99 + 29.99, { showPaiseIfNonZero: true }), '₹49.98');
});

check('FINANCE-RESILIENCE', 'FIN-05', 'Non-finite, NaN, and null financial inputs guarded', () => {
  assert.equal(formatINR(NaN as any), 'Not set yet');
  assert.equal(formatINR(Infinity), 'Not set yet');
  assert.equal(formatINR(-Infinity), 'Not set yet');
  assert.equal(formatINR(null), 'Not set yet');
  assert.equal(formatINR(undefined), 'Not set yet');
  assert.equal(formatINR(null, { missingText: '—' }), '—');
});

// =============================================================================
// SUITE 5: DATA CONFIDENTIALITY & INTERNAL NOTE ISOLATION
// =============================================================================
console.log('\n--- SUITE 5: Data Confidentiality & Internal Note Isolation ---');

check('DATA-PRIVACY', 'PRIV-01', 'Author ticket details view strictly filters out internal notes and AI drafts', () => {
  const mixedMessages: TicketMessage[] = [
    {
      id: 'm1',
      ticket_id: 'BL-9999',
      sender_name: 'Priya Sharma',
      sender_role: 'author',
      body: 'Can you please check why my royalty disbursement was delayed?',
      created_at: '2026-10-25T10:00:00Z',
    },
    {
      id: 'm2',
      ticket_id: 'BL-9999',
      sender_name: 'Rahul (Ops Lead)',
      sender_role: 'admin',
      body: 'CONFIDENTIAL INTERNAL NOTE: Author bank account IFSC rejected by HDFC payment gateway. Re-checking manually.',
      created_at: '2026-10-25T10:15:00Z',
      is_internal_note: true,
    },
    {
      id: 'm3',
      ticket_id: 'BL-9999',
      sender_name: 'AI Assist Bot',
      sender_role: 'ai',
      body: 'AI draft response: Dear Priya, your payment of ₹3,570 will be credited shortly. (Confidence: 0.96)',
      created_at: '2026-10-25T10:16:00Z',
    },
    {
      id: 'm4',
      ticket_id: 'BL-9999',
      sender_name: 'Operations Team',
      sender_role: 'support',
      body: 'INTERNAL NOTE: Awaiting bank statement confirmation before sending official update.',
      created_at: '2026-10-25T10:30:00Z',
      is_internal_note: true,
    },
    {
      id: 'm5',
      ticket_id: 'BL-9999',
      sender_name: 'Rahul, BookLeaf support',
      sender_role: 'support',
      body: 'Hello Priya, we have verified your account and your pending royalty of ₹3,570 is being disbursed today.',
      created_at: '2026-10-25T11:00:00Z',
      disbursement_note: 'Disbursement of ₹3,570 initiated via NEFT',
    },
    {
      id: 'm6',
      ticket_id: 'BL-9999',
      sender_name: 'Priya Sharma',
      sender_role: 'author',
      body: 'Thank you for the quick resolution!',
      created_at: '2026-10-25T11:10:00Z',
    },
  ];

  // Exact filter expression implemented in app/(author)/tickets/[id]/page.tsx:205
  const visibleMessages = mixedMessages.filter((m) => !m.is_internal_note && m.sender_role !== 'ai');

  // Verify message IDs
  assert.equal(visibleMessages.length, 3, 'Only author and approved support messages must remain');
  assert.deepEqual(
    visibleMessages.map((m) => m.id),
    ['m1', 'm5', 'm6']
  );

  // Verify zero exposure of internal notes or AI drafts
  assert.ok(!visibleMessages.some((m) => m.is_internal_note === true), 'Zero internal notes must be visible');
  assert.ok(!visibleMessages.some((m) => m.sender_role === 'ai'), 'Zero AI draft messages must be visible');

  // Verify none of the confidential texts are present in the filtered thread
  const concatenatedThread = visibleMessages.map((m) => m.body).join(' ');
  assert.ok(!concatenatedThread.includes('CONFIDENTIAL'), 'Internal confidential notes must never leak');
  assert.ok(!concatenatedThread.includes('IFSC rejected'), 'Internal banking comments must never leak');
  assert.ok(!concatenatedThread.includes('Confidence: 0.96'), 'AI confidence metrics must never leak');
  assert.ok(!concatenatedThread.includes('Awaiting bank statement'), 'Internal support notes must never leak');
});

check('DATA-PRIVACY', 'PRIV-02', 'Author rendered MessageBlock blocks never display Lock or AI draft tags', () => {
  const authorMessage: TicketMessage = {
    id: 'msg_author_clean',
    ticket_id: 'BL-1042',
    sender_name: 'Priya Sharma',
    sender_role: 'author',
    body: 'Sample message',
    created_at: new Date().toISOString(),
  };

  const supportMessage: TicketMessage = {
    id: 'msg_support_clean',
    ticket_id: 'BL-1042',
    sender_name: 'Rahul, BookLeaf support',
    sender_role: 'support',
    body: 'Official support message',
    created_at: new Date().toISOString(),
  };

  const authorHtml = renderToStaticMarkup(
    React.createElement(MessageBlock, { message: authorMessage, isAuthorCurrentUser: true })
  );
  const supportHtml = renderToStaticMarkup(
    React.createElement(MessageBlock, { message: supportMessage })
  );

  assert.ok(!authorHtml.includes('Internal note'), 'Author message must not render Internal note tag');
  assert.ok(!authorHtml.includes('AI draft'), 'Author message must not render AI draft tag');
  assert.ok(!supportHtml.includes('Internal note'), 'Official support message must not render Internal note tag');
  assert.ok(!supportHtml.includes('AI draft'), 'Official support message must not render AI draft tag');
  assert.ok(supportHtml.includes('Official'), 'Official support message must display Official badge');
});

// ADVERSARIAL CHALLENGE INVESTIGATION: Internal Note Bleed in formatTicketActivity
check('DATA-PRIVACY', 'PRIV-03', 'Empirical Audit: Internal note impact on ticket list activity derivation', () => {
  /**
   * Investigation of app/(author)/tickets/page.tsx:35-37:
   * const lastSupportMessage = [...messages].reverse().find(
   *   (m) => m.sender_role === 'support' || m.sender_role === 'admin'
   * );
   */
  const ticketWithInternalNote: Ticket = {
    id: 'BL-TEST-AUDIT',
    subject: 'Audit Ticket',
    description: 'Initial query',
    book_id: 'BK001',
    book_title: 'Whispers of the Ganges',
    author_id: 'author_priya',
    author_name: 'Priya Sharma',
    author_email: 'priya.sharma@email.com',
    status: 'In progress',
    priority: 'Medium',
    category: 'Royalty & Payments',
    assignee: 'Rahul',
    has_unread: false,
    created_at: '2026-10-25T00:00:00Z',
    updated_at: '2026-10-25T01:00:00Z',
    messages: [
      {
        id: 'm1',
        ticket_id: 'BL-TEST-AUDIT',
        sender_name: 'Priya Sharma',
        sender_role: 'author',
        body: 'Initial query',
        created_at: '2026-10-25T00:00:00Z',
      },
      {
        id: 'm2',
        ticket_id: 'BL-TEST-AUDIT',
        sender_name: 'Rahul',
        sender_role: 'admin',
        body: 'Secret internal note between admins',
        created_at: '2026-10-25T01:00:00Z',
        is_internal_note: true,
      },
    ],
  };

  // Check how tickets/page.tsx derives lastSupportMessage via formatTicketActivity
  const activity = formatTicketActivity(ticketWithInternalNote as any);

  if (activity.isOfficialReply && activity.text.includes('Rahul')) {
    recordFinding({
      suite: 'DATA-PRIVACY',
      id: 'ADV-01',
      severity: 'LOW',
      title: 'Ticket list activity copy matches admin internal note as official reply',
      description: 'In app/(author)/tickets/page.tsx:36, lastSupportMessage matches admin/support messages without checking !m.is_internal_note. While the secret note content itself is never leaked or visible to the author, the activity label in /tickets may display "Reply from Rahul" even though the note was internal.',
      empiricalResult: `Matched internal note as official reply: "${activity.text}".`,
      remediation: 'Update app/(author)/tickets/page.tsx:36 to include `&& !m.is_internal_note`.',
    });
  }

  assert.ok(!activity.isOfficialReply, 'Internal note must not be flagged as official reply');
  assert.ok(!activity.text.includes('Rahul'), 'Internal note sender name must not leak in activity copy');
});

// ADVERSARIAL CHALLENGE INVESTIGATION: addMessage has_unread setting for internal notes
check('DATA-PRIVACY', 'PRIV-04', 'Empirical Audit: Internal note impact on ticket unread dot', () => {
  mockDb.resetToSeed();
  const ticket = mockDb.getTicket('BL-1031')!;
  assert.ok(ticket);
  const initialUnread = ticket.has_unread;

  // Add internal note by admin
  mockDb.addMessage('BL-1031', {
    sender_name: 'Operations Staff',
    sender_role: 'admin',
    body: 'Confidential investigation note',
    is_internal_note: true,
  });

  const updatedTicket = mockDb.getTicket('BL-1031')!;
  if (updatedTicket.has_unread && !initialUnread) {
    recordFinding({
      suite: 'DATA-PRIVACY',
      id: 'ADV-02',
      severity: 'LOW',
      title: 'Admin internal note triggers has_unread green dot for author',
      description: 'In lib/mock/db.ts:297, addMessage sets ticket.has_unread = true whenever sender_role is support or admin, without checking !message.is_internal_note. This causes the author to see an unread green dot even though the message inside is hidden from their view.',
      empiricalResult: 'has_unread changed from false to true upon adding internal note.',
      remediation: 'In lib/mock/db.ts:297, change condition to `if (!message.is_internal_note && (message.sender_role === "support" || message.sender_role === "admin"))`.',
    });
  }

  assert.equal(updatedTicket.has_unread, false, 'Internal note must not trigger unread dot for authors');
});

// =============================================================================
// SUMMARY REPORT
// =============================================================================
console.log('\n================================================================');
console.log('TIER 5 ADVERSARIAL STRESS SUITE RESULTS:');
console.log(`  Total Checks:    ${totalTests}`);
console.log(`  Passed Checks:   ${passedTests}`);
console.log(`  Failed Checks:   ${failedTests}`);
console.log(`  Findings Found:  ${findings.length}`);
console.log('================================================================\n');

if (findings.length > 0) {
  console.log('Adversarial Findings Recorded:');
  findings.forEach((f) => {
    console.log(`  [${f.severity}] [${f.id}] ${f.title}`);
    console.log(`    ${f.description}`);
    console.log(`    Result: ${f.empiricalResult}\n`);
  });
}

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('✓ ALL TIER 5 STRESS TEST INVARIANTS VERIFIED EMPIRICALLY (EXIT CODE 0)\n');
}
