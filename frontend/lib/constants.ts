export const FIRST_RESPONSE_TARGET_HOURS = 48;
export const MIN_PAYOUT_INR = 1000;

export const PRODUCTION_STAGES = [
  'Manuscript Received',
  'Editing',
  'Cover Design',
  'Typesetting',
  'Proofreading',
  'ISBN Assignment',
  'Printing',
  'Distribution Setup',
  'Published & Live',
] as const;

export const TICKET_STATUSES = ['Open', 'In progress', 'Resolved', 'Closed'] as const;

export const TICKET_PRIORITIES = ['Critical', 'High', 'Medium', 'Low'] as const;

export const TICKET_CATEGORIES = [
  'Royalty & Payments',
  'Production & Proofs',
  'ISBN & Distribution',
  'Author Copies',
  'Cover & Design',
  'General Inquiry',
] as const;

export const STATUS_HELPER_COPY: Record<string, string> = {
  Open: 'We’ve received your query. We aim to reply within 48 hours.',
  'In progress': 'Our team is working on this. We’ll update you here.',
  Resolved: 'We think this is resolved. If it isn’t, raise a new query and mention the ticket number.',
  Closed: 'This ticket is closed. Raise a new query if you need more help.',
};
