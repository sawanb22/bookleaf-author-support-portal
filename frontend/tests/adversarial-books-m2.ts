import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SEED_USERS, SEED_BOOKS } from '../lib/mock/seed';
import { mockDb } from '../lib/mock/db';
import { formatINR, formatCount, formatDate, formatTicketId, formatRelativeTime } from '../lib/formatters';
import { PRODUCTION_STAGES, MIN_PAYOUT_INR } from '../lib/constants';
import { ProductionStageBar } from '../components/author/ProductionStageBar';
import { StatusBadge } from '../components/shared/StatusBadge';
import { Book } from '../lib/mock/types';

console.log('================================================================');
console.log('CHALLENGER 2: ADVERSARIAL STRESS TEST SUITE FOR /books PAGE (M2)');
console.log('================================================================\n');

let passCount = 0;
let failCount = 0;

interface TestFinding {
  suite: string;
  test: string;
  expected: any;
  actual: any;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

const findings: TestFinding[] = [];

function check(title: string, fn: () => void) {
  try {
    fn();
    passCount++;
    console.log(`  [PASS] ${title}`);
  } catch (err: any) {
    failCount++;
    console.error(`  [FAIL] ${title}`);
    console.error(`         Error: ${err.message}`);
    findings.push({
      suite: 'Adversarial Test',
      test: title,
      expected: 'Assertion should hold',
      actual: err.message,
      severity: 'HIGH',
    });
  }
}

// -----------------------------------------------------------------------------
// Helper: Render Row and Card identical to app/(author)/books/page.tsx
// -----------------------------------------------------------------------------
function renderDesktopRow(book: Book): string {
  const isProduction = book.status === 'In production';
  const isPaidInFull = book.royalty_pending === 0 && (book.total_royalty_earned > 0 || book.royalty_paid > 0);
  const isBelowMinimum = book.royalty_pending > 0 && book.royalty_pending < MIN_PAYOUT_INR;

  const statusBadge = renderToStaticMarkup(React.createElement(StatusBadge, { status: book.status, stage: book.stage }));
  const stageBar = isProduction ? renderToStaticMarkup(React.createElement(ProductionStageBar, { stage: book.stage })) : '';

  return `
    <article class="desktop-row" data-id="${book.id}">
      <div class="title">${book.title}</div>
      <div class="isbn">ISBN ${book.isbn}</div>
      <div class="genre">${book.genre}</div>
      <div class="status">${statusBadge}</div>
      <div class="published">${isProduction ? 'Not published yet' : book.publication_date ? `Published ${formatDate(book.publication_date)}` : 'Not published yet'}</div>
      <div class="mrp">${isProduction ? 'Not set yet' : formatINR(book.mrp)}</div>
      <div class="sold">${isProduction ? '—' : formatCount(book.total_copies_sold)}</div>
      ${isProduction ? `
        <div class="royalties-in-production">Royalties start after publication.</div>
        <div class="production-bar">${stageBar}</div>
      ` : `
        <div class="earned">${formatINR(book.total_royalty_earned)}</div>
        <div class="paid">${formatINR(book.royalty_paid)} ${book.last_royalty_payout_date ? `Last payout ${formatDate(book.last_royalty_payout_date)}` : 'No payout yet'}</div>
        <div class="pending">
          ${isPaidInFull ? `₹0 Paid in full` : `${formatINR(book.royalty_pending)}${isBelowMinimum ? ' Below the ₹1,000 minimum. Rolls over to the next quarter.' : ''}`}
        </div>
      `}
      <div class="platforms">${book.platforms && book.platforms.length > 0 ? `Available on ${book.platforms.join(', ')}.${book.print_partner ? ` ${book.print_partner}` : ''}` : 'Not listed on any platform yet.'}</div>
    </article>
  `;
}

function renderMobileCard(book: Book): string {
  const isProduction = book.status === 'In production';
  const isPaidInFull = book.royalty_pending === 0 && (book.total_royalty_earned > 0 || book.royalty_paid > 0);
  const isBelowMinimum = book.royalty_pending > 0 && book.royalty_pending < MIN_PAYOUT_INR;

  const statusBadge = renderToStaticMarkup(React.createElement(StatusBadge, { status: book.status, stage: book.stage }));
  const stageBar = isProduction ? renderToStaticMarkup(React.createElement(ProductionStageBar, { stage: book.stage })) : '';

  return `
    <article class="mobile-card" data-id="${book.id}">
      <h3>${book.title}</h3>
      <div class="status">${statusBadge}</div>
      <div class="isbn">ISBN ${book.isbn}</div>
      ${isProduction ? `
        <div class="mrp">Not set yet</div>
        <div class="sold">—</div>
        <div class="publication">Not published yet</div>
        <div class="production-bar">${stageBar}</div>
        <div class="royalties-prod">Royalties start after publication.</div>
      ` : `
        <div class="mrp">${formatINR(book.mrp)}</div>
        <div class="sold">${formatCount(book.total_copies_sold)}</div>
        <div class="published">${book.publication_date ? formatDate(book.publication_date) : 'Not published yet'}</div>
        <div class="earned">${formatINR(book.total_royalty_earned)}</div>
        <div class="paid">${formatINR(book.royalty_paid)} ${book.last_royalty_payout_date ? `Last payout ${formatDate(book.last_royalty_payout_date)}` : 'No payout yet'}</div>
        <div class="pending">
          ${isPaidInFull ? '₹0 Paid in full' : `${formatINR(book.royalty_pending)}${isBelowMinimum ? ' Below the ₹1,000 minimum. Rolls over to the next quarter.' : ''}`}
        </div>
      `}
      <div class="platforms">${book.platforms && book.platforms.length > 0 ? `Available on ${book.platforms.join(', ')}.${book.print_partner ? ` ${book.print_partner}` : ''}` : 'Not listed on any platform yet.'}</div>
    </article>
  `;
}

function renderSummaryBand(books: Book[]): string {
  const totalEarned = books.reduce((sum, b) => sum + (b.total_royalty_earned || 0), 0);
  const totalPaid = books.reduce((sum, b) => sum + (b.royalty_paid || 0), 0);
  const totalPending = books.reduce((sum, b) => sum + (b.royalty_pending || 0), 0);
  const allInProduction = books.length > 0 && books.every((b) => b.status === 'In production');

  if (allInProduction) {
    return `<div class="summary-band all-in-prod">No royalties yet. They start once a book is published.</div>`;
  }

  return `
    <div class="summary-band">
      <div class="col-earned">
        <span>Earned</span>
        <div class="figure">${formatINR(totalEarned)}</div>
      </div>
      <div class="col-paid">
        <span>Paid</span>
        <div class="figure">${formatINR(totalPaid)}</div>
      </div>
      <div class="col-pending">
        <span>Pending</span>
        <div class="figure">${formatINR(totalPending)}</div>
      </div>
    </div>
  `;
}

// =============================================================================
// SUITE 1: DYNAMIC SUMMARY BAND CALCULATIONS ACROSS SEED USERS
// =============================================================================
console.log('--- SUITE 1: Dynamic Calculation of Summary Band Figures ---');

check('Priya Sharma (author_priya) summary band figures: Earned ₹19,908, Paid ₹16,338, Pending ₹3,570', () => {
  const priyaBooks = mockDb.getBooksByAuthor('author_priya');
  assert.equal(priyaBooks.length, 2, 'Priya Sharma must have 2 books');

  const earned = priyaBooks.reduce((sum, b) => sum + b.total_royalty_earned, 0);
  const paid = priyaBooks.reduce((sum, b) => sum + b.royalty_paid, 0);
  const pending = priyaBooks.reduce((sum, b) => sum + b.royalty_pending, 0);

  assert.equal(earned, 19908, 'Earned must equal 19908');
  assert.equal(paid, 16338, 'Paid must equal 16338');
  assert.equal(pending, 3570, 'Pending must equal 3570');
  assert.equal(paid + pending, earned, 'Financial invariant: Paid + Pending === Earned');

  const markup = renderSummaryBand(priyaBooks);
  assert.ok(markup.includes('₹19,908'), 'Markup must contain ₹19,908');
  assert.ok(markup.includes('₹16,338'), 'Markup must contain ₹16,338');
  assert.ok(markup.includes('₹3,570'), 'Markup must contain ₹3,570');
  assert.ok(!markup.includes('No royalties yet'), 'Must not display all-in-production notice');
});

check('mockDb.getAuthorRoyaltySummary matches page calculate figures for all SEED_USERS', () => {
  for (const user of SEED_USERS) {
    const userBooks = mockDb.getBooksByAuthor(user.id);
    const summary = mockDb.getAuthorRoyaltySummary(user.id);

    const earned = userBooks.reduce((sum, b) => sum + (b.total_royalty_earned || 0), 0);
    const paid = userBooks.reduce((sum, b) => sum + (b.royalty_paid || 0), 0);
    const pending = userBooks.reduce((sum, b) => sum + (b.royalty_pending || 0), 0);

    assert.equal(summary.earned, earned, `User ${user.id} summary.earned mismatch`);
    assert.equal(summary.paid, paid, `User ${user.id} summary.paid mismatch`);
    assert.equal(summary.pending, pending, `User ${user.id} summary.pending mismatch`);
    assert.equal(summary.paid + summary.pending, summary.earned, `User ${user.id} paid+pending must equal earned`);

    // Verify formatINR produces clean output
    const earnedFormatted = formatINR(earned);
    const paidFormatted = formatINR(paid);
    const pendingFormatted = formatINR(pending);

    assert.ok(earnedFormatted.startsWith('₹'), `User ${user.id} earnedFormatted starts with ₹`);
    assert.ok(paidFormatted.startsWith('₹'), `User ${user.id} paidFormatted starts with ₹`);
    assert.ok(pendingFormatted.startsWith('₹'), `User ${user.id} pendingFormatted starts with ₹`);

    assert.ok(!earnedFormatted.includes('NaN'), `User ${user.id} earnedFormatted contains NaN`);
    assert.ok(!paidFormatted.includes('NaN'), `User ${user.id} paidFormatted contains NaN`);
    assert.ok(!pendingFormatted.includes('NaN'), `User ${user.id} pendingFormatted contains NaN`);
  }
});

check('Multi-book author Rohit Kapoor (AUTH002) aggregation across BK003 and BK004', () => {
  const rohitBooks = mockDb.getBooksByAuthor('AUTH002');
  assert.equal(rohitBooks.length, 2, 'Rohit Kapoor must have 2 books');

  const earned = rohitBooks.reduce((s, b) => s + b.total_royalty_earned, 0);
  const paid = rohitBooks.reduce((s, b) => s + b.royalty_paid, 0);
  const pending = rohitBooks.reduce((s, b) => s + b.royalty_pending, 0);

  // BK003: 26280 earned, 21000 paid, 5280 pending
  // BK004: 57744 earned, 50000 paid, 7744 pending
  assert.equal(earned, 26280 + 57744, 'Earned must be 84024');
  assert.equal(paid, 21000 + 50000, 'Paid must be 71000');
  assert.equal(pending, 5280 + 7744, 'Pending must be 13024');
  assert.equal(paid + pending, earned, 'Paid + Pending === Earned');

  const markup = renderSummaryBand(rohitBooks);
  assert.ok(markup.includes('₹84,024'), 'Markup must show ₹84,024');
  assert.ok(markup.includes('₹71,000'), 'Markup must show ₹71,000');
  assert.ok(markup.includes('₹13,024'), 'Markup must show ₹13,024');
});

// =============================================================================
// SUITE 2: AUTHOR WITH ALL BOOKS IN PRODUCTION
// =============================================================================
console.log('\n--- SUITE 2: Author with All Books in Production ---');

check('In-production book BK013 (Midnight in Mysore) displays all-in-production banner', () => {
  const bk013 = mockDb.getBookByExternalId('BK013')!;
  assert.ok(bk013);
  assert.equal(bk013.status, 'In production', 'BK013 must be In production');
  assert.equal(bk013.stage, 'Cover Design');

  const markup = renderSummaryBand([bk013]);
  assert.ok(
    markup.includes('No royalties yet. They start once a book is published.'),
    'Must display exact copy: "No royalties yet. They start once a book is published."'
  );
  assert.ok(!markup.includes('col-earned'), 'Must NOT render Earned column');
  assert.ok(!markup.includes('col-paid'), 'Must NOT render Paid column');
  assert.ok(!markup.includes('col-pending'), 'Must NOT render Pending column');
});

check('In-production book BK015 (Raising Roots) displays all-in-production banner', () => {
  const bk015 = mockDb.getBookByExternalId('BK015')!;
  assert.ok(bk015);
  assert.equal(bk015.status, 'In production');
  assert.equal(bk015.stage, 'Typesetting');

  const markup = renderSummaryBand([bk015]);
  assert.ok(markup.includes('No royalties yet. They start once a book is published.'));
  assert.ok(!markup.includes('col-earned'));
});

check('Synthetic multi-book in-production author (Anita Desai with 3 production books)', () => {
  const anitaBooks: Book[] = [
    {
      id: 'book_ad1',
      external_id: 'BK101',
      author_id: 'author_anita',
      title: 'Clear Light of Day: Notes',
      isbn: '978-93-51234-90-1',
      genre: 'Literary Criticism',
      publication_date: null,
      status: 'In production',
      stage: 'Manuscript Received',
      mrp: null,
      total_copies_sold: null,
      total_royalty_earned: 0,
      royalty_paid: 0,
      royalty_pending: 0,
      last_royalty_payout_date: null,
      print_partner: null,
      platforms: [],
    },
    {
      id: 'book_ad2',
      external_id: 'BK102',
      author_id: 'author_anita',
      title: 'In Custody: Reflections',
      isbn: '978-93-51234-90-2',
      genre: 'Essays',
      publication_date: null,
      status: 'In production',
      stage: 'Proofreading',
      mrp: null,
      total_copies_sold: null,
      total_royalty_earned: 0,
      royalty_paid: 0,
      royalty_pending: 0,
      last_royalty_payout_date: null,
      print_partner: null,
      platforms: [],
    },
    {
      id: 'book_ad3',
      external_id: 'BK103',
      author_id: 'author_anita',
      title: 'Fasting, Feasting: Retrospective',
      isbn: '978-93-51234-90-3',
      genre: 'Memoir',
      publication_date: null,
      status: 'In production',
      stage: 'Distribution Setup',
      mrp: null,
      total_copies_sold: null,
      total_royalty_earned: 0,
      royalty_paid: 0,
      royalty_pending: 0,
      last_royalty_payout_date: null,
      print_partner: null,
      platforms: [],
    },
  ];

  const markup = renderSummaryBand(anitaBooks);
  assert.ok(markup.includes('No royalties yet. They start once a book is published.'));
  assert.ok(!markup.includes('col-earned'));
  assert.ok(!markup.includes('col-paid'));
  assert.ok(!markup.includes('col-pending'));
});

check('Boundary case: Author with 0 books displays default ₹0 columns, not in-production banner', () => {
  const zeroBooks: Book[] = [];
  const markup = renderSummaryBand(zeroBooks);
  assert.ok(markup.includes('₹0'), 'Should show ₹0');
  assert.ok(!markup.includes('No royalties yet. They start once a book is published.'));
});

// =============================================================================
// SUITE 3: 9-STAGE PRODUCTION LINE COMPONENT VERIFICATION
// =============================================================================
console.log('\n--- SUITE 3: 9-Stage Production Line Verification ---');

check('PRODUCTION_STAGES in constants.ts contains exactly 9 canonical stages in order', () => {
  assert.equal(PRODUCTION_STAGES.length, 9, 'Must have 9 stages');
  assert.deepEqual(Array.from(PRODUCTION_STAGES), [
    'Manuscript Received',
    'Editing',
    'Cover Design',
    'Typesetting',
    'Proofreading',
    'ISBN Assignment',
    'Printing',
    'Distribution Setup',
    'Published & Live',
  ]);
});

check('ProductionStageBar maps every canonical stage 1 to 9 with proper step counter and label', () => {
  for (let i = 0; i < PRODUCTION_STAGES.length; i++) {
    const stageName = PRODUCTION_STAGES[i];
    const stepNum = i + 1;
    const escapedStageName = stageName.replace(/&/g, '&amp;');

    const html = renderToStaticMarkup(React.createElement(ProductionStageBar, { stage: stageName }));

    assert.ok(
      html.includes(`Now in ${escapedStageName}`) || html.includes(`Now in ${stageName}`),
      `Stage ${stepNum} header must say "Now in ${stageName}"`
    );
    assert.ok(html.includes(`Stage ${stepNum} of 9`), `Stage ${stepNum} must say "Stage ${stepNum} of 9"`);
    assert.ok(html.includes('animate-pulse'), `Stage ${stepNum} must have pulsing dot (animate-pulse)`);
    assert.ok(html.includes('ring-2 ring-primary ring-offset-1'), `Stage ${stepNum} must have active halo on active segment`);
  }
});

check('Stage 3 of 9 ("Cover Design") specifically renders pulsing dot, halo ring, and correct step counter', () => {
  const html = renderToStaticMarkup(React.createElement(ProductionStageBar, { stage: 'Cover Design' }));

  // Header assertions
  assert.ok(html.includes('Now in Cover Design'), 'Header must state "Now in Cover Design"');
  assert.ok(html.includes('Stage 3 of 9'), 'Header must state "Stage 3 of 9"');
  assert.ok(html.includes('w-2 h-2 rounded-full bg-primary animate-pulse'), 'Must render pulsing 8px primary dot');

  // Accessible role and label
  assert.ok(html.includes('role="img"'), 'Must have role="img"');
  assert.ok(
    html.includes('aria-label="Production progress. Current stage: Cover Design. Stage 3 of 9."'),
    'Must have complete aria-label'
  );

  // Active halo title on the 3rd segment
  assert.ok(html.includes('title="3. Cover Design: Active Stage"'), '3rd segment must have Active Stage title');
  assert.ok(html.includes('title="1. Manuscript: Completed"'), '1st segment must be Completed');
  assert.ok(html.includes('title="2. Editing: Completed"'), '2nd segment must be Completed');
  assert.ok(html.includes('title="4. Typesetting: Pending"'), '4th segment must be Pending');
  assert.ok(html.includes('title="9. Live: Pending"'), '9th segment must be Pending');
});

check('ProductionStageBar stage prefix normalization ("In Production - Cover Design" -> "Cover Design")', () => {
  const html = renderToStaticMarkup(
    React.createElement(ProductionStageBar, { stage: 'In Production - Cover Design' })
  );
  assert.ok(html.includes('Now in Cover Design'), 'Must normalize prefix and render "Now in Cover Design"');
  assert.ok(html.includes('Stage 3 of 9'), 'Must map to Stage 3 of 9');
});

check('ProductionStageBar case-insensitivity ("cover design" -> Stage 3)', () => {
  const html = renderToStaticMarkup(React.createElement(ProductionStageBar, { stage: 'cover design' }));
  assert.ok(html.includes('Now in Cover Design'));
  assert.ok(html.includes('Stage 3 of 9'));
});

check('ProductionStageBar fallback for null, undefined, and unknown stage', () => {
  const htmlNull = renderToStaticMarkup(React.createElement(ProductionStageBar, { stage: null }));
  assert.ok(htmlNull.includes('Now in Manuscript Received'));
  assert.ok(htmlNull.includes('Stage 1 of 9'));

  const htmlUndefined = renderToStaticMarkup(React.createElement(ProductionStageBar, {}));
  assert.ok(htmlUndefined.includes('Now in Manuscript Received'));
  assert.ok(htmlUndefined.includes('Stage 1 of 9'));

  const htmlUnknown = renderToStaticMarkup(React.createElement(ProductionStageBar, { stage: 'Cosmic Binding' }));
  assert.ok(htmlUnknown.includes('Now in Cosmic Binding'));
  assert.ok(htmlUnknown.includes('Stage 3 of 9'), 'Unknown stage gracefully defaults to Stage 3');
});

// =============================================================================
// SUITE 4: EDGE CASE CAPTIONS AND MERGED CELLS
// =============================================================================
console.log('\n--- SUITE 4: Edge Case Captions and Merged Cells ---');

check('BK002: Paid in full renders ₹0 in muted text with caption "Paid in full"', () => {
  const bk002 = mockDb.getBookByExternalId('BK002')!;
  assert.ok(bk002, 'BK002 must exist');
  assert.equal(bk002.royalty_pending, 0, 'Pending must be 0');
  assert.equal(bk002.royalty_paid, 7938, 'Paid must be 7938');

  // Desktop
  const desktopHtml = renderDesktopRow(bk002);
  assert.ok(desktopHtml.includes('₹0 Paid in full'), 'Desktop row must contain "₹0 Paid in full"');
  assert.ok(!desktopHtml.includes('Below the ₹1,000 minimum'), 'Must not display below minimum caption');

  // Mobile
  const mobileHtml = renderMobileCard(bk002);
  assert.ok(mobileHtml.includes('₹0 Paid in full'), 'Mobile card must contain "₹0 Paid in full"');
});

check('BK016: Sub-1000 rollover renders ₹850 with caption "Below the ₹1,000 minimum. Rolls over to the next quarter."', () => {
  const bk016 = mockDb.getBookByExternalId('BK016')!;
  assert.ok(bk016, 'BK016 must exist');
  assert.equal(bk016.royalty_pending, 850, 'Pending must be ₹850');
  assert.ok(bk016.royalty_pending < 1000, 'Pending must be < 1000');

  const desktopHtml = renderDesktopRow(bk016);
  assert.ok(desktopHtml.includes('₹850'), 'Must show ₹850');
  assert.ok(
    desktopHtml.includes('Below the ₹1,000 minimum. Rolls over to the next quarter.'),
    'Must show rollover caption'
  );
  assert.ok(!desktopHtml.includes('Paid in full'), 'Must NOT show Paid in full');

  const mobileHtml = renderMobileCard(bk016);
  assert.ok(mobileHtml.includes('₹850'));
  assert.ok(mobileHtml.includes('Below the ₹1,000 minimum. Rolls over to the next quarter.'));
});

check('BK010, BK016, BK018: Never paid out renders caption "No payout yet"', () => {
  for (const extId of ['BK010', 'BK016', 'BK018']) {
    const book = mockDb.getBookByExternalId(extId)!;
    assert.ok(book, `${extId} must exist`);
    assert.equal(book.royalty_paid, 0, `${extId} paid must be 0`);
    assert.equal(book.last_royalty_payout_date, null, `${extId} last payout date must be null`);

    const desktopHtml = renderDesktopRow(book);
    assert.ok(desktopHtml.includes('No payout yet'), `${extId} desktop must display "No payout yet"`);

    const mobileHtml = renderMobileCard(book);
    assert.ok(mobileHtml.includes('No payout yet'), `${extId} mobile must display "No payout yet"`);
  }
});

check('BK013, BK015: In-production merged cells and progress bar', () => {
  for (const extId of ['BK013', 'BK015']) {
    const book = mockDb.getBookByExternalId(extId)!;
    assert.ok(book, `${extId} must exist`);
    assert.equal(book.status, 'In production', `${extId} must have In production status`);
    assert.equal(book.mrp, null, `${extId} mrp must be null`);
    assert.equal(book.total_copies_sold, null, `${extId} sold must be null`);
    assert.equal(book.publication_date, null, `${extId} publication_date must be null`);
    assert.deepEqual(book.platforms, [], `${extId} platforms must be empty []`);

    // Desktop
    const desktopHtml = renderDesktopRow(book);
    assert.ok(desktopHtml.includes('Not set yet'), `${extId} MRP must display "Not set yet"`);
    assert.ok(desktopHtml.includes('—'), `${extId} Sold must display em-dash "—"`);
    assert.ok(desktopHtml.includes('Not published yet'), `${extId} date must display "Not published yet"`);
    assert.ok(
      desktopHtml.includes('Royalties start after publication.'),
      `${extId} royalty columns must be merged into "Royalties start after publication."`
    );
    assert.ok(desktopHtml.includes('Production progress. Current stage:'), `${extId} must embed ProductionStageBar`);
    assert.ok(
      desktopHtml.includes('Not listed on any platform yet.'),
      `${extId} unlisted platform must display "Not listed on any platform yet."`
    );

    // Mobile
    const mobileHtml = renderMobileCard(book);
    assert.ok(mobileHtml.includes('Not set yet'));
    assert.ok(mobileHtml.includes('—'));
    assert.ok(mobileHtml.includes('Not published yet'));
    assert.ok(mobileHtml.includes('Royalties start after publication.'));
  }
});

check('Typographic apostrophes in titles (BK017 Durga’s Daughters)', () => {
  const bk017 = mockDb.getBookByExternalId('BK017')!;
  assert.ok(bk017.title.includes('’'), 'BK017 must have curly apostrophe U+2019');
  const bk017Html = renderDesktopRow(bk017);
  assert.ok(bk017Html.includes('Durga’s Daughters'), 'BK017 HTML must retain Durga’s Daughters');
});

// =============================================================================
// SUITE 5: FORMATTER ROBUSTNESS & RENDERED MARKUP SCANNING
// =============================================================================
console.log('\n--- SUITE 5: Formatter Robustness & Rendered Markup Scanning ---');

check('formatINR rejects NaN, Infinity, -Infinity, null, undefined without producing "NaN" or "∞"', () => {
  assert.equal(formatINR(NaN), 'Not set yet');
  assert.equal(formatINR(Infinity), 'Not set yet');
  assert.equal(formatINR(-Infinity), 'Not set yet');
  assert.equal(formatINR(null), 'Not set yet');
  assert.equal(formatINR(undefined), 'Not set yet');
  assert.equal(formatINR(null, { missingText: '—' }), '—');
});

check('formatCount rejects NaN, null, undefined returning "—"', () => {
  assert.equal(formatCount(NaN), '—');
  assert.equal(formatCount(null), '—');
  assert.equal(formatCount(undefined), '—');
  assert.equal(formatCount(0), '0');
  assert.equal(formatCount(1450), '1,450');
});

check('formatDate handles valid dates, includeTime, and invalid inputs without double-space commas', () => {
  const d1 = formatDate('2023-06-20');
  assert.equal(d1, '20 Jun 2023');
  assert.ok(!d1.includes(',  '));

  const d2 = formatDate('2026-10-24T12:00:00Z', { includeTime: true });
  assert.ok(d2.includes(', '), `Must include comma-space: got '${d2}'`);
  assert.ok(!d2.includes(',  '), `Must NOT have double space: got '${d2}'`);

  const d3 = formatDate('not-a-valid-date');
  assert.equal(d3, 'Not published yet');
  assert.equal(formatDate(null), 'Not published yet');
  assert.equal(formatDate(undefined), 'Not published yet');
});

check('formatTicketId handles uppercase prefix, missing BL-, and whitespace-only strings', () => {
  assert.equal(formatTicketId('1042'), 'BL-1042');
  assert.equal(formatTicketId('bl-1042'), 'BL-1042');
  assert.equal(formatTicketId('BL1042'), 'BL-1042');
  assert.equal(formatTicketId('   '), '');
  assert.equal(formatTicketId(''), '');
});

check('Markup scan: Render all SEED_BOOKS in desktop table and mobile cards — confirm ZERO NaN or double space artifacts', () => {
  const allBooks = mockDb.getAllBooks();
  assert.equal(allBooks.length, 18, 'Must have 18 seed books');

  for (const book of allBooks) {
    const dHtml = renderDesktopRow(book);
    const mHtml = renderMobileCard(book);

    for (const [name, html] of [['desktop', dHtml], ['mobile', mHtml]]) {
      assert.ok(!html.includes('NaN'), `Book ${book.external_id} (${name}) markup contains "NaN"!`);
      assert.ok(!html.includes('₹NaN'), `Book ${book.external_id} (${name}) markup contains "₹NaN"!`);
      assert.ok(!html.includes(',  '), `Book ${book.external_id} (${name}) markup contains double space comma ",  "!`);
      assert.ok(!html.includes('undefined'), `Book ${book.external_id} (${name}) markup contains literal "undefined"!`);
      assert.ok(!html.includes('[object Object]'), `Book ${book.external_id} (${name}) markup contains "[object Object]"!`);
    }
  }
});

check('Markup scan: Render summary bands for all SEED_USERS — confirm ZERO NaN or double space artifacts', () => {
  for (const user of SEED_USERS) {
    const books = mockDb.getBooksByAuthor(user.id);
    const summaryHtml = renderSummaryBand(books);

    assert.ok(!summaryHtml.includes('NaN'), `User ${user.id} summary band contains "NaN"!`);
    assert.ok(!summaryHtml.includes('₹NaN'), `User ${user.id} summary band contains "₹NaN"!`);
    assert.ok(!summaryHtml.includes('undefined'), `User ${user.id} summary band contains "undefined"!`);
    assert.ok(!summaryHtml.includes('[object Object]'), `User ${user.id} summary band contains "[object Object]"!`);
    assert.ok(!summaryHtml.includes(',  '), `User ${user.id} summary band contains double-space comma!`);
  }
});

// =============================================================================
// SUMMARY REPORT
// =============================================================================
console.log('\n================================================================');
console.log(`TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED (TOTAL: ${passCount + failCount})`);
console.log('================================================================\n');

if (failCount > 0) {
  console.error('FAILURES DETECTED:');
  console.table(findings);
  process.exit(1);
} else {
  console.log('✓ All adversarial tests passed with 100% success rate!');
  process.exit(0);
}
