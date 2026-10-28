import { Ticket } from './mock/types';

/**
 * Formats a numeric value into Indian Rupee currency (₹) with tabular numerals.
 * Adheres to Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).
 * Hardened against NaN, Infinity, null, and undefined.
 */
export function formatINR(
  amount: number | null | undefined,
  options?: { showPaiseIfNonZero?: boolean; missingText?: string }
): string {
  if (amount === null || amount === undefined || isNaN(amount) || !Number.isFinite(amount)) {
    return options?.missingText ?? 'Not set yet';
  }

  const hasPaise = options?.showPaiseIfNonZero && amount % 1 !== 0;
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: hasPaise ? 2 : 0,
    minimumFractionDigits: hasPaise ? 2 : 0,
  });

  return formatter.format(amount);
}

/**
 * Formats count figures using en-IN grouping (e.g. 1,203).
 * Hardened against NaN.
 */
export function formatCount(count: number | null | undefined): string {
  if (count === null || count === undefined || isNaN(count)) {
    return '—';
  }
  return new Intl.NumberFormat('en-IN').format(count);
}

/**
 * Formats dates in Asia/Kolkata timezone (e.g. "20 Jun 2023" or "20 Oct 2026, 4:15 pm").
 * Fixes double-space comma formatting artifact.
 */
export function formatDate(
  dateInput: string | Date | null | undefined,
  options?: { includeTime?: boolean; missingText?: string }
): string {
  if (!dateInput) {
    return options?.missingText ?? 'Not published yet';
  }

  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) {
    return options?.missingText ?? 'Not published yet';
  }

  const dateOptions: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  };

  if (options?.includeTime) {
    dateOptions.hour = 'numeric';
    dateOptions.minute = '2-digit';
    dateOptions.hour12 = true;
  }

  const formatted = new Intl.DateTimeFormat('en-IN', dateOptions).format(date);
  return formatted.replace(/,\s*/, ', ');
}

/**
 * Returns human-readable relative activity strings.
 */
export function formatRelativeTime(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) {
    return 'Not published yet';
  }
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;

  return formatDate(date);
}

/**
 * Ensures ticket IDs conform to "BL-" format with uppercase prefix.
 * Hardened against whitespace-only strings.
 */
export function formatTicketId(id: string): string {
  if (!id) return '';
  const trimmed = id.trim().toUpperCase();
  if (!trimmed) return '';
  if (trimmed.startsWith('BL-')) return trimmed;
  if (trimmed.startsWith('BL')) return `BL-${trimmed.slice(2)}`;
  return `BL-${trimmed}`;
}

export interface ActivityDetails {
  text: string;
  isOfficialReply: boolean;
  isAwaiting: boolean;
  timestamp: string;
}

/**
 * Derives human-friendly activity copy conforming to Stitch Screen 4 & Spec §5.4.
 * Strictly excludes internal notes and AI drafts so confidential data never leaks to authors.
 */
export function formatTicketActivity(ticket: Ticket): ActivityDetails {
  if (ticket.status === 'Closed') {
    return {
      text: `Closed ${formatRelativeTime(ticket.updated_at)}`,
      isOfficialReply: false,
      isAwaiting: false,
      timestamp: ticket.updated_at,
    };
  }

  const messages = ticket.messages || [];
  // Find the last reply from support/admin (excluding internal notes, author messages, and AI drafts)
  const lastSupportMessage = [...messages].reverse().find(
    (m) => m.sender_role !== 'author' && !m.is_internal_note && m.sender_role !== 'ai'
  );

  if (lastSupportMessage) {
    const rawName = lastSupportMessage.sender_name || 'BookLeaf support';
    const firstName = rawName.split(/[, ]/)[0] || 'Team';
    const relTime = formatRelativeTime(lastSupportMessage.created_at);
    return {
      text: `Reply from ${firstName} ${relTime}`,
      isOfficialReply: true,
      isAwaiting: false,
      timestamp: lastSupportMessage.created_at,
    };
  }

  // Author sent without replies yet
  const createdAgo = formatRelativeTime(ticket.created_at);
  if (ticket.status === 'Open') {
    if (createdAgo === 'yesterday' || createdAgo.includes('day') || createdAgo.includes('week')) {
      return {
        text: `You sent this ${createdAgo} • `,
        isOfficialReply: false,
        isAwaiting: true,
        timestamp: ticket.created_at,
      };
    }
    return {
      text: `You sent this ${createdAgo}`,
      isOfficialReply: false,
      isAwaiting: false,
      timestamp: ticket.created_at,
    };
  }

  return {
    text: `Updated ${formatRelativeTime(ticket.updated_at)}`,
    isOfficialReply: false,
    isAwaiting: false,
    timestamp: ticket.updated_at,
  };
}
