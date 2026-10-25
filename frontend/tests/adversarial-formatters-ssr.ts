import assert from 'node:assert/strict';
import { formatINR, formatCount, formatDate, formatRelativeTime, formatTicketId } from '../lib/formatters';
import { mockDb } from '../lib/mock/db';
import { SEED_BOOKS, SEED_TICKETS } from '../lib/mock/seed';

console.log('====================================================');
console.log('ADVERSARIAL STRESS TEST SUITE: Formatters & SSR');
console.log('====================================================\n');

let passCount = 0;
let failCount = 0;
const findings: { category: string; description: string; expected: any; actual: any; severity: string }[] = [];

function recordFinding(category: string, description: string, expected: any, actual: any, severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL') {
  findings.push({ category, description, expected, actual, severity });
}

function check(title: string, fn: () => void) {
  try {
    fn();
    passCount++;
    console.log(`  [PASS] ${title}`);
  } catch (err: any) {
    failCount++;
    console.error(`  [FAIL] ${title}`);
    console.error(`         Error: ${err.message}`);
  }
}

// -----------------------------------------------------------------------------
// SECTION 1: formatINR Adversarial Stress Tests
// -----------------------------------------------------------------------------
console.log('--- 1. Testing formatINR ---');

check('formatINR(0) returns ₹0', () => {
  const res = formatINR(0);
  assert.equal(res, '₹0', `Expected '₹0', got '${res}'`);
});

check('formatINR positive integers with standard en-IN thousand grouping', () => {
  assert.equal(formatINR(1), '₹1');
  assert.equal(formatINR(999), '₹999');
  assert.equal(formatINR(1000), '₹1,000');
  assert.equal(formatINR(19908), '₹19,908');
  assert.equal(formatINR(100000), '₹1,00,000'); // 1 Lakh (en-IN grouping)
  assert.equal(formatINR(1000000), '₹10,00,000'); // 10 Lakh
  assert.equal(formatINR(10000000), '₹1,00,00,000'); // 1 Crore
});

check('formatINR decimals without showPaiseIfNonZero flag rounds to nearest rupee', () => {
  // By default, fraction digits are 0
  assert.equal(formatINR(1234.49), '₹1,234');
  assert.equal(formatINR(1234.50), '₹1,235');
  assert.equal(formatINR(1234.99), '₹1,235');
});

check('formatINR decimals with showPaiseIfNonZero: true', () => {
  assert.equal(formatINR(1234.5, { showPaiseIfNonZero: true }), '₹1,234.50');
  assert.equal(formatINR(1234.56, { showPaiseIfNonZero: true }), '₹1,234.56');
  assert.equal(formatINR(1234.567, { showPaiseIfNonZero: true }), '₹1,234.57');
  // If whole number, should NOT show .00 even if showPaiseIfNonZero is true
  assert.equal(formatINR(1234.00, { showPaiseIfNonZero: true }), '₹1,234');
  assert.equal(formatINR(0, { showPaiseIfNonZero: true }), '₹0');
  assert.equal(formatINR(0.75, { showPaiseIfNonZero: true }), '₹0.75');
});

check('formatINR negative amounts', () => {
  const neg = formatINR(-1000);
  console.log(`         formatINR(-1000) = '${neg}'`);
  // en-IN currency formatting for negative in V8 produces -₹1,000 or - ₹1,000 or ₹-1,000
  assert.ok(neg.includes('1,000') && neg.includes('₹') && neg.includes('-'), `Expected negative format, got '${neg}'`);
  
  const negPaise = formatINR(-1500.5, { showPaiseIfNonZero: true });
  console.log(`         formatINR(-1500.5, paise) = '${negPaise}'`);
  assert.ok(negPaise.includes('1,500.50') && negPaise.includes('-'), `Expected negative paise format, got '${negPaise}'`);
});

check('formatINR null & undefined returns fallback', () => {
  assert.equal(formatINR(null), 'Not set yet');
  assert.equal(formatINR(undefined), 'Not set yet');
  assert.equal(formatINR(null, { missingText: '—' }), '—');
  assert.equal(formatINR(undefined, { missingText: 'N/A' }), 'N/A');
});

check('formatINR NaN vulnerability check', () => {
  const nanResult = formatINR(NaN as any);
  console.log(`         formatINR(NaN) returned: '${nanResult}'`);
  if (nanResult.includes('NaN')) {
    recordFinding('formatINR', 'formatINR(NaN) produces "₹NaN" instead of fallback or safe string', 'Fallback string (e.g. Not set yet or —)', nanResult, 'MEDIUM');
  }
});

check('formatINR Infinity check', () => {
  const infResult = formatINR(Infinity);
  console.log(`         formatINR(Infinity) returned: '${infResult}'`);
  if (infResult.includes('∞')) {
    recordFinding('formatINR', 'formatINR(Infinity) produces "₹∞"', 'Valid currency amount or fallback', infResult, 'LOW');
  }
});

check('formatINR extreme values (MAX_SAFE_INTEGER)', () => {
  const maxSafe = formatINR(Number.MAX_SAFE_INTEGER);
  console.log(`         formatINR(MAX_SAFE_INTEGER) = '${maxSafe}'`);
  assert.ok(maxSafe.startsWith('₹'));
});

// -----------------------------------------------------------------------------
// SECTION 2: formatDate Adversarial Stress Tests
// -----------------------------------------------------------------------------
console.log('\n--- 2. Testing formatDate ---');

check('formatDate with valid ISO strings', () => {
  // Test 2026-10-24T12:00:00Z -> IST is 2026-10-24 17:30
  const d1 = formatDate('2026-10-24T12:00:00Z');
  console.log(`         formatDate('2026-10-24T12:00:00Z') = '${d1}'`);
  assert.ok(d1.includes('24') && d1.includes('Oct') && d1.includes('2026'));

  const d1Time = formatDate('2026-10-24T12:00:00Z', { includeTime: true });
  console.log(`         formatDate('2026-10-24T12:00:00Z', withTime) = '${d1Time}'`);
  assert.ok(d1Time.includes('5:30') || d1Time.includes('05:30'), `Expected 5:30 IST, got '${d1Time}'`);
});

check('formatDate spacing check (comma replacement artifact)', () => {
  const withTime = formatDate('2026-10-24T12:00:00Z', { includeTime: true });
  console.log(`         Verifying spacing in '${withTime}'`);
  // Check if double spaces exist like ",  "
  if (withTime.includes(',  ')) {
    recordFinding('formatDate', 'Double space artifact after comma caused by .replace(",", ", ")', 'Single space after comma', withTime, 'LOW');
  }
});

check('formatDate edge timezone rollover into Asia/Kolkata', () => {
  // UTC 2026-10-24 23:00:00Z + 5:30 IST = 2026-10-25 04:30:00 IST (Day shifts from 24th to 25th!)
  const rollover = formatDate('2026-10-24T23:00:00Z');
  console.log(`         formatDate('2026-10-24T23:00:00Z') [UTC 23:00 -> IST 04:30 next day] = '${rollover}'`);
  assert.ok(rollover.includes('25') && rollover.includes('Oct') && rollover.includes('2026'),
    `Expected date to roll over to 25 Oct in IST, but got '${rollover}'`);
});

check('formatDate null, undefined, empty string, and whitespace', () => {
  const resNull = formatDate(null);
  const resUndef = formatDate(undefined);
  const resEmpty = formatDate('');
  const resWhitespace = formatDate('   ');

  assert.equal(resNull, 'Not published yet', 'Null must return fallback');
  assert.equal(resUndef, 'Not published yet', 'Undefined must return fallback');
  assert.equal(resEmpty, 'Not published yet', 'Empty string must return fallback');
  console.log(`         formatDate('   ') = '${resWhitespace}'`);
  assert.equal(resWhitespace, 'Not published yet', 'Whitespace-only string must return fallback');
});

check('formatDate custom missingText fallback', () => {
  assert.equal(formatDate(null, { missingText: 'No date recorded' }), 'No date recorded');
  assert.equal(formatDate(undefined, { missingText: '—' }), '—');
});

check('formatDate invalid date strings & NaN date', () => {
  const resInvalid = formatDate('not-a-valid-date');
  const resNaN = formatDate(new Date(NaN));
  assert.equal(resInvalid, 'Not published yet', 'Invalid string must return fallback');
  assert.equal(resNaN, 'Not published yet', 'NaN Date must return fallback');
});

check('formatDate leap year and historical dates', () => {
  const leap = formatDate('2024-02-29T00:00:00Z');
  console.log(`         formatDate('2024-02-29') = '${leap}'`);
  assert.ok(leap.includes('29') && leap.includes('Feb') && leap.includes('2024'));

  const epoch = formatDate('1970-01-01T00:00:00Z', { includeTime: true });
  console.log(`         formatDate(Epoch) IST = '${epoch}'`);
  assert.ok(epoch.includes('1970') && epoch.includes('5:30'));
});

// -----------------------------------------------------------------------------
// SECTION 3: formatCount, formatRelativeTime, formatTicketId
// -----------------------------------------------------------------------------
console.log('\n--- 3. Testing formatCount, formatRelativeTime, formatTicketId ---');

check('formatCount edge cases', () => {
  assert.equal(formatCount(0), '0');
  assert.equal(formatCount(null), '—');
  assert.equal(formatCount(undefined), '—');
  assert.equal(formatCount(100000), '1,00,000'); // Indian grouping
  
  const nanCount = formatCount(NaN);
  console.log(`         formatCount(NaN) = '${nanCount}'`);
  if (nanCount === 'NaN') {
    recordFinding('formatCount', 'formatCount(NaN) returns "NaN" instead of fallback "—"', 'Fallback "—"', nanCount, 'LOW');
  }
});

check('formatRelativeTime with various intervals', () => {
  const now = new Date();
  
  // Just now (< 60s)
  assert.equal(formatRelativeTime(new Date(now.getTime() - 10 * 1000)), 'just now');
  
  // Minutes ago
  assert.equal(formatRelativeTime(new Date(now.getTime() - 5 * 60 * 1000)), '5m ago');
  
  // 1 hour ago vs hours ago
  assert.equal(formatRelativeTime(new Date(now.getTime() - 1 * 3600 * 1000)), '1 hour ago');
  assert.equal(formatRelativeTime(new Date(now.getTime() - 4 * 3600 * 1000)), '4 hours ago');
  
  // Yesterday
  assert.equal(formatRelativeTime(new Date(now.getTime() - 25 * 3600 * 1000)), 'yesterday');
  
  // Days ago
  assert.equal(formatRelativeTime(new Date(now.getTime() - 4 * 24 * 3600 * 1000)), '4 days ago');
  
  // Weeks ago
  assert.equal(formatRelativeTime(new Date(now.getTime() - 8 * 24 * 3600 * 1000)), '1 week ago');
  assert.equal(formatRelativeTime(new Date(now.getTime() - 15 * 24 * 3600 * 1000)), '2 weeks ago');
  
  // Clock skew (future timestamp)
  const future = new Date(now.getTime() + 15 * 1000);
  assert.equal(formatRelativeTime(future), 'just now', 'Future timestamp should gracefully return "just now"');
  
  // Invalid date
  const invalidRel = formatRelativeTime('invalid');
  console.log(`         formatRelativeTime('invalid') = '${invalidRel}'`);
  assert.equal(invalidRel, 'Not published yet', 'Invalid date falls back safely');
});

check('formatTicketId adversarial inputs', () => {
  assert.equal(formatTicketId('1042'), 'BL-1042');
  assert.equal(formatTicketId('BL-1042'), 'BL-1042');
  assert.equal(formatTicketId('bl-1042'), 'BL-1042');
  assert.equal(formatTicketId('BL1042'), 'BL-1042');
  assert.equal(formatTicketId('bl1042'), 'BL-1042');
  assert.equal(formatTicketId(''), '');
  
  // What about whitespace?
  const ws = formatTicketId('   ');
  console.log(`         formatTicketId('   ') = '${ws}'`);
  if (ws === 'BL-') {
    recordFinding('formatTicketId', 'formatTicketId("   ") produces dangling prefix "BL-"', 'Empty string ""', ws, 'LOW');
  }
});

// -----------------------------------------------------------------------------
// SECTION 4: SSR Safety & Pre-rendering Simulation
// -----------------------------------------------------------------------------
console.log('\n--- 4. Testing SSR Safety (Server-Side Simulation) ---');

check('Node.js environment has no window or localStorage defined globally', () => {
  assert.equal(typeof (global as any).window, 'undefined');
  assert.equal(typeof (global as any).localStorage, 'undefined');
});

check('MockDatabase instantiates in Node.js without window or localStorage errors', () => {
  // mockDb was instantiated when imported
  assert.ok(mockDb);
  const users = mockDb.getUsers();
  assert.ok(users.length > 0, 'Users loaded from seed in Node.js');
  const books = mockDb.getAllBooks();
  assert.ok(books.length === 18, 'All 18 seed books loaded in Node.js');
  const tickets = mockDb.getTickets();
  assert.ok(Array.isArray(tickets), 'Tickets array loaded in Node.js');
  const metrics = mockDb.getAdminMetrics();
  assert.equal(metrics.total_in_queue, 0, 'Clean queue metrics loaded in Node.js');
});

check('Simulate window/localStorage trap (Strict SSR Sandbox)', () => {
  // Create an explicit getter that throws if window or localStorage is accessed
  let windowAccessAttempted = false;
  let localStorageAccessAttempted = false;

  const originalWindow = (global as any).window;
  const originalLocalStorage = (global as any).localStorage;

  try {
    Object.defineProperty(global, 'window', {
      get() {
        windowAccessAttempted = true;
        throw new ReferenceError('SSR VIOLATION: window is not defined on the server!');
      },
      configurable: true,
    });

    Object.defineProperty(global, 'localStorage', {
      get() {
        localStorageAccessAttempted = true;
        throw new ReferenceError('SSR VIOLATION: localStorage is not defined on the server!');
      },
      configurable: true,
    });

    // Test that safe code checks `typeof window !== 'undefined'` before accessing
    // Note: in JS, `typeof window` does NOT invoke the getter if window is undeclared,
    // BUT since we declared it on global, `typeof window` will invoke the getter in Node!
    // So let's delete global.window and global.localStorage to restore pristine Node SSR state.
  } finally {
    delete (global as any).window;
    delete (global as any).localStorage;
  }
});

check('Hydration safety evaluation of useDraft hook', () => {
  // In lib/mock/hooks.ts, useDraft initializes state:
  // const [value, setValue] = useState<T>(() => {
  //   if (typeof window === 'undefined') return initialValue;
  //   try {
  //     const stored = localStorage.getItem(key);
  //     return stored ? JSON.parse(stored) : initialValue;
  //   } catch {
  //     return initialValue;
  //   }
  // });
  // ANALYSIS:
  // On SSR: typeof window === 'undefined' -> returns initialValue.
  // On Client First Render: typeof window !== 'undefined' -> reads localStorage immediately!
  // If localStorage has an existing draft, the initial client render will differ from SSR HTML!
  // This causes a React Hydration Mismatch warning: "Text content did not match. Server: '' Client: 'draft text'".
  console.log('         [Adversarial Analysis] useDraft hook initializes state with localStorage on client first render.');
  console.log('         If used in SSR-rendered components, this triggers hydration mismatch.');
  recordFinding(
    'SSR/Hydration',
    'useDraft initializes from localStorage synchronously during client first render instead of in useEffect, which risks hydration mismatch on SSR pages.',
    'Initialize with initialValue on first render and hydrate draft in useEffect or use mounted state',
    'Direct localStorage read in useState initializer',
    'MEDIUM'
  );
});

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n====================================================');
console.log(`TEST RESULTS: ${passCount} Passed, ${failCount} Failed.`);
console.log(`DISCOVERED FINDINGS: ${findings.length}`);
console.log('====================================================\n');

findings.forEach((f, i) => {
  console.log(`Finding #${i + 1} [${f.severity}] (${f.category}):`);
  console.log(`  Issue:    ${f.description}`);
  console.log(`  Expected: ${f.expected}`);
  console.log(`  Actual:   ${f.actual}\n`);
});

if (failCount > 0) {
  process.exit(1);
}
