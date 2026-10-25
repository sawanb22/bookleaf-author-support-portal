import assert from 'node:assert/strict';
import { SEED_BOOKS, SEED_TICKETS, INITIAL_ADMIN_METRICS } from '../lib/mock/seed';
import { formatINR, formatCount, formatDate, formatTicketId } from '../lib/formatters';

console.log('--- Verifying Data Models & Formatter Invariants ---');

// 1. Priya Sharma Royalties Invariant Check
const priyaBooks = SEED_BOOKS.filter((b) => b.author_id === 'AUTH001' || b.author_id === 'author_priya');
const earnedTotal = priyaBooks.reduce((sum, b) => sum + b.total_royalty_earned, 0);
const paidTotal = priyaBooks.reduce((sum, b) => sum + b.royalty_paid, 0);
const pendingTotal = priyaBooks.reduce((sum, b) => sum + b.royalty_pending, 0);

assert.equal(earnedTotal, 19908, 'Priya Sharma total earned must be exactly ₹19,908');
assert.equal(paidTotal, 16338, 'Priya Sharma total paid must be exactly ₹16,338');
assert.equal(pendingTotal, 3570, 'Priya Sharma total pending must be exactly ₹3,570');
assert.equal(paidTotal + pendingTotal, earnedTotal, 'Paid + Pending must equal Earned');
console.log('✓ Priya Sharma royalty totals verified: ₹19,908 Earned, ₹16,338 Paid, ₹3,570 Pending.');

// 2. Edge Case Validations
const bk002 = SEED_BOOKS.find((b) => b.external_id === 'BK002');
assert.ok(bk002, 'BK002 must exist');
assert.equal(bk002.royalty_pending, 0, 'BK002 must be paid in full (pending = 0)');

const bk016 = SEED_BOOKS.find((b) => b.external_id === 'BK016');
assert.ok(bk016, 'BK016 must exist');
assert.equal(bk016.royalty_pending, 850, 'BK016 must be ₹850 (< ₹1,000 threshold)');

const bk005 = SEED_BOOKS.find((b) => b.external_id === 'BK005');
assert.ok(bk005, 'BK005 must exist');
assert.equal(bk005.status, 'Published & Live', 'BK005 must be Published & Live');
assert.equal(bk005.royalty_pending, 2546, 'BK005 pending must be ₹2,546 (never paid)');
assert.equal(bk005.royalty_paid, 0, 'BK005 paid must be ₹0');

const bk013 = SEED_BOOKS.find((b) => b.external_id === 'BK013');
assert.ok(bk013, 'BK013 must exist');
assert.equal(bk013.status, 'In production', 'BK013 must be In production');
assert.equal(bk013.stage, 'Cover Design', 'BK013 stage must be Cover Design');

const bk015 = SEED_BOOKS.find((b) => b.external_id === 'BK015');
assert.ok(bk015, 'BK015 must exist');
assert.equal(bk015.status, 'In production', 'BK015 must be In production');
assert.equal(bk015.stage, 'Typesetting', 'BK015 stage must be Typesetting');

// 3. Formatters Test
assert.equal(formatINR(19908), '₹19,908', 'formatINR must format ₹19,908');
assert.equal(formatINR(0), '₹0', 'formatINR(0) must return ₹0');
assert.equal(formatINR(null), 'Not set yet', 'formatINR(null) must return Not set yet');
assert.equal(formatCount(342), '342', 'formatCount(342) must return 342');
assert.equal(formatTicketId('1042'), 'BL-1042', 'formatTicketId must format BL-1042');

// 4. Admin Queue & Metrics (Clean initial queue state for deployment)
assert.equal(INITIAL_ADMIN_METRICS.total_in_queue, 0, 'Total in queue must start at 0');
assert.equal(INITIAL_ADMIN_METRICS.needs_first_reply, 0, 'Needs first reply must start at 0');
assert.equal(INITIAL_ADMIN_METRICS.ai_draft_ready, 0, 'AI draft ready must start at 0');
assert.equal(SEED_TICKETS.length, 0, 'SEED_TICKETS must start clean with 0 pre-seeded tickets');

// 5. Canonical Aggregate Totals (Gate 1 & Gate 5)
const totalCopies = SEED_BOOKS.reduce((sum, b) => sum + (b.total_copies_sold || 0), 0);
const allEarned = SEED_BOOKS.reduce((sum, b) => sum + b.total_royalty_earned, 0);
const allPaid = SEED_BOOKS.reduce((sum, b) => sum + b.royalty_paid, 0);
const allPending = SEED_BOOKS.reduce((sum, b) => sum + b.royalty_pending, 0);

assert.equal(totalCopies, 7205, 'Exact 7,205 copies sold');
assert.equal(allEarned, 243382, 'Exact ₹2,43,382 total earned');
assert.equal(allPaid, 202543, 'Exact ₹2,02,543 total paid');
assert.equal(allPending, 40839, 'Exact ₹40,839 total pending');
assert.equal(allPaid + allPending, allEarned, 'Paid + Pending must equal Earned');
assert.equal(SEED_BOOKS.filter(b => b.status === 'Published & Live').length, 16, 'Exactly 16 Published & Live');
assert.equal(SEED_BOOKS.filter(b => b.status === 'In production').length, 2, 'Exactly 2 In Production');

console.log('✓ All contract and canonical aggregate tests passed successfully!');
