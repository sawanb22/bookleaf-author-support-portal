import assert from 'node:assert/strict';
import { MockDatabase } from '../lib/mock/db';
import { SEED_BOOKS, SEED_TICKETS, SEED_USERS, INITIAL_ADMIN_METRICS } from '../lib/mock/seed';
import { formatINR, formatCount, formatDate, formatTicketId, formatRelativeTime } from '../lib/formatters';

console.log('================================================================');
console.log('  MILESTONE 1 ADVERSARIAL STRESS TEST SUITE (CHALLENGER 1)      ');
console.log('================================================================\n');

let passCount = 0;
let failCount = 0;
interface Finding {
  name: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  expected: string;
  actual: string;
  implication: string;
}
const findings: Finding[] = [];

function test(name: string, category: string, fn: () => void) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passCount++;
  } catch (err: any) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    failCount++;
    findings.push({
      name,
      severity: 'HIGH',
      category,
      expected: 'Assertion to pass cleanly',
      actual: err.message,
      implication: err.stack || err.message,
    });
  }
}

// Mock localStorage engine for Node environment testing
class MockLocalStorage {
  public store: Map<string, string> = new Map();
  public shouldThrowOnGet: boolean = false;
  public shouldThrowOnSet: boolean = false;

  getItem(key: string): string | null {
    if (this.shouldThrowOnGet) throw new Error('SecurityError: localStorage is disabled');
    return this.store.get(key) || null;
  }

  setItem(key: string, value: string): void {
    if (this.shouldThrowOnSet) throw new Error('DOMException: QuotaExceededError');
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

// ============================================================================
// SUITE 1: MATHEMATICAL & DATA MODEL INVARIANTS ACROSS ALL ENTITIES
// ============================================================================
console.log('--- SUITE 1: Mathematical & Data Invariants ---');

test('1.1 Priya Sharma Royalties Invariant (Earned = Paid + Pending)', 'Invariants', () => {
  const db = new MockDatabase();
  const summary = db.getAuthorRoyaltySummary('author_priya');
  assert.equal(summary.earned, 19908, 'Priya Sharma earned must be 19,908');
  assert.equal(summary.paid, 16338, 'Priya Sharma paid must be 16,338');
  assert.equal(summary.pending, 3570, 'Priya Sharma pending must be 3,570');
  assert.equal(summary.paid + summary.pending, summary.earned, 'Paid + Pending must equal Earned');
});

test('1.2 Invariant Check: Earned = Paid + Pending for ALL Authors', 'Invariants', () => {
  const db = new MockDatabase();
  for (const user of SEED_USERS) {
    if (user.role === 'author') {
      const summary = db.getAuthorRoyaltySummary(user.id);
      assert.ok(summary.earned >= 0, `Author ${user.name} earned must be >= 0`);
      assert.ok(summary.paid >= 0, `Author ${user.name} paid must be >= 0`);
      assert.ok(summary.pending >= 0, `Author ${user.name} pending must be >= 0`);
      assert.equal(
        summary.paid + summary.pending,
        summary.earned,
        `Author ${user.name} (${user.id}) invariant failed: paid (${summary.paid}) + pending (${summary.pending}) != earned (${summary.earned})`
      );
    }
  }
});

test('1.3 Invariant Check: Earned = Paid + Pending for ALL 18 Books', 'Invariants', () => {
  assert.equal(SEED_BOOKS.length, 18, 'There must be exactly 18 seed books (BK001-BK018)');
  for (const book of SEED_BOOKS) {
    assert.equal(
      book.royalty_paid + book.royalty_pending,
      book.total_royalty_earned,
      `Book ${book.external_id} (${book.title}) invariant failed: paid (${book.royalty_paid}) + pending (${book.royalty_pending}) != earned (${book.total_royalty_earned})`
    );

    if (book.status === 'In production') {
      assert.equal(book.total_royalty_earned, 0, `In production book ${book.external_id} earned must be 0`);
      assert.equal(book.royalty_paid, 0, `In production book ${book.external_id} paid must be 0`);
      assert.equal(book.royalty_pending, 0, `In production book ${book.external_id} pending must be 0`);
      assert.equal(book.publication_date, null, `In production book ${book.external_id} pub date must be null`);
      assert.equal(book.mrp, null, `In production book ${book.external_id} mrp must be null`);
    }

    if (book.status === 'Published & Live') {
      assert.ok(book.mrp && book.mrp > 0, `Published book ${book.external_id} must have positive mrp`);
      assert.ok(book.publication_date !== null, `Published book ${book.external_id} must have publication_date`);
    }
  }
});

test('1.4 Referential Integrity: Books -> Authors', 'Invariants', () => {
  const userIds = new Set(SEED_USERS.map((u) => u.id));
  for (const book of SEED_BOOKS) {
    assert.ok(userIds.has(book.author_id), `Book ${book.external_id} references missing author_id: ${book.author_id}`);
  }
});

test('1.5 Referential Integrity: Tickets -> Authors and Books', 'Invariants', () => {
  const userIds = new Set(SEED_USERS.map((u) => u.id));
  const bookExternalIds = new Set(SEED_BOOKS.map((b) => b.external_id));

  for (const ticket of SEED_TICKETS) {
    assert.ok(userIds.has(ticket.author_id), `Ticket ${ticket.id} references missing author_id: ${ticket.author_id}`);
    if (ticket.book_id) {
      assert.ok(bookExternalIds.has(ticket.book_id), `Ticket ${ticket.id} references missing book_id: ${ticket.book_id}`);
    }
    // Verify messages
    for (const msg of ticket.messages || []) {
      assert.ok(msg.id, `Ticket ${ticket.id} has message with missing ID`);
      assert.ok(msg.sender_name, `Ticket ${ticket.id} message ${msg.id} missing sender_name`);
      assert.ok(msg.body, `Ticket ${ticket.id} message ${msg.id} missing body`);
      assert.ok(msg.created_at, `Ticket ${ticket.id} message ${msg.id} missing created_at`);
    }
  }
});

test('1.6 Non-existent Author Royalty Summary Returns Zeros', 'Invariants', () => {
  const db = new MockDatabase();
  const summary = db.getAuthorRoyaltySummary('non_existent_author_999');
  assert.deepEqual(summary, { earned: 0, paid: 0, pending: 0 });
});

// ============================================================================
// SUITE 2: IDEMPOTENCY PROTECTION STRESS
// ============================================================================
console.log('\n--- SUITE 2: Idempotency Protection ---');

test('2.1 Duplicate Ticket Creation with Identical Idempotency Key', 'Idempotency', () => {
  const db = new MockDatabase();
  const initialTicketCount = db.getTickets().length;
  const initialQueueMetric = db.getAdminMetrics().total_in_queue;
  const initialNeedsReplyMetric = db.getAdminMetrics().needs_first_reply;

  const input = {
    author_id: 'author_priya',
    book_id: 'BK001',
    subject: 'Duplicate Test Subject',
    description: 'Duplicate Test Description',
    category: 'Royalty & Payments',
  };

  const key = 'idem-ticket-test-1';
  const ticket1 = db.createTicket(input, key);
  assert.ok(ticket1.id, 'First call must create ticket');

  // Second call with identical key
  const ticket2 = db.createTicket(
    { ...input, subject: 'Modified Subject That Should Be Ignored' },
    key
  );

  assert.equal(ticket1.id, ticket2.id, 'Second call must return existing ticket');
  assert.equal(ticket2.subject, 'Duplicate Test Subject', 'Original ticket subject must be preserved');
  assert.equal(db.getTickets().length, initialTicketCount + 1, 'Ticket count must increase by exactly 1');
  assert.equal(db.getAdminMetrics().total_in_queue, initialQueueMetric + 1, 'total_in_queue must increase by exactly 1');
  assert.equal(db.getAdminMetrics().needs_first_reply, initialNeedsReplyMetric + 1, 'needs_first_reply must increase by exactly 1');
});

test('2.2 Duplicate Message Addition with Identical Idempotency Key', 'Idempotency', () => {
  const db = new MockDatabase();
  const ticket = db.getTicket('BL-1048')!;
  assert.ok(ticket, 'BL-1048 must exist');
  const initialMsgCount = ticket.messages?.length || 0;

  const key = 'idem-msg-test-1';
  const msg1 = db.addMessage(
    ticket.id,
    {
      sender_name: 'Priya Sharma',
      sender_role: 'author',
      body: 'Original Follow-up Message',
    },
    key
  );

  const msg2 = db.addMessage(
    ticket.id,
    {
      sender_name: 'Priya Sharma',
      sender_role: 'author',
      body: 'Duplicate Message with different text',
    },
    key
  );

  assert.equal(msg1.id, msg2.id, 'Duplicate addMessage must return same message');
  assert.equal(msg2.body, 'Original Follow-up Message', 'Original message body must be preserved');
  assert.equal(ticket.messages?.length, initialMsgCount + 1, 'Messages count must increase by exactly 1');
});

test('2.3 Support Message Idempotency: Metric and Status Deduplication', 'Idempotency', () => {
  const db = new MockDatabase();
  // Create an Open ticket
  const ticket = db.createTicket({
    author_id: 'author_priya',
    book_id: 'BK001',
    subject: 'Metric Dedup Test',
    description: 'Testing metric deduplication',
  });

  assert.equal(ticket.status, 'Open');
  const needsReplyBefore = db.getAdminMetrics().needs_first_reply;

  const key = 'idem-support-reply-1';
  const msg1 = db.addMessage(
    ticket.id,
    {
      sender_name: 'Rahul',
      sender_role: 'support',
      body: 'Official response from support',
    },
    key
  );

  assert.equal(ticket.status, 'In progress', 'Status must transition to In progress on support reply');
  assert.equal(db.getAdminMetrics().needs_first_reply, needsReplyBefore - 1, 'needs_first_reply must decrement by 1');

  // Retry with same idempotency key
  const msg2 = db.addMessage(
    ticket.id,
    {
      sender_name: 'Rahul',
      sender_role: 'support',
      body: 'Official response duplicate',
    },
    key
  );

  assert.equal(msg1.id, msg2.id);
  assert.equal(db.getAdminMetrics().needs_first_reply, needsReplyBefore - 1, 'needs_first_reply must NOT decrement a second time');
});

test('2.4 Missing or Empty Idempotency Key Allows Normal Multiple Submissions', 'Idempotency', () => {
  const db = new MockDatabase();
  const countBefore = db.getTickets().length;

  const input = {
    author_id: 'author_priya',
    book_id: 'BK001',
    subject: 'Normal Ticket Without Key',
    description: 'Description',
  };

  const t1 = db.createTicket(input);
  const t2 = db.createTicket(input);

  assert.notEqual(t1.id, t2.id, 'Distinct tickets must be created when idempotency key is omitted');
  assert.equal(db.getTickets().length, countBefore + 2);
});

test('2.5 Cross-Entity Key Collision (Key reused across createTicket and addMessage)', 'Idempotency', () => {
  const db = new MockDatabase();
  const sharedKey = 'collision-key-1';

  // 1. Create ticket with sharedKey
  const ticket1 = db.createTicket(
    {
      author_id: 'author_priya',
      book_id: null,
      subject: 'Shared Key Ticket',
      description: 'Desc',
    },
    sharedKey
  );

  // 2. Now attempt to add a message to BL-1042 using that same key
  const msg = db.addMessage(
    'BL-1042',
    {
      sender_name: 'Author',
      sender_role: 'author',
      body: 'Message hijacking key',
    },
    sharedKey
  );

  // 3. What happens if ticket creation is retried with sharedKey?
  const ticketRetry = db.createTicket(
    {
      author_id: 'author_priya',
      book_id: null,
      subject: 'Shared Key Ticket Retry',
      description: 'Desc',
    },
    sharedKey
  );

  // If the key namespace was shared and overwritten, ticketRetry might have created a NEW ticket instead of returning ticket1!
  if (ticketRetry.id !== ticket1.id) {
    throw new Error(
      `Cross-entity key collision detected: addMessage overwrote createTicket idempotency key '${sharedKey}', causing duplicate ticket ${ticketRetry.id} instead of returning ${ticket1.id}`
    );
  }
});

// ============================================================================
// SUITE 3: SUBSCRIBER REACTIVITY
// ============================================================================
console.log('\n--- SUITE 3: Subscriber Reactivity ---');

test('3.1 Architecture Flaw: Subscribers Do NOT Fire Synchronously in SSR / Node (window undefined)', 'Reactivity', () => {
  // In Node environment, typeof window === 'undefined'
  const db = new MockDatabase();
  let fired = false;

  db.subscribe(() => {
    fired = true;
  });

  db.createTicket({
    author_id: 'author_priya',
    book_id: null,
    subject: 'SSR Reactivity Test',
    description: 'Desc',
  });

  // Because db.ts line 55 returns early: if (typeof window === 'undefined') return;
  // notify() is never called!
  if (!fired) {
    throw new Error(
      'Defect confirmed: mockDb.persist() returns early when typeof window === "undefined" before calling this.notify(). In-memory subscribers receive NO updates in SSR or Node environments!'
    );
  }
});

test('3.2 Browser Environment: Subscribers Fire Synchronously on All Mutations', 'Reactivity', () => {
  const mockStorage = new MockLocalStorage();
  (global as any).window = {};
  (global as any).localStorage = mockStorage;

  try {
    const db = new MockDatabase();
    let callCount = 0;

    const unsubscribe = db.subscribe(() => {
      callCount++;
    });

    db.createTicket({
      author_id: 'author_priya',
      book_id: null,
      subject: 'Sub Test',
      description: 'Sub Test Desc',
    });
    assert.equal(callCount, 1, 'createTicket must trigger subscriber');

    db.addMessage('BL-1048', {
      sender_name: 'Rahul',
      sender_role: 'support',
      body: 'Test reply',
    });
    assert.equal(callCount, 2, 'addMessage must trigger subscriber');

    db.assignTicket('BL-1048', 'Rahul');
    assert.equal(callCount, 3, 'assignTicket must trigger subscriber');

    db.updateTicketStatus('BL-1048', 'Resolved');
    assert.equal(callCount, 4, 'updateTicketStatus must trigger subscriber');

    // BL-1055 has has_unread: true in seed
    assert.equal(db.getTicket('BL-1055')!.has_unread, true);
    db.markTicketRead('BL-1055');
    assert.equal(callCount, 5, 'markTicketRead must trigger subscriber when has_unread transitions from true to false');

    db.resetToSeed();
    assert.equal(callCount, 6, 'resetToSeed must trigger subscriber');

    unsubscribe();
    db.createTicket({
      author_id: 'author_priya',
      book_id: null,
      subject: 'Post unsubscribe',
      description: 'Desc',
    });
    assert.equal(callCount, 6, 'Unsubscribed listener must NOT be called');
  } finally {
    delete (global as any).window;
    delete (global as any).localStorage;
  }
});

test('3.3 Subscriber Error Isolation in Browser Environment', 'Reactivity', () => {
  const mockStorage = new MockLocalStorage();
  (global as any).window = {};
  (global as any).localStorage = mockStorage;

  try {
    const db = new MockDatabase();
    let secondListenerCalled = false;

    db.subscribe(() => {
      throw new Error('Subscriber 1 threw error intentionally');
    });

    db.subscribe(() => {
      secondListenerCalled = true;
    });

    db.createTicket({
      author_id: 'author_priya',
      book_id: null,
      subject: 'Error isolation test',
      description: 'Desc',
    });

    assert.equal(secondListenerCalled, true, 'Second listener must still fire even if first listener throws');
  } finally {
    delete (global as any).window;
    delete (global as any).localStorage;
  }
});

test('3.4 Re-entrant Subscriber Mutation Safety', 'Reactivity', () => {
  const mockStorage = new MockLocalStorage();
  (global as any).window = {};
  (global as any).localStorage = mockStorage;

  try {
    const db = new MockDatabase();
    let recursionDepth = 0;
    const maxSafeDepth = 10;

    // A listener that triggers a mutation inside itself
    const unsubscribe = db.subscribe(() => {
      recursionDepth++;
      if (recursionDepth < maxSafeDepth) {
        db.assignTicket('BL-1042', `Assignee_${recursionDepth}`);
      }
    });

    db.assignTicket('BL-1042', 'Initial');
    unsubscribe();

    // If recursion depth hit maxSafeDepth, re-entrant mutations cause cascading nested notifies
    if (recursionDepth >= maxSafeDepth) {
      console.warn(`[WARNING] Re-entrant mutations trigger nested synchronous notifies (depth reached ${recursionDepth})`);
    }
  } finally {
    delete (global as any).window;
    delete (global as any).localStorage;
  }
});

// ============================================================================
// SUITE 4: LOCALSTORAGE EMULATION, CORRUPTION RESILIENCE & SSR SAFETY
// ============================================================================
console.log('\n--- SUITE 4: Corrupted, Partial & Hostile LocalStorage ---');

test('4.1 Malformed JSON in LocalStorage DB Store Recovers to Seed Gracefully', 'Storage', () => {
  const mockStorage = new MockLocalStorage();
  mockStorage.setItem('bookleaf_db_store_v1', 'CORRUPT_NOT_JSON_{{[[}}');

  (global as any).window = {};
  (global as any).localStorage = mockStorage;

  try {
    const db = new MockDatabase();
    assert.equal(db.getAllBooks().length, 18, 'Must recover 18 seed books when stored JSON is corrupt');
    assert.ok(db.getTickets().length >= 18, 'Must recover seed tickets');
    assert.equal(db.getUsers().length, 16, 'Must recover 16 seed users');
  } finally {
    delete (global as any).window;
    delete (global as any).localStorage;
  }
});

test('4.2 Non-Object Valid JSON in LocalStorage (null, array, string, number)', 'Storage', () => {
  const edgeCases = ['null', '12345', '"a plain string"', '[1, 2, 3]'];

  for (const edgeJson of edgeCases) {
    const mockStorage = new MockLocalStorage();
    mockStorage.setItem('bookleaf_db_store_v1', edgeJson);

    (global as any).window = {};
    (global as any).localStorage = mockStorage;

    try {
      const db = new MockDatabase();
      assert.ok(db.getAllBooks().length > 0, `DB must initialize valid books for input: ${edgeJson}`);
      assert.ok(db.getTickets().length > 0, `DB must initialize valid tickets for input: ${edgeJson}`);
    } finally {
      delete (global as any).window;
      delete (global as any).localStorage;
    }
  }
});

test('4.3 Corrupted Non-Array Users in LocalStorage Crashes getUserById', 'Storage', () => {
  const mockStorage = new MockLocalStorage();
  // Valid JSON, but users is a string instead of an array
  mockStorage.setItem('bookleaf_db_store_v1', JSON.stringify({ users: 'invalid_string' }));

  (global as any).window = {};
  (global as any).localStorage = mockStorage;

  try {
    const db = new MockDatabase();
    // In db.ts: this.users = parsed.users || SEED_USERS;
    // "invalid_string" is truthy, so this.users = "invalid_string"
    // Calling getUserById calls this.users.find() which does not exist on string!
    db.getUserById('author_priya');
  } catch (err: any) {
    throw new Error(
      `Defect confirmed: When localStorage contains non-array 'users', init() accepts it without validation, causing crash on getUserById(): ${err.message}`
    );
  } finally {
    delete (global as any).window;
    delete (global as any).localStorage;
  }
});

test('4.4 Corrupted Idempotency Key Store Recovers Without Crashing', 'Storage', () => {
  const corruptedKeys = [
    'INVALID_JSON',
    '{"not": "an entries array"}',
    '12345',
  ];

  for (const badKeyData of corruptedKeys) {
    const mockStorage = new MockLocalStorage();
    mockStorage.setItem('bookleaf_idempotency_keys_v1', badKeyData);

    (global as any).window = {};
    (global as any).localStorage = mockStorage;

    try {
      const db = new MockDatabase();
      const ticket = db.createTicket({
        author_id: 'author_priya',
        book_id: null,
        subject: 'Recovery test',
        description: 'Test',
      });
      assert.ok(ticket.id, 'Must be able to create tickets after recovering from corrupt idempotency storage');
    } finally {
      delete (global as any).window;
      delete (global as any).localStorage;
    }
  }
});

test('4.5 Corrupted Idempotency Store Resets ENTIRE Database To Seed', 'Storage', () => {
  const mockStorage = new MockLocalStorage();
  // Put a customized ticket into the DB store
  const customDb = {
    users: SEED_USERS,
    books: SEED_BOOKS,
    tickets: [{ id: 'BL-9999', subject: 'My Custom Ticket', status: 'Open', messages: [] }],
    metrics: INITIAL_ADMIN_METRICS,
  };
  mockStorage.setItem('bookleaf_db_store_v1', JSON.stringify(customDb));
  // Put corrupt entries in idempotency store
  mockStorage.setItem('bookleaf_idempotency_keys_v1', '{"not": "an array"}');

  (global as any).window = {};
  (global as any).localStorage = mockStorage;

  try {
    const db = new MockDatabase();
    const hasCustomTicket = db.getTicket('BL-9999');
    // Because idempotency throw is in the same try-catch block as DB init,
    // a corruption in idempotency wipes the entire database back to seed!
    if (!hasCustomTicket) {
      console.warn(
        '[FINDING] Blast Radius: An error in idempotency key parsing causes init() to call resetToSeed(), wiping all persisted database records!'
      );
    }
  } finally {
    delete (global as any).window;
    delete (global as any).localStorage;
  }
});

test('4.6 Storage Quota Exceeded (QuotaExceededError) During Persist Does Not Crash App', 'Storage', () => {
  const mockStorage = new MockLocalStorage();
  (global as any).window = {};
  (global as any).localStorage = mockStorage;

  try {
    const db = new MockDatabase();
    mockStorage.shouldThrowOnSet = true;

    let subscriberNotified = false;
    db.subscribe(() => {
      subscriberNotified = true;
    });

    const ticket = db.createTicket({
      author_id: 'author_priya',
      book_id: null,
      subject: 'Quota test',
      description: 'Desc',
    });

    assert.ok(ticket.id, 'Ticket should be created in-memory despite localStorage QuotaExceededError');
    assert.equal(subscriberNotified, true, 'Subscribers must still be notified on in-memory mutation');
  } finally {
    delete (global as any).window;
    delete (global as any).localStorage;
  }
});

test('4.7 Storage SecurityError (Restricted / Incognito Mode) Does Not Crash App', 'Storage', () => {
  const mockStorage = new MockLocalStorage();
  mockStorage.shouldThrowOnGet = true;
  mockStorage.shouldThrowOnSet = true;

  (global as any).window = {};
  (global as any).localStorage = mockStorage;

  try {
    const db = new MockDatabase();
    assert.equal(db.getAllBooks().length, 18, 'Must initialize fallback seed in incognito mode');
    assert.ok(db.getTickets().length >= 18);
  } finally {
    delete (global as any).window;
    delete (global as any).localStorage;
  }
});

// ============================================================================
// SUITE 5: TICKETS FILTERING, SEARCH & SEQUENCE STRESS
// ============================================================================
console.log('\n--- SUITE 5: Filters, Search, and Sequential ID Generation ---');

test('5.1 Ticket Status and Category Filters', 'Filters', () => {
  const db = new MockDatabase();

  const openTickets = db.getTickets({ status: 'Open' });
  for (const t of openTickets) {
    assert.equal(t.status, 'Open');
  }

  const inProgress = db.getTickets({ status: 'In progress' });
  for (const t of inProgress) {
    assert.equal(t.status, 'In progress');
  }

  const categoryFiltered = db.getTickets({ category: 'Royalty & Payments' });
  for (const t of categoryFiltered) {
    assert.equal(t.category, 'Royalty & Payments');
  }

  const allFiltered = db.getTickets({ status: 'All', category: 'All' });
  assert.equal(allFiltered.length, db.getTickets().length, 'Filter with "All" must return all tickets');
});

test('5.2 Ticket Search Adversarial Characters (Regex / Punctuation)', 'Filters', () => {
  const db = new MockDatabase();

  const results1 = db.getTickets({ search: 'Whispers (' });
  assert.ok(Array.isArray(results1));

  const results2 = db.getTickets({ search: 'BL-1042' });
  assert.equal(results2.length, 1);
  assert.equal(results2[0].id, 'BL-1042');

  const resultsCase = db.getTickets({ search: 'priya sharma' });
  assert.ok(resultsCase.length >= 4, 'Case-insensitive search must find Priya Sharma tickets');
});

test('5.3 Monotonic Sequential Ticket ID Generation under High Volume', 'Sequence', () => {
  const db = new MockDatabase();
  const generatedIds: string[] = [];

  for (let i = 0; i < 50; i++) {
    const t = db.createTicket({
      author_id: 'author_priya',
      book_id: null,
      subject: `Batch ticket ${i}`,
      description: `Batch desc ${i}`,
    });
    generatedIds.push(t.id);
  }

  const uniqueIds = new Set(generatedIds);
  assert.equal(uniqueIds.size, 50, 'All 50 generated ticket IDs must be unique');

  const nums = generatedIds.map((id) => parseInt(id.replace(/\D/g, ''), 10));
  for (let i = 1; i < nums.length; i++) {
    assert.equal(nums[i], nums[i - 1] + 1, `Sequential ID gap: ${nums[i - 1]} -> ${nums[i]}`);
  }
});

test('5.4 Ticket Status Transitions and Metric Sync Gaps (Closing or Reopening Tickets)', 'Metrics', () => {
  const db = new MockDatabase();
  const queueBefore = db.getAdminMetrics().total_in_queue;

  // 1. Updating status to 'Closed' does NOT decrement total_in_queue!
  db.updateTicketStatus('BL-1048', 'Closed');
  const queueAfterClosed = db.getAdminMetrics().total_in_queue;
  if (queueAfterClosed === queueBefore) {
    console.warn(
      `[FINDING] Metric Gap: Closing ticket BL-1048 does not decrement total_in_queue (${queueBefore} -> ${queueAfterClosed}). Closed tickets remain counted in total_in_queue metric!`
    );
  }

  // 2. Re-opening a resolved ticket
  db.updateTicketStatus('BL-1031', 'Open'); // BL-1031 was Resolved
  const queueAfterReopen = db.getAdminMetrics().total_in_queue;
  if (queueAfterReopen === queueAfterClosed) {
    console.warn(
      `[FINDING] Metric Gap: Re-opening a resolved ticket to 'Open' does not increment total_in_queue (${queueAfterClosed} -> ${queueAfterReopen})!`
    );
  }
});

// ============================================================================
// SUITE 6: FORMATTER BOUNDARY CONDITIONS & LOCALE STRESS
// ============================================================================
console.log('\n--- SUITE 6: Formatter Boundaries & Precision ---');

test('6.1 formatINR Default Behavior Rounds Paise (Requires explicit showPaiseIfNonZero)', 'Formatters', () => {
  assert.equal(formatINR(0), '₹0');
  assert.equal(formatINR(1000), '₹1,000');
  assert.equal(formatINR(19908), '₹19,908');
  assert.equal(formatINR(100000), '₹1,00,000', 'Must use Indian numbering system grouping');
  assert.equal(formatINR(10000000), '₹1,00,00,000', '1 Crore formatting');
  assert.equal(formatINR(null), 'Not set yet');
  assert.equal(formatINR(undefined), 'Not set yet');
  // Without option, rounds to ₹151
  assert.equal(formatINR(150.5), '₹151');
  // With option, formats to ₹150.50
  assert.equal(formatINR(150.5, { showPaiseIfNonZero: true }), '₹150.50');
});

test('6.2 formatDate with Fixed Asia/Kolkata Timezone', 'Formatters', () => {
  const formatted = formatDate('2026-10-20T16:15:00+05:30');
  assert.ok(formatted.includes('20 Oct 2026'), `Formatted date was: ${formatted}`);
});

test('6.3 formatRelativeTime Boundaries & Format', 'Formatters', () => {
  const now = new Date();
  assert.equal(formatRelativeTime(now.toISOString()), 'just now');

  const tenMinsAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  assert.equal(formatRelativeTime(tenMinsAgo), '10m ago');

  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
  assert.equal(formatRelativeTime(twoHoursAgo), '2 hours ago');

  const yesterday = new Date(now.getTime() - 26 * 60 * 60 * 1000).toISOString();
  assert.equal(formatRelativeTime(yesterday), 'yesterday');

  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(formatRelativeTime(threeDaysAgo), '3 days ago');
});

console.log('\n================================================================');
console.log(`TEST SUMMARY: ${passCount} Passed, ${failCount} Confirmed Defects`);
console.log('================================================================\n');

if (findings.length > 0) {
  console.log('CONFIRMED EMPIRICAL DEFECTS & FINDINGS:');
  findings.forEach((f, idx) => {
    console.log(`${idx + 1}. [${f.category}] ${f.name}`);
    console.log(`   Details: ${f.actual}\n`);
  });
}
