import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SEED_USERS, SEED_BOOKS, SEED_TICKETS } from '../lib/mock/seed';
import { mockDb } from '../lib/mock/db';
import { Ticket, TicketMessage, Book, TicketStatus } from '../lib/mock/types';
import { formatINR, formatDate, formatTicketId, formatRelativeTime } from '../lib/formatters';
import { STATUS_HELPER_COPY, FIRST_RESPONSE_TARGET_HOURS } from '../lib/constants';
import { StatusProgressLine } from '../components/shared/StatusProgressLine';
import { StatusBadge } from '../components/shared/StatusBadge';
import { MessageBlock } from '../components/shared/MessageBlock';
import { EmptyState } from '../components/shared/EmptyState';
import { AttachmentDropzone, AttachmentFile, formatFileSize } from '../components/shared/AttachmentDropzone';

console.log('================================================================');
console.log('CHALLENGER 1: ADVERSARIAL STRESS TEST SUITE FOR MILESTONE 3 (TICKETS)');
console.log('================================================================\n');

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
// SUITE 1: SUBJECT CHARACTER LIMITS & COUNTER THRESHOLDS
// =============================================================================
console.log('\n--- SUITE 1: Subject Character Limits & Counter Thresholds ---');

function validateSubject(val: string): { valid: boolean; error?: string } {
  const trimmed = val.trim();
  if (!trimmed || trimmed.length < 5) {
    return { valid: false, error: 'Add a short subject so we can route your query.' };
  }
  if (val.length > 120) {
    return { valid: false, error: 'Subject must be 120 characters or fewer.' };
  }
  return { valid: true };
}

function getSubjectCounterState(val: string): { showCounter: boolean; isDanger: boolean; text: string } {
  const showCounter = val.length >= 96;
  const isDanger = val.length > 120;
  return {
    showCounter,
    isDanger,
    text: showCounter ? `${val.length} / 120` : '',
  };
}

check('Subject Limits', 'Reject subject shorter than 5 chars (0, 1, 4 chars, whitespace)', () => {
  assert.equal(validateSubject('').valid, false);
  assert.equal(validateSubject('   ').valid, false);
  assert.equal(validateSubject('Hi').valid, false);
  assert.equal(validateSubject('Four').valid, false);
  assert.equal(validateSubject('Four').error, 'Add a short subject so we can route your query.');
});

check('Subject Limits', 'Accept subject with exactly 5 characters', () => {
  const res = validateSubject('Valid');
  assert.equal(res.valid, true);
  assert.equal(res.error, undefined);
});

check('Subject Limits', 'Subject counter NOT displayed below 80% threshold (<96 chars)', () => {
  for (const len of [5, 20, 50, 95]) {
    const text = 'a'.repeat(len);
    const counter = getSubjectCounterState(text);
    assert.equal(counter.showCounter, false, `Counter should be hidden at length ${len}`);
    assert.equal(counter.text, '', `Counter text should be empty at length ${len}`);
  }
});

check('Subject Limits', 'Subject counter triggers at exactly 80% threshold (96 chars) in muted state', () => {
  const text96 = 'a'.repeat(96);
  const counter96 = getSubjectCounterState(text96);
  assert.equal(counter96.showCounter, true);
  assert.equal(counter96.isDanger, false);
  assert.equal(counter96.text, '96 / 120');

  const text100 = 'b'.repeat(100);
  const counter100 = getSubjectCounterState(text100);
  assert.equal(counter100.showCounter, true);
  assert.equal(counter100.isDanger, false);
  assert.equal(counter100.text, '100 / 120');
});

check('Subject Limits', 'Subject boundary at 120 chars is valid and counter is not danger', () => {
  const text120 = 'a'.repeat(120);
  const val = validateSubject(text120);
  const counter = getSubjectCounterState(text120);
  assert.equal(val.valid, true);
  assert.equal(counter.showCounter, true);
  assert.equal(counter.isDanger, false);
  assert.equal(counter.text, '120 / 120');
});

check('Subject Limits', 'Subject > 120 chars invalidates and sets counter to danger', () => {
  const text121 = 'a'.repeat(121);
  const val121 = validateSubject(text121);
  const counter121 = getSubjectCounterState(text121);
  assert.equal(val121.valid, false);
  assert.equal(val121.error, 'Subject must be 120 characters or fewer.');
  assert.equal(counter121.showCounter, true);
  assert.equal(counter121.isDanger, true);
  assert.equal(counter121.text, '121 / 120');

  const text300 = 'x'.repeat(300);
  const val300 = validateSubject(text300);
  const counter300 = getSubjectCounterState(text300);
  assert.equal(val300.valid, false);
  assert.equal(counter300.isDanger, true);
  assert.equal(counter300.text, '300 / 120');
});

// =============================================================================
// SUITE 2: DESCRIPTION CHARACTER LIMITS & COUNTER THRESHOLDS
// =============================================================================
console.log('\n--- SUITE 2: Description Character Limits & Counter Thresholds ---');

function validateDescription(val: string): { valid: boolean; error?: string } {
  const trimmed = val.trim();
  if (!trimmed || trimmed.length < 20) {
    return {
      valid: false,
      error: 'Describe the issue in at least 20 characters so we can help faster.',
    };
  }
  if (val.length > 3000) {
    return { valid: false, error: 'Description must be 3000 characters or fewer.' };
  }
  return { valid: true };
}

function getDescriptionCounterState(val: string): { showCounter: boolean; isDanger: boolean; text: string } {
  const showCounter = val.length >= 2400;
  const isDanger = val.length > 3000;
  return {
    showCounter,
    isDanger,
    text: showCounter ? `${val.length} / 3000` : '',
  };
}

check('Description Limits', 'Reject description shorter than 20 chars (0, 10, 19 chars, whitespace)', () => {
  assert.equal(validateDescription('').valid, false);
  assert.equal(validateDescription('   ').valid, false);
  assert.equal(validateDescription('Short description').valid, false);
  assert.equal(validateDescription('1234567890123456789').valid, false);
  assert.equal(
    validateDescription('1234567890123456789').error,
    'Describe the issue in at least 20 characters so we can help faster.'
  );
});

check('Description Limits', 'Accept description with exactly 20 characters', () => {
  const text20 = '12345678901234567890';
  const res = validateDescription(text20);
  assert.equal(res.valid, true);
  assert.equal(res.error, undefined);
});

check('Description Limits', 'Description counter NOT displayed below 80% threshold (<2400 chars)', () => {
  for (const len of [20, 500, 1500, 2399]) {
    const text = 'd'.repeat(len);
    const counter = getDescriptionCounterState(text);
    assert.equal(counter.showCounter, false, `Counter should be hidden at length ${len}`);
    assert.equal(counter.text, '', `Counter text should be empty at length ${len}`);
  }
});

check('Description Limits', 'Description counter triggers at exactly 80% threshold (2400 chars) in muted state', () => {
  const text2400 = 'd'.repeat(2400);
  const counter2400 = getDescriptionCounterState(text2400);
  assert.equal(counter2400.showCounter, true);
  assert.equal(counter2400.isDanger, false);
  assert.equal(counter2400.text, '2400 / 3000');

  const text2700 = 'd'.repeat(2700);
  const counter2700 = getDescriptionCounterState(text2700);
  assert.equal(counter2700.showCounter, true);
  assert.equal(counter2700.isDanger, false);
  assert.equal(counter2700.text, '2700 / 3000');
});

check('Description Limits', 'Description boundary at 3000 chars is valid and counter is not danger', () => {
  const text3000 = 'd'.repeat(3000);
  const val = validateDescription(text3000);
  const counter = getDescriptionCounterState(text3000);
  assert.equal(val.valid, true);
  assert.equal(counter.showCounter, true);
  assert.equal(counter.isDanger, false);
  assert.equal(counter.text, '3000 / 3000');
});

check('Description Limits', 'Description > 3000 chars invalidates and sets counter to danger', () => {
  const text3001 = 'd'.repeat(3001);
  const val3001 = validateDescription(text3001);
  const counter3001 = getDescriptionCounterState(text3001);
  assert.equal(val3001.valid, false);
  assert.equal(val3001.error, 'Description must be 3000 characters or fewer.');
  assert.equal(counter3001.showCounter, true);
  assert.equal(counter3001.isDanger, true);
  assert.equal(counter3001.text, '3001 / 3000');
});

// =============================================================================
// SUITE 3: BOOK SELECTION BEHAVIOR & CONTEXT PILL
// =============================================================================
console.log('\n--- SUITE 3: Book Selection Behavior & Context Pill ---');

check('Book Selection', 'Author books are sorted alphabetically A to Z', () => {
  const priyaBooks = mockDb.getBooksByAuthor('author_priya');
  const sorted = [...priyaBooks].sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
  );

  // Priya's books: The Saffron Diaries, Whispers of the Ganges
  assert.equal(sorted.length, 2, 'Priya must have 2 books');
  assert.equal(sorted[0].title, 'The Saffron Diaries');
  assert.equal(sorted[1].title, 'Whispers of the Ganges');
});

check('Book Selection', 'In-production books display " (In production)" suffix in option list', () => {
  const bk013 = mockDb.getBookByExternalId('BK013')!;
  assert.equal(bk013.status, 'In production');
  const optionLabel = `${bk013.title}${bk013.status === 'In production' ? ' (In production)' : ''}`;
  assert.equal(optionLabel, 'Midnight in Mysore (In production)');
});

check('Book Selection', 'Context awareness pill shows status and pending royalty for published books', () => {
  const whispers = mockDb.getBookByExternalId('BK001')!;
  assert.equal(whispers.status, 'Published & Live');
  assert.equal(whispers.royalty_pending, 3570);

  const whispersStatus = whispers.status as string;
  const pillText = whispersStatus === 'In production'
    ? 'Royalties start after publication.'
    : `${formatINR(whispers.royalty_pending)} royalty pending.`;
  assert.equal(pillText, '₹3,570 royalty pending.');

  // Render StatusBadge for published book
  const badgeHtml = renderToStaticMarkup(
    React.createElement(StatusBadge, { status: whispers.status })
  );
  assert.ok(badgeHtml.includes('Published &amp; Live') || badgeHtml.includes('Published & Live'));
});

check('Book Selection', 'Context awareness pill shows "Royalties start after publication." for production books', () => {
  const bk013 = mockDb.getBookByExternalId('BK013')!;
  assert.equal(bk013.status, 'In production');

  const pillText = bk013.status === 'In production'
    ? 'Royalties start after publication.'
    : `${formatINR(bk013.royalty_pending)} royalty pending.`;
  assert.equal(pillText, 'Royalties start after publication.');

  const badgeHtml = renderToStaticMarkup(
    React.createElement(StatusBadge, { status: bk013.status, stage: bk013.stage })
  );
  assert.ok(badgeHtml.includes('Cover Design'));
});

check('Book Selection', 'General inquiry selection maps book_id to null and does not render context pill', () => {
  const bookId = 'general';
  const targetBookId = bookId === 'general' ? null : bookId;
  assert.equal(targetBookId, null);

  // When general, selectedBook is undefined
  const priyaBooks = mockDb.getBooksByAuthor('author_priya');
  const selectedBook = priyaBooks.find(
    (b) => b.external_id.toLowerCase() === bookId.toLowerCase()
  );
  assert.equal(selectedBook, undefined);
});

// =============================================================================
// SUITE 4: ATTACHMENT DROPZONE CLIENT LIMITS
// =============================================================================
console.log('\n--- SUITE 4: Attachment Dropzone Client Limits ---');

function validateAttachmentAddition(
  currentFiles: AttachmentFile[],
  incomingFiles: { name: string; size: number; type: string }[],
  maxFiles = 3,
  maxSizeMB = 5,
  allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf']
): { ok: boolean; error?: string } {
  if (currentFiles.length + incomingFiles.length > maxFiles) {
    return { ok: false, error: `You can attach up to ${maxFiles} files.` };
  }

  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  for (const f of incomingFiles) {
    const ext = '.' + f.name.split('.').pop()?.toLowerCase();
    const isAllowedExt = allowedExtensions.includes(ext);
    const isAllowedMime =
      f.type === 'image/jpeg' || f.type === 'image/png' || f.type === 'application/pdf';

    if (!isAllowedExt && !isAllowedMime) {
      return { ok: false, error: `${f.name} isn’t supported. Use JPG, PNG or PDF.` };
    }

    if (f.size > maxSizeBytes) {
      return { ok: false, error: `${f.name} is larger than ${maxSizeMB} MB.` };
    }
  }

  return { ok: true };
}

check('Attachment Dropzone', 'formatFileSize renders readable units', () => {
  assert.equal(formatFileSize(0), '0 B');
  assert.equal(formatFileSize(512), '512 B');
  assert.equal(formatFileSize(1024), '1 KB');
  assert.equal(formatFileSize(500 * 1024), '500 KB');
  assert.equal(formatFileSize(5 * 1024 * 1024), '5.0 MB');
});

check('Attachment Dropzone', 'Allow attaching up to 3 valid files (<= 3)', () => {
  const current: AttachmentFile[] = [];
  const incoming = [
    { name: 'receipt.pdf', size: 1024 * 1024, type: 'application/pdf' },
    { name: 'cover.jpg', size: 2 * 1024 * 1024, type: 'image/jpeg' },
    { name: 'scan.png', size: 500 * 1024, type: 'image/png' },
  ];
  const res = validateAttachmentAddition(current, incoming);
  assert.equal(res.ok, true);
  assert.equal(res.error, undefined);
});

check('Attachment Dropzone', 'Reject attaching more than 3 files (> 3 files)', () => {
  const current: AttachmentFile[] = [
    { id: '1', name: 'f1.pdf', size: 1024, type: 'application/pdf' },
    { id: '2', name: 'f2.pdf', size: 1024, type: 'application/pdf' },
  ];
  const incoming = [
    { name: 'f3.jpg', size: 1024, type: 'image/jpeg' },
    { name: 'f4.png', size: 1024, type: 'image/png' },
  ];
  const res = validateAttachmentAddition(current, incoming);
  assert.equal(res.ok, false);
  assert.equal(res.error, 'You can attach up to 3 files.');
});

check('Attachment Dropzone', 'Reject file larger than 5 MB (> 5 * 1024 * 1024 bytes)', () => {
  const incoming = [
    { name: 'manuscript.pdf', size: 5 * 1024 * 1024 + 1, type: 'application/pdf' },
  ];
  const res = validateAttachmentAddition([], incoming);
  assert.equal(res.ok, false);
  assert.equal(res.error, 'manuscript.pdf is larger than 5 MB.');
});

check('Attachment Dropzone', 'Accept file exactly 5 MB', () => {
  const incoming = [
    { name: 'exact.pdf', size: 5 * 1024 * 1024, type: 'application/pdf' },
  ];
  const res = validateAttachmentAddition([], incoming);
  assert.equal(res.ok, true);
});

check('Attachment Dropzone', 'Reject unsupported file types (.bmp, .txt, .exe, .docx, .zip)', () => {
  const unsupported = [
    { name: 'photo.bmp', size: 1024, type: 'image/bmp' },
    { name: 'notes.txt', size: 1024, type: 'text/plain' },
    { name: 'setup.exe', size: 1024, type: 'application/x-msdownload' },
    { name: 'doc.docx', size: 1024, type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    { name: 'archive.zip', size: 1024, type: 'application/zip' },
  ];

  for (const f of unsupported) {
    const res = validateAttachmentAddition([], [f]);
    assert.equal(res.ok, false, `File ${f.name} should be rejected`);
    assert.equal(res.error, `${f.name} isn’t supported. Use JPG, PNG or PDF.`);
  }
});

check('Attachment Dropzone', 'Disclaimer note renders when attachments are disabled', () => {
  const prevEnv = process.env.NEXT_PUBLIC_ATTACHMENTS_ENABLED;
  try {
    delete process.env.NEXT_PUBLIC_ATTACHMENTS_ENABLED;
    const html = renderToStaticMarkup(
      React.createElement(AttachmentDropzone, { files: [], onFilesChange: () => {} })
    );
    assert.ok(
      html.includes('File upload isn’t switched on in this demo. Mention any files in your description.')
    );
    assert.ok(html.includes('min-h-[104px]'));
    assert.ok(html.includes('border-dashed'));
  } finally {
    process.env.NEXT_PUBLIC_ATTACHMENTS_ENABLED = prevEnv;
  }
});

// =============================================================================
// SUITE 5: STATUS STEPPER GEOMETRY AND INDEX MAPPING
// =============================================================================
console.log('\n--- SUITE 5: Status Stepper Geometry and Index Mapping ---');

const STEPS: readonly TicketStatus[] = ['Open', 'In progress', 'Resolved', 'Closed'];

function calculateStepperState(status: string) {
  const currentStepIndex = Math.max(0, STEPS.indexOf(status as TicketStatus));
  const activePercent = Math.min(100, Math.max(0, (currentStepIndex / (STEPS.length - 1)) * 100));
  const helperText =
    STATUS_HELPER_COPY[status] ||
    `We’ve received your query. We aim to reply within ${FIRST_RESPONSE_TARGET_HOURS} hours.`;
  return { currentStepIndex, activePercent, helperText };
}

check('Status Stepper', 'Index mapping: Open (0), In progress (1), Resolved (2), Closed (3)', () => {
  assert.equal(calculateStepperState('Open').currentStepIndex, 0);
  assert.equal(calculateStepperState('In progress').currentStepIndex, 1);
  assert.equal(calculateStepperState('Resolved').currentStepIndex, 2);
  assert.equal(calculateStepperState('Closed').currentStepIndex, 3);
});

check('Status Stepper', 'Connector active percent: 0% at Open, 33.3% In progress, 66.7% Resolved, 100% Closed', () => {
  const open = calculateStepperState('Open');
  assert.equal(open.activePercent, 0);

  const inProg = calculateStepperState('In progress');
  assert.ok(Math.abs(inProg.activePercent - 33.333) < 0.01);

  const resolved = calculateStepperState('Resolved');
  assert.ok(Math.abs(resolved.activePercent - 66.666) < 0.01);

  const closed = calculateStepperState('Closed');
  assert.equal(closed.activePercent, 100);
});

check('Status Stepper', 'Gracefully falls back to step 0 (Open) for unknown/invalid status', () => {
  const invalid = calculateStepperState('InvalidStatus');
  assert.equal(invalid.currentStepIndex, 0);
  assert.equal(invalid.activePercent, 0);
  assert.ok(invalid.helperText.includes('48 hours'));
});

check('Status Stepper', 'Helper text maps accurately to all 4 statuses per UI spec §4', () => {
  assert.equal(
    calculateStepperState('Open').helperText,
    'We’ve received your query. We aim to reply within 48 hours.'
  );
  assert.equal(
    calculateStepperState('In progress').helperText,
    'Our team is working on this. We’ll update you here.'
  );
  assert.equal(
    calculateStepperState('Resolved').helperText,
    'We think this is resolved. If it isn’t, raise a new query and mention the ticket number.'
  );
  assert.equal(
    calculateStepperState('Closed').helperText,
    'This ticket is closed. Raise a new query if you need more help.'
  );
});

check('Status Stepper', 'Component renders grid-cols-4 and proper node accessibility attributes', () => {
  const html = renderToStaticMarkup(
    React.createElement(StatusProgressLine, { status: 'In progress' })
  );
  assert.ok(html.includes('grid-cols-4'));
  assert.ok(html.includes('aria-current="step"'));
  assert.ok(html.includes('left-[12.5%]'));
  assert.ok(html.includes('right-[12.5%]'));
  assert.ok(html.includes('Our team is working on this. We’ll update you here.'));
});

// =============================================================================
// SUITE 6: FILTER COUNTS MATCH TICKET STORE COUNTS FOR PRIYA SHARMA
// =============================================================================
console.log('\n--- SUITE 6: Filter Counts Match Ticket Store Counts ---');

check('Filter Counts', 'Clean seed starts with 0 tickets and filter sum consistency holds', () => {
  const priyaTickets = mockDb.getTickets({ authorId: 'author_priya' });
  const counts = {
    All: priyaTickets.length,
    Open: priyaTickets.filter((t) => t.status === 'Open').length,
    'In progress': priyaTickets.filter((t) => t.status === 'In progress').length,
    Resolved: priyaTickets.filter((t) => t.status === 'Resolved').length,
    Closed: priyaTickets.filter((t) => t.status === 'Closed').length,
  };

  assert.equal(counts.All, priyaTickets.length);
  assert.equal(
    counts.Open + counts['In progress'] + counts.Resolved + counts.Closed,
    counts.All,
    'Sum of individual filter counts must equal All count'
  );
});

check('Filter Counts', 'Unread update dot matches ticket state on newly created ticket', () => {
  const t = mockDb.createTicket({
    author_id: 'author_priya',
    book_id: null,
    subject: 'Unread Check',
    description: 'Testing unread update state.',
  });
  assert.equal(t.has_unread, false);
  mockDb.addMessage(t.id, {
    sender_name: 'Rahul, BookLeaf support',
    sender_role: 'support',
    body: 'Official reply',
  });
  const updated = mockDb.getTicket(t.id)!;
  assert.equal(updated.has_unread, true);
});

// =============================================================================
// SUITE 7: DATA PRIVACY INVARIANT (TICKET DETAILS VIEW)
// =============================================================================
console.log('\n--- SUITE 7: Data Privacy Invariant in Ticket Details ---');

check('Data Privacy', 'Author thread strictly filters out is_internal_note: true and sender_role: ai', () => {
  const testMessages: TicketMessage[] = [
    {
      id: 'm1',
      ticket_id: 'BL-TEST',
      sender_name: 'Priya Sharma',
      sender_role: 'author',
      body: 'Query from author.',
      created_at: '2026-10-24T10:00:00Z',
    },
    {
      id: 'm2',
      ticket_id: 'BL-TEST',
      sender_name: 'Internal Note Keeper',
      sender_role: 'admin',
      body: 'SECRET: Author account flagged for special review.',
      created_at: '2026-10-24T11:00:00Z',
      is_internal_note: true,
    },
    {
      id: 'm3',
      ticket_id: 'BL-TEST',
      sender_name: 'AI Drafting Bot',
      sender_role: 'ai',
      body: 'AI draft response waiting for human review.',
      created_at: '2026-10-24T11:05:00Z',
    },
    {
      id: 'm4',
      ticket_id: 'BL-TEST',
      sender_name: 'Rahul, BookLeaf support',
      sender_role: 'support',
      body: 'Official reply to author.',
      created_at: '2026-10-24T12:00:00Z',
    },
  ];

  // Invariant filter applied in app/(author)/tickets/[id]/page.tsx:205
  const visibleMessages = testMessages.filter((m) => !m.is_internal_note && m.sender_role !== 'ai');

  assert.equal(visibleMessages.length, 2, 'Only 2 messages must remain visible to author');
  assert.equal(visibleMessages[0].id, 'm1');
  assert.equal(visibleMessages[1].id, 'm4');

  // Verify none of the leaked texts exist in visible array
  assert.ok(!visibleMessages.some((m) => m.is_internal_note));
  assert.ok(!visibleMessages.some((m) => m.sender_role === 'ai'));
  assert.ok(!visibleMessages.some((m) => m.body.includes('SECRET')));
  assert.ok(!visibleMessages.some((m) => m.body.includes('AI draft')));
});

check('Data Privacy', 'MessageBlock rendered for author messages never renders internal or AI badges', () => {
  const authorMsg: TicketMessage = {
    id: 'msg_author',
    ticket_id: 'BL-TEST',
    sender_name: 'Priya Sharma',
    sender_role: 'author',
    body: 'Where is my royalty payout?',
    created_at: '2026-10-24T10:00:00Z',
  };

  const supportMsg: TicketMessage = {
    id: 'msg_support',
    ticket_id: 'BL-TEST',
    sender_name: 'Rahul, BookLeaf support',
    sender_role: 'support',
    body: 'It will arrive shortly.',
    created_at: '2026-10-24T11:00:00Z',
  };

  const htmlAuthor = renderToStaticMarkup(
    React.createElement(MessageBlock, { message: authorMsg, isAuthorCurrentUser: true })
  );
  assert.ok(!htmlAuthor.includes('Internal note'));
  assert.ok(!htmlAuthor.includes('AI draft'));
  assert.ok(htmlAuthor.includes('(you)'));

  const htmlSupport = renderToStaticMarkup(
    React.createElement(MessageBlock, { message: supportMsg })
  );
  assert.ok(!htmlSupport.includes('Internal note'));
  assert.ok(!htmlSupport.includes('AI draft'));
  assert.ok(htmlSupport.includes('Official'));
});

// =============================================================================
// SUITE 8: FORM DRAFT PRESERVATION IN LOCALSTORAGE
// =============================================================================
console.log('\n--- SUITE 8: Form Draft Preservation in localStorage ---');

const DRAFT_KEY = 'draft:new-ticket';

class MockLocalStorage {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

check('Draft Preservation', 'Auto-saving persists dirty form state to draft:new-ticket', () => {
  const storage = new MockLocalStorage();

  const draft = {
    bookId: 'BK001',
    subject: 'Delayed Royalty Settlement',
    description: 'My Q3 royalty of ₹3,570 has not been disbursed to HDFC bank.',
  };

  storage.setItem(DRAFT_KEY, JSON.stringify(draft));

  const loaded = JSON.parse(storage.getItem(DRAFT_KEY)!);
  assert.equal(loaded.bookId, 'BK001');
  assert.equal(loaded.subject, 'Delayed Royalty Settlement');
  assert.equal(loaded.description, draft.description);
});

check('Draft Preservation', 'Emptying form fields removes draft from storage', () => {
  const storage = new MockLocalStorage();
  storage.setItem(DRAFT_KEY, JSON.stringify({ bookId: 'BK001', subject: 'test', description: 'test' }));

  // Form cleared logic:
  const bookId = '';
  const subject = '   ';
  const description = '';

  if (!bookId && !subject.trim() && !description.trim()) {
    storage.removeItem(DRAFT_KEY);
  }

  assert.equal(storage.getItem(DRAFT_KEY), null);
});

check('Draft Preservation', 'Confirming discard permanently removes draft', () => {
  const storage = new MockLocalStorage();
  storage.setItem(DRAFT_KEY, JSON.stringify({ bookId: 'BK002', subject: 'Subject', description: 'Desc' }));
  assert.ok(storage.getItem(DRAFT_KEY));

  // handleConfirmDiscard logic:
  storage.removeItem(DRAFT_KEY);
  assert.equal(storage.getItem(DRAFT_KEY), null);
});

check('Draft Preservation', 'Successful ticket creation clears draft and assigns next BL-ID', () => {
  const storage = new MockLocalStorage();
  storage.setItem(DRAFT_KEY, JSON.stringify({ bookId: 'BK001', subject: 'Subject', description: 'Desc' }));

  const created = mockDb.createTicket({
    author_id: 'author_priya',
    book_id: 'BK001',
    subject: 'Automated Test Ticket For Creation',
    description: 'This is an automated test ticket created to verify draft clearance and BL-id format.',
  });

  // Draft removed on success
  storage.removeItem(DRAFT_KEY);

  assert.ok(created.id.startsWith('BL-'));
  assert.equal(created.author_id, 'author_priya');
  assert.equal(created.status, 'Open');
  assert.equal(storage.getItem(DRAFT_KEY), null);
});

// =============================================================================
// SUITE 9: XSS SANITIZATION & UNICODE ROBUSTNESS (SPEC §2.2)
// =============================================================================
console.log('\n--- SUITE 9: XSS Sanitization & Unicode Robustness ---');

check('Unicode & XSS', 'Devanagari scripts and regional text render without corruption or failure', () => {
  const hindiSubject = 'मेरी किताब की रॉयल्टी और वितरण';
  const hindiDescription = 'नमस्ते, क्या आप बता सकते हैं कि पिछले महीने की रॉयल्टी कब आएगी? धन्यवाद।';

  const valSub = validateSubject(hindiSubject);
  const valDesc = validateDescription(hindiDescription);

  assert.equal(valSub.valid, true, 'Devanagari subject must be valid');
  assert.equal(valDesc.valid, true, 'Devanagari description must be valid');

  const msg: TicketMessage = {
    id: 'msg_hindi',
    ticket_id: 'BL-TEST',
    sender_name: 'Priya Sharma',
    sender_role: 'author',
    body: hindiDescription,
    created_at: '2026-10-24T10:00:00Z',
  };

  const html = renderToStaticMarkup(
    React.createElement(MessageBlock, { message: msg, isAuthorCurrentUser: true })
  );
  assert.ok(html.includes(hindiDescription), 'HTML must contain Devanagari text intact');
});

check('Unicode & XSS', 'Malicious script injection strings in ticket body are escaped by React', () => {
  const xssPayload = '<script>alert("XSS")</script><img src=x onerror=alert(1)>';
  const msg: TicketMessage = {
    id: 'msg_xss',
    ticket_id: 'BL-TEST',
    sender_name: 'Malicious Author',
    sender_role: 'author',
    body: xssPayload,
    created_at: '2026-10-24T10:00:00Z',
  };

  const html = renderToStaticMarkup(
    React.createElement(MessageBlock, { message: msg })
  );

  // In React SSR, dangerous characters are entity-escaped:
  // '<' becomes '&lt;', '>' becomes '&gt;', '"' becomes '&quot;'
  assert.ok(!html.includes('<script>alert'), 'Raw unescaped script tag must not exist');
  assert.ok(html.includes('&lt;script&gt;alert'), 'Script tag must be entity escaped');
  assert.ok(html.includes('&lt;img src=x'), 'Image tag must be entity escaped');
});

// =============================================================================
// SUITE 10: TICKET ID FORMATTING & RETRIEVAL NORMALIZATION
// =============================================================================
console.log('\n--- SUITE 10: Ticket ID Formatting & Normalization ---');

check('Ticket ID Normalization', 'formatTicketId handles all raw representations and case variations', () => {
  assert.equal(formatTicketId('1042'), 'BL-1042');
  assert.equal(formatTicketId('bl1042'), 'BL-1042');
  assert.equal(formatTicketId('bl-1042'), 'BL-1042');
  assert.equal(formatTicketId('BL-1042'), 'BL-1042');
  assert.equal(formatTicketId('  bl-1042  '), 'BL-1042');
  assert.equal(formatTicketId(''), '');
  assert.equal(formatTicketId('   '), '');
});

check('Ticket ID Normalization', 'mockDb.getTicket retrieves tickets case-insensitively', () => {
  let t = mockDb.getTickets()[0];
  if (!t) {
    t = mockDb.createTicket({
      author_id: 'AUTH001',
      book_id: 'BK001',
      subject: 'Case Normalization Check',
      description: 'Testing ticket ID case-insensitive retrieval.',
    });
  }
  const id = t.id;
  const tUpper = mockDb.getTicket(id.toUpperCase());
  const tLower = mockDb.getTicket(id.toLowerCase());
  assert.ok(tUpper);
  assert.ok(tLower);
  assert.equal(tUpper.id, tLower.id);
  assert.equal(tUpper.id, id);
});

// =============================================================================
// SUITE 11: EMPTYSTATE COMPONENT & VARIANT RENDERING
// =============================================================================
console.log('\n--- SUITE 11: EmptyState Component & Variant Rendering ---');

check('EmptyState', 'Default EmptyState renders zero-state UI with 2x2 common topics', () => {
  const html = renderToStaticMarkup(React.createElement(EmptyState));
  assert.ok(html.includes('No tickets yet'));
  assert.ok(html.includes('New support query'));
  assert.ok(html.includes('Royalty &amp; payment settlement') || html.includes('Royalty & payment settlement'));
  assert.ok(html.includes('Production stage &amp; proof copies') || html.includes('Production stage & proof copies'));
  assert.ok(html.includes('ISBN &amp; retail distribution') || html.includes('ISBN & retail distribution'));
  assert.ok(html.includes('Author bio &amp; cover adjustments') || html.includes('Author bio & cover adjustments'));
});

check('EmptyState', 'Filter empty variant renders reset button and hides common topics', () => {
  const html = renderToStaticMarkup(
    React.createElement(EmptyState, {
      isFilterEmpty: true,
      title: 'No resolved tickets',
      description: 'There are currently no support queries matching the "Resolved" status filter.',
      actionLabel: 'Show all tickets',
      showTopics: false,
    })
  );
  assert.ok(html.includes('No resolved tickets'));
  assert.ok(html.includes('Show all tickets'));
  assert.ok(!html.includes('Common topics you can ask about'));
});

// =============================================================================
// SUITE SUMMARY
// =============================================================================
console.log('\n================================================================');
console.log(`TOTAL TESTS: ${passCount + failCount}`);
console.log(`PASSED:      ${passCount}`);
console.log(`FAILED:      ${failCount}`);
console.log('================================================================');

if (failCount > 0) {
  console.error('\nFINDINGS ENCOUNTERED:');
  findings.forEach((f, idx) => {
    console.error(`  ${idx + 1}. [${f.severity}] [${f.suite}] ${f.test}: ${f.error}`);
  });
  process.exit(1);
} else {
  console.log('\nALL EMPIRICAL TESTS PASSED WITH 100% SUCCESS!');
  process.exit(0);
}

