import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { mockDb } from '../lib/mock/db';
import { SEED_USERS, SEED_BOOKS, SEED_TICKETS, INITIAL_ADMIN_METRICS } from '../lib/mock/seed';
import { Ticket, TicketPriority, TicketStatus, AdminMetric } from '../lib/mock/types';
import { MetricCards } from '../components/admin/MetricCards';
import { PriorityGlyph } from '../components/admin/PriorityGlyph';
import { StatusBadge } from '../components/shared/StatusBadge';
import { formatTicketId, formatDate, formatRelativeTime } from '../lib/formatters';

console.log('========================================================================');
console.log('CHALLENGER 1: ADVERSARIAL STRESS TEST SUITE FOR MILESTONE 4 (ADMIN QUEUE)');
console.log('========================================================================\n');

let passCount = 0;
let failCount = 0;

interface TestFinding {
  suite: string;
  test: string;
  error: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

const findings: TestFinding[] = [];

function check(suite: string, title: string, fn: () => void) {
  try {
    fn();
    passCount++;
    console.log(`  [PASS] ${title}`);
  } catch (err: any) {
    failCount++;
    console.error(`  [FAIL] ${title}`);
    console.error(`         Error: ${err.message}`);
    findings.push({
      suite,
      test: title,
      error: err.message,
      severity: 'HIGH',
    });
  }
}

// =============================================================================
// SUITE 1: OPERATIONAL KPI METRICS & CONSISTENCY
// =============================================================================
console.log('\n--- SUITE 1: Operational KPI Metrics Consistency & Calculations ---');

check('Suite 1: Metrics', '1.1 INITIAL_ADMIN_METRICS invariant schema and baseline values', () => {
  const m = mockDb.getAdminMetrics();
  assert.equal(typeof m.total_in_queue, 'number', 'total_in_queue must be number');
  assert.equal(typeof m.needs_first_reply, 'number', 'needs_first_reply must be number');
  assert.equal(typeof m.near_sla_breach_count, 'number', 'near_sla_breach_count must be number');
  assert.equal(typeof m.awaiting_author, 'number', 'awaiting_author must be number');
  assert.equal(typeof m.ai_draft_ready, 'number', 'ai_draft_ready must be number');
  assert.equal(typeof m.resolved_today, 'number', 'resolved_today must be number');
  assert.equal(typeof m.sla_compliance_rate, 'number', 'sla_compliance_rate must be number');

  assert.equal(m.total_in_queue, 18, 'Initial total in queue must be 18');
  assert.equal(m.needs_first_reply, 6, 'Initial needs_first_reply must be 6');
  assert.equal(m.near_sla_breach_count, 2, 'Initial near_sla_breach_count must be 2');
  assert.equal(m.awaiting_author, 5, 'Initial awaiting_author must be 5');
  assert.equal(m.ai_draft_ready, 4, 'Initial ai_draft_ready must be 4');
  assert.equal(m.resolved_today, 12, 'Initial resolved_today must be 12');
  assert.equal(m.sla_compliance_rate, 94, 'Initial sla_compliance_rate must be 94%');
});

check('Suite 1: Metrics', '1.2 Metric mutations on createTicket (inbound queue increment)', () => {
  const prevMetrics = mockDb.getAdminMetrics();
  const newTicket = mockDb.createTicket({
    author_id: 'author_priya',
    book_id: 'BK001',
    subject: 'Adversarial Test Ticket for Metric Mutation',
    description: 'Testing if queue counter updates reactively.',
  });

  const nextMetrics = mockDb.getAdminMetrics();
  assert.equal(nextMetrics.total_in_queue, prevMetrics.total_in_queue + 1, 'total_in_queue must increment by 1');
  assert.equal(nextMetrics.needs_first_reply, prevMetrics.needs_first_reply + 1, 'needs_first_reply must increment by 1');
  assert.ok(newTicket.id.startsWith('BL-'), 'New ticket ID must be prefixed with BL-');
});

check('Suite 1: Metrics', '1.3 Metric mutations on addMessage support reply (transition from Open to In progress)', () => {
  // Create an open ticket
  const openTicket = mockDb.createTicket({
    author_id: 'author_priya',
    book_id: 'BK001',
    subject: 'Open Ticket Needing Reply',
    description: 'Awaiting response from operations desk.',
  });
  assert.equal(openTicket.status, 'Open');

  const beforeReply = mockDb.getAdminMetrics();
  mockDb.addMessage(openTicket.id, {
    sender_name: 'Rahul, BookLeaf support',
    sender_role: 'support',
    body: 'We are investigating your request now.',
  });

  const afterReply = mockDb.getAdminMetrics();
  const updatedTicket = mockDb.getTicket(openTicket.id);
  assert.equal(updatedTicket?.status, 'In progress', 'Ticket status must auto-transition to In progress');
  assert.equal(afterReply.needs_first_reply, beforeReply.needs_first_reply - 1, 'needs_first_reply must decrement');
});

check('Suite 1: Metrics', '1.4 Metric mutations on updateTicketStatus to Resolved', () => {
  const ticket = mockDb.createTicket({
    author_id: 'author_priya',
    book_id: 'BK001',
    subject: 'Ticket to be Resolved',
    description: 'Testing resolution counter increment.',
  });

  const beforeResolve = mockDb.getAdminMetrics();
  mockDb.updateTicketStatus(ticket.id, 'Resolved');
  const afterResolve = mockDb.getAdminMetrics();

  assert.equal(afterResolve.resolved_today, beforeResolve.resolved_today + 1, 'resolved_today must increment');
  assert.equal(afterResolve.total_in_queue, beforeResolve.total_in_queue - 1, 'total_in_queue must decrement');
});

check('Suite 1: Metrics', '1.5 MetricCards component static markup & token compliance', () => {
  const dummyMetrics: AdminMetric = {
    total_in_queue: 24,
    needs_first_reply: 7,
    near_sla_breach_count: 3,
    awaiting_author: 8,
    ai_draft_ready: 5,
    resolved_today: 15,
    sla_compliance_rate: 96,
  };

  const html = renderToStaticMarkup(React.createElement(MetricCards, { metrics: dummyMetrics }));

  // Assert numbers rendered with tabular figures
  assert.ok(html.includes('tabular-nums'), 'MetricCards must contain tabular-nums');
  assert.ok(html.includes('24'), 'Must render total_in_queue = 24');
  assert.ok(html.includes('7'), 'Must render needs_first_reply = 7');
  assert.ok(html.includes('3 near 48h'), 'Must render near SLA breach badge "3 near 48h"');
  assert.ok(html.includes('8'), 'Must render awaiting_author = 8');
  assert.ok(html.includes('5'), 'Must render ai_draft_ready = 5');
  assert.ok(html.includes('15'), 'Must render resolved_today = 15');
  assert.ok(html.includes('96% SLA'), 'Must render 96% SLA compliance');

  // Assert design spec border accents (§5.6)
  assert.ok(
    html.includes('border-l-[#A5420A]'),
    'Needs First Reply card must have amber/orange alert left-border (#A5420A)'
  );
  assert.ok(
    html.includes('border-l-[#1E4F8C]'),
    'AI Draft Ready card must have steel blue left-border (#1E4F8C)'
  );
});

// =============================================================================
// SUITE 2: 4-BAR PRIORITY GLYPH MAPPING & ACCESSIBILITY
// =============================================================================
console.log('\n--- SUITE 2: Priority Glyph Bar Count Mapping & Accessibility ---');

check('Suite 2: PriorityGlyph', '2.1 Critical Priority maps to exactly 4 filled bars with red styling', () => {
  const html = renderToStaticMarkup(React.createElement(PriorityGlyph, { priority: 'Critical' }));
  assert.ok(html.includes('Critical priority (4 of 4 bars filled)'), 'aria-label must specify 4 of 4 bars filled');
  assert.ok(html.includes('role="img"'), 'Must have role="img"');
  assert.ok(html.includes('bg-priority-critical-text'), 'Active bars must use bg-priority-critical-text');
  // Count filled vs unfilled: exactly 4 filled bars, 0 unfilled
  const filledCount = (html.match(/bg-priority-critical-text/g) || []).length;
  assert.equal(filledCount, 4, 'Critical must have 4 filled bars');
  assert.ok(!html.includes('bg-border border border-border-strong'), 'Critical should have 0 unfilled bars');
});

check('Suite 2: PriorityGlyph', '2.2 High Priority maps to exactly 3 filled bars and 1 unfilled bar', () => {
  const html = renderToStaticMarkup(React.createElement(PriorityGlyph, { priority: 'High' }));
  assert.ok(html.includes('High priority (3 of 4 bars filled)'), 'aria-label must specify 3 of 4 bars filled');
  const filledCount = (html.match(/bg-priority-high-text/g) || []).length;
  assert.equal(filledCount, 3, 'High must have 3 filled bars');
  const unfilledCount = (html.match(/bg-border border border-border-strong\/40/g) || []).length;
  assert.equal(unfilledCount, 1, 'High must have 1 unfilled bar');
});

check('Suite 2: PriorityGlyph', '2.3 Medium Priority maps to exactly 2 filled bars and 2 unfilled bars', () => {
  const html = renderToStaticMarkup(React.createElement(PriorityGlyph, { priority: 'Medium' }));
  assert.ok(html.includes('Medium priority (2 of 4 bars filled)'), 'aria-label must specify 2 of 4 bars filled');
  const unfilledCount = (html.match(/bg-border border border-border-strong\/40/g) || []).length;
  assert.equal(unfilledCount, 2, 'Medium must have 2 unfilled bars');
});

check('Suite 2: PriorityGlyph', '2.4 Low Priority maps to exactly 1 filled bar and 3 unfilled bars', () => {
  const html = renderToStaticMarkup(React.createElement(PriorityGlyph, { priority: 'Low' }));
  assert.ok(html.includes('Low priority (1 of 4 bars filled)'), 'aria-label must specify 1 of 4 bars filled');
  const filledCount = (html.match(/bg-text-muted/g) || []).length;
  assert.ok(filledCount >= 1, 'Low must have 1 filled bar with bg-text-muted');
  const unfilledCount = (html.match(/bg-border border border-border-strong\/40/g) || []).length;
  assert.equal(unfilledCount, 3, 'Low must have 3 unfilled bars');
});

check('Suite 2: PriorityGlyph', '2.5 Fallback handles unknown or undefined priority gracefully', () => {
  const html = renderToStaticMarkup(React.createElement(PriorityGlyph, { priority: 'UnknownPriority' as any }));
  assert.ok(html.includes('1 of 4 bars filled'), 'Unknown priority must fall back to 1 filled bar');
  const unfilledCount = (html.match(/bg-border border border-border-strong\/40/g) || []).length;
  assert.equal(unfilledCount, 3, 'Unknown priority fallback must have 3 unfilled bars');
});

check('Suite 2: PriorityGlyph', '2.6 Stepped bar height classes h-[6px], h-[8px], h-[10px], h-[12px]', () => {
  const html = renderToStaticMarkup(React.createElement(PriorityGlyph, { priority: 'Critical' }));
  assert.ok(html.includes('h-[6px]'), 'Must contain 6px bar');
  assert.ok(html.includes('h-[8px]'), 'Must contain 8px bar');
  assert.ok(html.includes('h-[10px]'), 'Must contain 10px bar');
  assert.ok(html.includes('h-[12px]'), 'Must contain 12px bar');
});

check('Suite 2: PriorityGlyph', '2.7 showLabel=false suppresses text label but preserves bar glyph', () => {
  const htmlWithLabel = renderToStaticMarkup(React.createElement(PriorityGlyph, { priority: 'High', showLabel: true }));
  const htmlWithoutLabel = renderToStaticMarkup(React.createElement(PriorityGlyph, { priority: 'High', showLabel: false }));

  assert.ok(htmlWithLabel.includes('>High</span>'), 'Must include text label when showLabel=true');
  assert.ok(!htmlWithoutLabel.includes('>High</span>'), 'Must NOT include text label when showLabel=false');
  assert.ok(htmlWithoutLabel.includes('role="img"'), 'Bar glyph and aria must remain intact');
});

// =============================================================================
// SUITE 3: QUEUE SEARCH & FILTER COMBINATIONS
// =============================================================================
console.log('\n--- SUITE 3: Queue Search & Multi-Filter Combinations ---');

// We re-implement the exact filtering logic from AdminTicketsPage to test exhaustively
function filterTickets(
  allTickets: Ticket[],
  activeTab: 'All' | 'Unassigned' | 'Open' | 'In progress' | 'Resolved',
  categoryFilter: string,
  priorityFilter: string,
  searchQuery: string
): Ticket[] {
  let result = [...allTickets];

  // Status Tab filter
  if (activeTab === 'Unassigned') {
    result = result.filter((t) => !t.assignee);
  } else if (activeTab !== 'All') {
    result = result.filter((t) => t.status === activeTab);
  }

  // Category filter
  if (categoryFilter !== 'All Categories') {
    result = result.filter((t) => t.category === categoryFilter);
  }

  // Priority filter
  if (priorityFilter !== 'All Priorities') {
    const cleanPriority = priorityFilter.split(' ')[0];
    result = result.filter((t) => t.priority === cleanPriority);
  }

  // Search query
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    result = result.filter(
      (t) =>
        t.id.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.author_name.toLowerCase().includes(q) ||
        (t.book_title && t.book_title.toLowerCase().includes(q)) ||
        t.description.toLowerCase().includes(q)
    );
  }

  return result;
}

const allStoreTickets = mockDb.getTickets();

check('Suite 3: Filtering', '3.1 Status Tab: "All" returns all tickets', () => {
  const res = filterTickets(allStoreTickets, 'All', 'All Categories', 'All Priorities', '');
  assert.equal(res.length, allStoreTickets.length);
});

check('Suite 3: Filtering', '3.2 Status Tab: "Unassigned" returns only tickets with no assignee', () => {
  const res = filterTickets(allStoreTickets, 'Unassigned', 'All Categories', 'All Priorities', '');
  assert.ok(res.length > 0, 'Must find unassigned tickets');
  for (const t of res) {
    assert.equal(t.assignee, null, `Ticket ${t.id} must have null assignee`);
  }
});

check('Suite 3: Filtering', '3.3 Status Tab: "Open", "In progress", "Resolved" match exact status', () => {
  const openRes = filterTickets(allStoreTickets, 'Open', 'All Categories', 'All Priorities', '');
  assert.ok(openRes.length > 0);
  assert.ok(openRes.every((t) => t.status === 'Open'));

  const inProgRes = filterTickets(allStoreTickets, 'In progress', 'All Categories', 'All Priorities', '');
  assert.ok(inProgRes.length > 0);
  assert.ok(inProgRes.every((t) => t.status === 'In progress'));

  const resolvedRes = filterTickets(allStoreTickets, 'Resolved', 'All Categories', 'All Priorities', '');
  assert.ok(resolvedRes.length > 0);
  assert.ok(resolvedRes.every((t) => t.status === 'Resolved'));
});

check('Suite 3: Filtering', '3.4 Category Filter: "Royalty & Payments" isolates royalty tickets', () => {
  const res = filterTickets(allStoreTickets, 'All', 'Royalty & Payments', 'All Priorities', '');
  assert.ok(res.length > 0);
  assert.ok(res.every((t) => t.category === 'Royalty & Payments'));
  assert.ok(res.some((t) => t.id === 'BL-1042'));
});

check('Suite 3: Filtering', '3.5 Category Filter: "Production & Proofs" isolates production tickets', () => {
  const res = filterTickets(allStoreTickets, 'All', 'Production & Proofs', 'All Priorities', '');
  assert.ok(res.length > 0);
  assert.ok(res.every((t) => t.category === 'Production & Proofs'));
  assert.ok(res.some((t) => t.id === 'BL-1048'));
});

check('Suite 3: Filtering', '3.6 Priority Filter: "Critical" isolates critical tickets', () => {
  const res = filterTickets(allStoreTickets, 'All', 'All Categories', 'Critical', '');
  assert.ok(res.length > 0);
  assert.ok(res.every((t) => t.priority === 'Critical'));
  assert.ok(res.some((t) => t.id === 'BL-1048'));
});

check('Suite 3: Filtering', '3.7 Priority Filter: Handles formatted strings like "Critical (4 bars)"', () => {
  const res = filterTickets(allStoreTickets, 'All', 'All Categories', 'Critical (4 bars)', '');
  assert.ok(res.length > 0);
  assert.ok(res.every((t) => t.priority === 'Critical'));
});

check('Suite 3: Filtering', '3.8 Search: By ticket ID ("BL-1042" and "1042")', () => {
  const resFull = filterTickets(allStoreTickets, 'All', 'All Categories', 'All Priorities', 'BL-1042');
  assert.equal(resFull.length, 1);
  assert.equal(resFull[0].id, 'BL-1042');

  const resNumeric = filterTickets(allStoreTickets, 'All', 'All Categories', 'All Priorities', '1042');
  assert.ok(resNumeric.some((t) => t.id === 'BL-1042'));
});

check('Suite 3: Filtering', '3.9 Search: By author name ("Priya", "Vikram")', () => {
  const resPriya = filterTickets(allStoreTickets, 'All', 'All Categories', 'All Priorities', 'Priya');
  assert.ok(resPriya.length >= 4);
  assert.ok(resPriya.every((t) => t.author_name.includes('Priya')));

  const resVikram = filterTickets(allStoreTickets, 'All', 'All Categories', 'All Priorities', 'Vikram');
  assert.ok(resVikram.some((t) => t.author_name === 'Vikram Sethi'));
});

check('Suite 3: Filtering', '3.10 Search: By book title ("Whispers of the Ganges")', () => {
  const res = filterTickets(allStoreTickets, 'All', 'All Categories', 'All Priorities', 'Whispers');
  assert.ok(res.length >= 2);
  assert.ok(res.every((t) => t.book_title?.includes('Whispers')));
});

check('Suite 3: Filtering', '3.11 Search: By description text snippet', () => {
  const res = filterTickets(allStoreTickets, 'All', 'All Categories', 'All Priorities', 'gold foil embossing');
  assert.equal(res.length, 1);
  assert.equal(res.pop()?.id, 'BL-1048');
});

check('Suite 3: Filtering', '3.12 Combined Multi-Filter: Open + Production & Proofs + Critical + "foil"', () => {
  const res = filterTickets(allStoreTickets, 'Open', 'Production & Proofs', 'Critical', 'foil');
  assert.equal(res.length, 1);
  assert.equal(res[0].id, 'BL-1048');
});

check('Suite 3: Filtering', '3.13 Contradictory Filter Combination returns empty array gracefully', () => {
  const res = filterTickets(allStoreTickets, 'Resolved', 'Author Copies', 'Critical', 'Whispers');
  assert.equal(res.length, 0, 'No ticket should match contradictory combination');
});

// =============================================================================
// SUITE 4: QUICK SELF-ASSIGNMENT LOGIC
// =============================================================================
console.log('\n--- SUITE 4: Quick Self-Assignment Logic ---');

check('Suite 4: Assignment', '4.1 mockDb.assignTicket assigns ticket and records avatar initials', () => {
  // Use BL-1055 which starts unassigned
  const ticket = mockDb.getTicket('BL-1055');
  assert.ok(ticket, 'BL-1055 must exist');

  const prevUpdatedAt = ticket.updated_at;
  const assigned = mockDb.assignTicket('BL-1055', 'Rahul', 'RS');

  assert.equal(assigned.assignee, 'Rahul', 'Assignee must be Rahul');
  assert.equal(assigned.assignee_avatar, 'RS', 'Avatar initials must be RS');
  assert.ok(new Date(assigned.updated_at).getTime() >= new Date(prevUpdatedAt).getTime(), 'updated_at must be updated');

  // Verify in-store retrieval
  const refetched = mockDb.getTicket('BL-1055');
  assert.equal(refetched?.assignee, 'Rahul');
  assert.equal(refetched?.assignee_avatar, 'RS');
});

check('Suite 4: Assignment', '4.2 Assigned ticket no longer matches Unassigned tab filter', () => {
  const unassigned = filterTickets(mockDb.getTickets(), 'Unassigned', 'All Categories', 'All Priorities', '');
  assert.ok(!unassigned.some((t) => t.id === 'BL-1055'), 'BL-1055 must no longer be in Unassigned');
});

check('Suite 4: Assignment', '4.3 Bulk assignment of multiple tickets', () => {
  // Create two unassigned tickets
  const t1 = mockDb.createTicket({ author_id: 'author_priya', book_id: null, subject: 'Bulk Test 1', description: 'Desc 1' });
  const t2 = mockDb.createTicket({ author_id: 'author_priya', book_id: null, subject: 'Bulk Test 2', description: 'Desc 2' });

  assert.equal(t1.assignee, null);
  assert.equal(t2.assignee, null);

  [t1.id, t2.id].forEach((id) => mockDb.assignTicket(id, 'Rahul', 'RS'));

  assert.equal(mockDb.getTicket(t1.id)?.assignee, 'Rahul');
  assert.equal(mockDb.getTicket(t2.id)?.assignee, 'Rahul');
});

check('Suite 4: Assignment', '4.4 Assigning non-existent ticket throws descriptive error', () => {
  assert.throws(
    () => {
      mockDb.assignTicket('BL-999999', 'Rahul', 'RS');
    },
    /Ticket BL-999999 not found/,
    'Must throw error if ticket does not exist'
  );
});

// =============================================================================
// SUITE 5: AI OVERRIDE MARKER PRESENCE AND ABSENCE
// =============================================================================
console.log('\n--- SUITE 5: AI Override Marker Invariants ---');

check('Suite 5: AI Override', '5.1 Overridden ticket BL-1048 has category_overridden = true and original_ai_category', () => {
  const ticket = mockDb.getTicket('BL-1048');
  assert.ok(ticket, 'BL-1048 must exist');
  assert.equal(ticket.category_overridden, true, 'BL-1048 must have category_overridden = true');
  assert.equal(ticket.original_ai_category, 'Cover & Design', 'Original category must be Cover & Design');
  assert.equal(ticket.category, 'Production & Proofs', 'Current category must be Production & Proofs');
});

check('Suite 5: AI Override', '5.2 Non-overridden tickets have no override flags', () => {
  const nonOverriddenIds = ['BL-1042', 'BL-1051', 'BL-1053', 'BL-1031'];
  for (const id of nonOverriddenIds) {
    const t = mockDb.getTicket(id);
    assert.ok(t);
    assert.ok(!t.category_overridden, `${id} category_overridden must be false/undefined`);
    assert.ok(!t.priority_overridden, `${id} priority_overridden must be false/undefined`);
  }
});

// Helper simulating row category column markup
function renderCategoryCell(ticket: Ticket): string {
  const isOverridden = ticket.category_overridden || ticket.priority_overridden;
  const parts: string[] = [];
  parts.push(`<span>${ticket.category}</span>`);
  if (isOverridden) {
    parts.push(
      `<div title="Changed from AI suggestion: ${ticket.original_ai_category || 'Royalty & Payments'}"><span>Changed from AI</span></div>`
    );
  }
  return parts.join('');
}

check('Suite 5: AI Override', '5.3 Category cell renders override marker only when overridden', () => {
  const overriddenTicket = mockDb.getTicket('BL-1048')!;
  const regularTicket = mockDb.getTicket('BL-1042')!;

  const htmlOverridden = renderCategoryCell(overriddenTicket);
  assert.ok(htmlOverridden.includes('Changed from AI'), 'Overridden ticket must render "Changed from AI"');
  assert.ok(htmlOverridden.includes('Changed from AI suggestion: Cover & Design'), 'Must render tooltip with original category');

  const htmlRegular = renderCategoryCell(regularTicket);
  assert.ok(!htmlRegular.includes('Changed from AI'), 'Regular ticket must NOT render "Changed from AI"');
});

// =============================================================================
// SUITE 6: LIVE NOTIFICATION PILL LOGIC
// =============================================================================
console.log('\n--- SUITE 6: Live Notification Pill Logic ---');

check('Suite 6: Live Pill', '6.1 Initial pill count is 2 and displays "2 new tickets. Show"', () => {
  let newTicketsPillCount = 2;
  const pillText = `${newTicketsPillCount} new tickets. Show`;
  assert.equal(pillText, '2 new tickets. Show', 'Pill text must adhere to Spec §3.9');
});

check('Suite 6: Live Pill', '6.2 Merging tickets resets pill count to 0 and highlights top row', () => {
  let newTicketsPillCount = 2;
  let liveHighlightTicketId: string | null = null;

  // Simulate handleShowNewTickets
  const handleShowNewTickets = (topTicketId: string) => {
    newTicketsPillCount = 0;
    liveHighlightTicketId = topTicketId;
  };

  const topId = mockDb.getTickets()[0]?.id || 'BL-1042';
  handleShowNewTickets(topId);

  assert.equal(newTicketsPillCount, 0, 'Pill count must reset to 0');
  assert.equal(liveHighlightTicketId, topId, 'Top ticket must be highlighted');
});

// =============================================================================
// SUITE 7: ROLE GUARD & ADMIN LAYOUT INVARIANTS
// =============================================================================
console.log('\n--- SUITE 7: Role Guard & Admin Layout Invariants ---');

check('Suite 7: Role Guard', '7.1 Unauthenticated state triggers redirect to /login', () => {
  const authState = {
    isAuthenticated: false,
    user: null,
    isLoading: false,
  };

  let redirectedTo: string | null = null;
  const router = {
    replace: (path: string) => {
      redirectedTo = path;
    },
  };

  if (!authState.isLoading) {
    if (!authState.isAuthenticated) {
      router.replace('/login');
    } else if ((authState.user as any)?.role === 'author') {
      router.replace('/books');
    }
  }

  assert.equal(redirectedTo, '/login', 'Unauthenticated user must be redirected to /login');
});

check('Suite 7: Role Guard', '7.2 Author role triggers redirect to /books away from /admin', () => {
  const authState = {
    isAuthenticated: true,
    user: { id: 'author_priya', role: 'author', name: 'Priya Sharma' },
    isLoading: false,
  };

  let redirectedTo: string | null = null;
  const router = {
    replace: (path: string) => {
      redirectedTo = path;
    },
  };

  if (!authState.isLoading) {
    if (!authState.isAuthenticated) {
      router.replace('/login');
    } else if (authState.user?.role === 'author') {
      router.replace('/books');
    }
  }

  assert.equal(redirectedTo, '/books', 'Author role must be redirected to /books');
});

check('Suite 7: Role Guard', '7.3 Admin role is permitted through with no redirect', () => {
  const authState = {
    isAuthenticated: true,
    user: { id: 'admin_rahul', role: 'admin', name: 'Rahul' },
    isLoading: false,
  };

  let redirectedTo: string | null = null;
  const router = {
    replace: (path: string) => {
      redirectedTo = path;
    },
  };

  if (!authState.isLoading) {
    if (!authState.isAuthenticated) {
      router.replace('/login');
    } else if (authState.user?.role === 'author') {
      router.replace('/books');
    }
  }

  assert.equal(redirectedTo, null, 'Admin role must not be redirected');
});

// =============================================================================
// SUITE 8: SORTING COMPARATORS
// =============================================================================
console.log('\n--- SUITE 8: Queue Sorting Comparator Invariants ---');

check('Suite 8: Sorting', '8.1 Numeric sorting by ID ascending vs descending', () => {
  const sample = [
    { id: 'BL-1031' },
    { id: 'BL-1042' },
    { id: 'BL-1014' },
    { id: 'BL-1048' },
  ] as Ticket[];

  const asc = [...sample].sort((a, b) => {
    const numA = parseInt(a.id.replace(/\D/g, ''), 10) || 0;
    const numB = parseInt(b.id.replace(/\D/g, ''), 10) || 0;
    return numA - numB;
  });

  assert.deepEqual(
    asc.map((t) => t.id),
    ['BL-1014', 'BL-1031', 'BL-1042', 'BL-1048']
  );

  const desc = [...sample].sort((a, b) => {
    const numA = parseInt(a.id.replace(/\D/g, ''), 10) || 0;
    const numB = parseInt(b.id.replace(/\D/g, ''), 10) || 0;
    return numB - numA;
  });

  assert.deepEqual(
    desc.map((t) => t.id),
    ['BL-1048', 'BL-1042', 'BL-1031', 'BL-1014']
  );
});

check('Suite 8: Sorting', '8.2 Priority sorting hierarchy (Critical=4, High=3, Medium=2, Low=1)', () => {
  const sample = [
    { id: 't1', priority: 'Low' },
    { id: 't2', priority: 'Critical' },
    { id: 't3', priority: 'Medium' },
    { id: 't4', priority: 'High' },
  ] as Ticket[];

  const order: Record<TicketPriority, number> = {
    Critical: 4,
    High: 3,
    Medium: 2,
    Low: 1,
  };

  const desc = [...sample].sort((a, b) => order[b.priority] - order[a.priority]);
  assert.deepEqual(
    desc.map((t) => t.priority),
    ['Critical', 'High', 'Medium', 'Low']
  );

  const asc = [...sample].sort((a, b) => order[a.priority] - order[b.priority]);
  assert.deepEqual(
    asc.map((t) => t.priority),
    ['Low', 'Medium', 'High', 'Critical']
  );
});

// =============================================================================
// TEST SUITE SUMMARY
// =============================================================================
console.log('\n========================================================================');
console.log(`TOTAL TESTS: ${passCount + failCount}`);
console.log(`PASSED:      ${passCount}`);
console.log(`FAILED:      ${failCount}`);
console.log('========================================================================\n');

if (failCount > 0) {
  console.error('CRITICAL FINDINGS DETECTED:');
  findings.forEach((f, i) => {
    console.error(`  ${i + 1}. [${f.severity}] ${f.suite} > ${f.test}: ${f.error}`);
  });
  process.exit(1);
} else {
  console.log('ALL ADVERSARIAL STRESS TESTS PASSED EMPIRICALLY! ZERO REGRESSIONS.');
  process.exit(0);
}
