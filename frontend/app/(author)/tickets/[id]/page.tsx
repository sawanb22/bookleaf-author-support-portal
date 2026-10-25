'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  X,
  Send,
  Paperclip,
  Bold,
  ListOrdered,
  Clock,
  AlertCircle,
  Ticket as TicketIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/mock/auth-context';
import { mockDb } from '@/lib/mock/db';
import { useLiveTicket } from '@/lib/mock/hooks';
import { formatDate, formatTicketId } from '@/lib/formatters';
import { StatusProgressLine } from '@/components/shared/StatusProgressLine';
import { MessageBlock } from '@/components/shared/MessageBlock';
import { apiClient } from '@/lib/api-client';

interface PageProps {
  params: { id: string };
}

export default function TicketDetailsPage({ params }: PageProps) {
  return (
    <React.Suspense fallback={<TicketDetailSkeleton />}>
      <TicketDetailsContent ticketId={params.id} />
    </React.Suspense>
  );
}

function TicketDetailsContent({ ticketId }: { ticketId: string }) {
  const searchParams = useSearchParams();
  const sentParam = searchParams.get('sent');
  const [showSentBanner, setShowSentBanner] = useState(sentParam === '1');

  const { user } = useAuth();

  // Normalize ID (support "BL-1042", "bl-1042", or "1042")
  const normalizedId = formatTicketId(ticketId);

  // Real-time live polling hook (10s interval + reactive local mutations)
  const { ticket, isLoading, lastUpdated, newReplyHighlight, refresh } = useLiveTicket(normalizedId);

  // Composer states
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [mockAttachNotice, setMockAttachNotice] = useState(false);

  // Screen reader live announcements
  const [announcement, setAnnouncement] = useState('');
  const prevMsgCountRef = useRef<number>(ticket?.messages?.length || 0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Refresh and mark read when author visits ticket
  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (ticket?.id && ticket.has_unread) {
      mockDb.markTicketRead(ticket.id);
    }
  }, [ticket?.id, ticket?.has_unread]);

  // Detect incoming replies for live region announcements and document title
  useEffect(() => {
    if (!ticket) return;
    const msgs = ticket.messages || [];
    const currentCount = msgs.length;
    if (currentCount > prevMsgCountRef.current) {
      const latestMsg = msgs[currentCount - 1];
      if (latestMsg && (latestMsg.sender_role === 'support' || latestMsg.sender_role === 'admin')) {
        setAnnouncement('New reply from BookLeaf support received.');
        if (typeof document !== 'undefined' && document.hidden) {
          if (!document.title.startsWith('(1) ')) {
            document.title = `(1) ${document.title}`;
          }
        }
      }
    }
    prevMsgCountRef.current = currentCount;
  }, [ticket]);

  // Clear (1) prefix on document focus
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && document.title.startsWith('(1) ')) {
        document.title = document.title.replace('(1) ', '');
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Textarea formatting tools
  const handleInsertBold = () => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = el.value;
    const selected = text.substring(start, end);
    const replacement = `**${selected || 'bold text'}**`;
    const nextVal = text.substring(0, start) + replacement + text.substring(end);
    setReplyText(nextVal);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + 2, start + 2 + (selected.length || 9));
    }, 0);
  };

  const handleInsertList = () => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = el.value;
    const prefix = text.length === 0 || text.endsWith('\n') ? '1. ' : '\n1. ';
    const nextVal = text.substring(0, start) + prefix + text.substring(end);
    setReplyText(nextVal);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length);
    }, 0);
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket) return;

    const trimmed = replyText.trim();
    if (!trimmed) {
      setErrorText('Please write a message before sending.');
      return;
    }

    setIsSubmitting(true);
    setErrorText(null);

    try {
      const idempotencyKey = `reply_${ticket.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      // 1. Live message dispatch to FastAPI backend backed by Neon PostgreSQL
      if (typeof window !== 'undefined') {
        await apiClient.author.addMessage(ticket.id, trimmed);
      }

      // 2. Also keep mockDb synchronized
      mockDb.addMessage(
        ticket.id,
        {
          sender_name: user?.name || ticket.author_name || 'Priya Sharma',
          sender_role: 'author',
          body: trimmed,
        },
        idempotencyKey
      );

      refresh();
      setReplyText('');
      setSubmitFeedback(
        'Your message was sent to the operations team. This ticket will update as soon as an agent reviews it.'
      );
      setTimeout(() => setSubmitFeedback(null), 8000);
    } catch {
      setErrorText('Your message wasn’t sent. Your text is still here. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading State
  if (isLoading && !ticket) {
    return <TicketDetailSkeleton />;
  }

  // Not Found State
  if (!ticket) {
    return (
      <div className="w-full max-w-[760px] mx-auto py-12 px-4 sm:px-0">
        <Link
          href="/tickets"
          className="inline-flex items-center text-sm font-medium text-primary hover:underline underline-offset-4 decoration-primary/40 hover:decoration-primary focus-ring rounded mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" aria-hidden="true" />
          Back to My Tickets
        </Link>

        <div className="bg-surface border border-border rounded-xl p-8 sm:p-12 text-center flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-surface-sunken flex items-center justify-center text-text-muted mb-4">
            <TicketIcon className="w-6 h-6" />
          </div>
          <h1 className="font-serif text-title-section text-text font-semibold mb-2">
            Ticket not found
          </h1>
          <p className="font-body text-body text-text-muted max-w-md mb-6 leading-relaxed">
            We couldn’t find ticket <span className="font-medium text-text tabular-nums">{normalizedId}</span>. It may have been removed, or the link may be wrong.
          </p>
          <Link
            href="/tickets"
            className="h-10 px-5 bg-primary hover:bg-primary-hover active:bg-primary-pressed text-on-primary font-label text-sm font-medium rounded-md inline-flex items-center focus-ring"
          >
            Back to My Tickets
          </Link>
        </div>
      </div>
    );
  }

  // Author visible messages only (internal notes and AI drafts are hidden from author view per §5.5)
  const ticketMessages = ticket?.messages || [];
  const visibleMessages = ticketMessages.filter((m) => !m.is_internal_note && m.sender_role !== 'ai');
  const hasOfficialReply = visibleMessages.some(
    (m) => m.sender_role === 'support' || m.sender_role === 'admin'
  );

  return (
    <div className="w-full max-w-[760px] mx-auto pb-16">
      {/* Screen Reader Live Region */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      {/* Back to My Tickets Navigation */}
      <div className="mb-4">
        <Link
          href="/tickets"
          className="inline-flex items-center text-sm font-medium text-primary hover:underline underline-offset-4 decoration-primary/40 hover:decoration-primary focus-ring rounded"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" aria-hidden="true" />
          Back to My Tickets
        </Link>
      </div>

      {/* Dismissible Success Banner when arriving with ?sent=1 */}
      {showSentBanner && (
        <div
          role="status"
          aria-live="polite"
          className="mb-6 p-4 rounded-md bg-primary-tint border-l-[3px] border-l-primary flex items-start justify-between gap-3 text-text transition-all"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-body text-body font-medium text-text">
                Query sent as {ticket.id}. We aim to reply within 48 hours.
              </p>
              <p className="font-caption text-caption text-text-muted mt-0.5">
                You can follow replies and updates on this page.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowSentBanner(false)}
            className="p-1 text-text-muted hover:text-text rounded focus-ring"
            aria-label="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Ticket Header */}
      <header className="mb-6">
        <div className="font-caption text-caption text-text-muted tabular-nums uppercase tracking-wider mb-1">
          {ticket.id}
        </div>
        <h1 className="font-title-page text-title-page-mobile sm:text-title-page text-text font-semibold tracking-tight break-words mb-3">
          {ticket.subject}
        </h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-caption text-caption text-text-muted">
          {ticket.book_title ? (
            <span>
              Book: <span className="font-title-book italic text-text font-medium">{ticket.book_title}</span>
            </span>
          ) : (
            <span>General / account level</span>
          )}
          <span className="w-1 h-1 rounded-full bg-border-strong" aria-hidden="true" />
          <span>
            Sent:{' '}
            <span className="tabular-nums text-text">
              {formatDate(ticket.created_at, { includeTime: true })}
            </span>
          </span>
        </div>
      </header>

      {/* Signature 4-Node Status Progress Line */}
      <div className="mb-8">
        <StatusProgressLine
          status={ticket.status}
          lastUpdated={lastUpdated}
        />
      </div>

      {/* Conversation Message Thread */}
      <section aria-label="Conversation messages" className="space-y-4 mb-8">
        {visibleMessages.map((msg, index) => {
          const isLatest = index === visibleMessages.length - 1;
          return (
            <MessageBlock
              key={msg.id}
              message={msg}
              isAuthorCurrentUser={msg.sender_role === 'author'}
              isHighlighted={isLatest && newReplyHighlight}
            />
          );
        })}

        {/* Empty Reply State (when only author query exists) */}
        {!hasOfficialReply && (
          <div className="bg-surface border border-border border-dashed rounded-md p-5 text-center text-text-muted font-body text-body flex items-center justify-center gap-2.5">
            <Clock className="w-4 h-4 text-text-subtle" aria-hidden="true" />
            <span>No reply yet. We’ll post it here, and you’ll see it without refreshing.</span>
          </div>
        )}
      </section>

      {/* Temporary Reply Feedback Alert */}
      {submitFeedback && (
        <div
          role="status"
          aria-live="polite"
          className="mb-6 p-4 rounded-md bg-primary-tint border-l-[3px] border-l-primary flex items-start justify-between gap-3 text-text"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
            <p className="font-body text-body text-text">{submitFeedback}</p>
          </div>
          <button
            type="button"
            onClick={() => setSubmitFeedback(null)}
            className="p-1 text-text-muted hover:text-text rounded focus-ring"
            aria-label="Dismiss confirmation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Follow-up Reply Composer OR Closed Ticket Notice */}
      {ticket.status === 'Closed' ? (
        <div className="bg-surface-sunken border border-border rounded-md p-5 sm:p-6 text-center">
          <p className="font-body text-body text-text font-medium mb-1">
            This ticket is closed.
          </p>
          <p className="font-caption text-caption text-text-muted mb-4">
            If you need further help or have another question, please raise a new support query.
          </p>
          <Link
            href="/tickets/new"
            className="h-10 px-5 bg-primary hover:bg-primary-hover active:bg-primary-pressed text-on-primary font-label text-sm font-medium rounded-md inline-flex items-center focus-ring"
          >
            Raise a new query
          </Link>
        </div>
      ) : (
        <section
          aria-label="Add a reply"
          className="bg-surface border border-border rounded-md p-5 sm:p-6"
        >
          <form onSubmit={handleSendReply}>
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="ticket-reply-body"
                className="font-label text-label font-medium text-text"
              >
                Add a message
              </label>
              <span className="font-caption text-caption text-text-muted hidden sm:inline">
                Authors and editors on this thread will be notified
              </span>
            </div>

            {/* Error Message */}
            {errorText && (
              <div
                role="alert"
                className="mb-3 p-3 rounded bg-danger-tint border border-danger/20 text-danger font-body text-sm flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorText}</span>
              </div>
            )}

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              id="ticket-reply-body"
              rows={4}
              value={replyText}
              onChange={(e) => {
                setReplyText(e.target.value);
                if (errorText) setErrorText(null);
              }}
              placeholder="Type your reply here..."
              className="w-full rounded-md border border-border bg-surface px-3.5 py-3 text-body font-body text-text placeholder:text-text-subtle focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none resize-y min-h-[110px]"
            />

            {/* Mock Attachment Notice */}
            {mockAttachNotice && (
              <div className="mt-2 text-xs text-text-subtle flex items-center justify-between bg-surface-sunken p-2 rounded">
                <span>File uploads are simulated in this demo. Mention any document details in your text.</span>
                <button
                  type="button"
                  onClick={() => setMockAttachNotice(false)}
                  className="text-text-muted hover:text-text ml-2"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Bottom Formatting Toolbar & Actions */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pt-2">
              {/* Left Toolbar */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setMockAttachNotice((prev) => !prev)}
                  title="Attach file (mock)"
                  aria-label="Attach file"
                  className="p-2 text-text-muted hover:text-text hover:bg-surface-sunken rounded focus-ring transition-colors"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleInsertBold}
                  title="Bold text"
                  aria-label="Bold text"
                  className="p-2 text-text-muted hover:text-text hover:bg-surface-sunken rounded focus-ring transition-colors"
                >
                  <Bold className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleInsertList}
                  title="Numbered list"
                  aria-label="Numbered list"
                  className="p-2 text-text-muted hover:text-text hover:bg-surface-sunken rounded focus-ring transition-colors"
                >
                  <ListOrdered className="w-4 h-4" />
                </button>
              </div>

              {/* Right Action Buttons */}
              <div className="flex items-center gap-2">
                {replyText.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setReplyText('');
                      setErrorText(null);
                    }}
                    className="px-3 py-2 text-sm text-text-muted hover:text-text focus-ring rounded-md font-medium"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting || !replyText.trim()}
                  className="h-10 px-5 bg-primary hover:bg-primary-hover active:bg-primary-pressed disabled:opacity-50 disabled:pointer-events-none text-on-primary font-label text-sm font-medium rounded-md inline-flex items-center gap-2 focus-ring transition-colors"
                >
                  <Send className="w-4 h-4" />
                  {isSubmitting ? 'Sending…' : 'Send reply'}
                </button>
              </div>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}

function TicketDetailSkeleton() {
  return (
    <div className="w-full max-w-[760px] mx-auto pb-16 animate-pulse">
      <div className="h-4 w-32 bg-surface-sunken rounded mb-4" />
      <div className="h-3 w-16 bg-surface-sunken rounded mb-2" />
      <div className="h-8 w-3/4 bg-surface-sunken rounded mb-3" />
      <div className="h-4 w-1/2 bg-surface-sunken rounded mb-8" />
      <div className="h-32 w-full bg-surface-sunken rounded-md mb-8" />
      <div className="h-40 w-full bg-surface-sunken rounded-md mb-4" />
      <div className="h-48 w-full bg-surface-sunken rounded-md" />
    </div>
  );
}
