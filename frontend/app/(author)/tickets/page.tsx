'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Plus, Clock, MessageSquare, AlertCircle } from 'lucide-react';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { mockDb } from '@/lib/mock/db';
import { useAuth } from '@/lib/mock/auth-context';
import { Ticket, TicketStatus } from '@/lib/mock/types';
import { formatRelativeTime, formatTicketActivity } from '@/lib/formatters';

import { apiClient } from '@/lib/api-client';

const FILTER_TABS: (TicketStatus | 'All')[] = [
  'All',
  'Open',
  'In progress',
  'Resolved',
  'Closed',
];

export default function MyTicketsPage() {
  const { user } = useAuth();
  const authorId = user?.id || 'AUTH001';

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeFilter, setActiveFilter] = useState<TicketStatus | 'All'>('All');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentlyUpdatedId, setRecentlyUpdatedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(20);
  const prevTicketsHashRef = useRef<string>('');

  const loadTickets = useCallback(async () => {
    try {
      setError(null);
      let allAuthorTickets: Ticket[] = [];
      let fetchedFromLive = false;

      // 1. Try live API fetch from FastAPI backed by Neon PostgreSQL
      if (typeof window !== 'undefined') {
        try {
          const res = await apiClient.author.getTickets();
          if (res?.tickets && Array.isArray(res.tickets)) {
            allAuthorTickets = res.tickets;
            fetchedFromLive = true;
          }
        } catch {
          // Fall through to mockDb on network/offline errors
        }
      }

      // 2. Fallback to mockDb ONLY for offline or test environments when live fetch didn't succeed
      if (!fetchedFromLive) {
        allAuthorTickets = mockDb.getTickets({ authorId });
      }

      // Detect changed ticket for 1200ms highlight flash (Spec §2.3, §3.9)
      const newHash = JSON.stringify(
        allAuthorTickets.map((t) => `${t.id}-${t.updated_at}-${t.has_unread}`)
      );
      if (prevTicketsHashRef.current && prevTicketsHashRef.current !== newHash) {
        const changed = allAuthorTickets.find(
          (t) => !prevTicketsHashRef.current.includes(`${t.id}-${t.updated_at}`)
        );
        if (changed) {
          setRecentlyUpdatedId(changed.id);
          setTimeout(() => setRecentlyUpdatedId(null), 1200);
        }
      }
      prevTicketsHashRef.current = newHash;

      setTickets(allAuthorTickets);
    } catch (err) {
      console.error('Failed to load tickets:', err);
      setError('Couldn’t load your tickets. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [authorId]);

  useEffect(() => {
    loadTickets();

    // 1. Immediate reactive subscription to local DB modifications
    const unsubscribe = mockDb.subscribe(loadTickets);

    // 2. Real-time Server-Sent Events (SSE) from FastAPI event bus
    const eventSource = apiClient.author.createEventSource();
    if (eventSource) {
      eventSource.addEventListener('ticket.created', () => loadTickets());
      eventSource.addEventListener('ticket.updated', () => loadTickets());
      eventSource.addEventListener('message.created', () => loadTickets());
      eventSource.addEventListener('ticket.classified', () => loadTickets());
    }

    // 3. 10-second polling cadence for live updates heartbeat
    const pollInterval = setInterval(() => {
      loadTickets();
    }, 10000);

    return () => {
      unsubscribe();
      clearInterval(pollInterval);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [loadTickets]);

  // Compute status counts for filter badges dynamically
  const filterCounts = useMemo(() => {
    return {
      All: tickets.length,
      Open: tickets.filter((t) => t.status === 'Open').length,
      'In progress': tickets.filter((t) => t.status === 'In progress').length,
      Resolved: tickets.filter((t) => t.status === 'Resolved').length,
      Closed: tickets.filter((t) => t.status === 'Closed').length,
    };
  }, [tickets]);

  // Filter tickets by active tab
  const filteredTickets = useMemo(() => {
    if (activeFilter === 'All') return tickets;
    return tickets.filter((t) => t.status === activeFilter);
  }, [tickets, activeFilter]);

  // Handle "Show more" after 20 rows (Spec §5.4)
  const displayedTickets = useMemo(() => {
    return filteredTickets.slice(0, visibleCount);
  }, [filteredTickets, visibleCount]);

  return (
    <div className="w-full">
      {/* Editorial Page Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-border">
        <div className="space-y-1">
          <h1 className="font-title-page text-title-page text-text tracking-tight">
            My Tickets
          </h1>
          <p className="font-body text-body text-text-muted">
            Track your queries and replies from the BookLeaf editorial and publishing team.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/tickets/new"
            className="inline-flex items-center gap-1.5 h-10 px-4 bg-primary hover:bg-primary-hover active:bg-primary-pressed text-on-primary font-label text-label rounded-lg transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>New support query</span>
          </Link>
        </div>
      </div>

      {/* Error Alert Banner */}
      {error && (
        <div
          role="alert"
          className="my-6 p-4 bg-danger-tint border-l-[3px] border-l-danger rounded-r-md flex items-center justify-between text-danger"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="font-body text-body font-medium">{error}</p>
          </div>
          <button
            type="button"
            onClick={loadTickets}
            className="px-3 py-1 bg-surface border border-danger/30 text-danger hover:bg-surface-sunken text-caption font-label rounded font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-danger"
          >
            Try again
          </button>
        </div>
      )}

      {/* Filter Bar & Auto-Polling Status Area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 my-6">
        {/* Segmented Filter Buttons */}
        <div
          role="tablist"
          aria-label="Filter tickets by status"
          className="inline-flex p-1 bg-surface border border-border rounded-lg items-center text-label overflow-x-auto max-w-full"
        >
          {FILTER_TABS.map((status) => {
            const isActive = activeFilter === status;
            const count = filterCounts[status];
            return (
              <button
                key={status}
                role="tab"
                type="button"
                aria-selected={isActive}
                aria-controls="ticket-list-region"
                onClick={() => {
                  setActiveFilter(status);
                  setVisibleCount(20);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-caption sm:text-label transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-primary ${
                  isActive
                    ? 'bg-primary-tint text-primary'
                    : 'text-text-muted hover:text-text hover:bg-surface-sunken'
                }`}
              >
                <span>{status}</span>
                <span
                  className={`text-caption px-1.5 py-0.5 rounded bg-surface border border-border font-figure tabular-nums ${
                    isActive ? 'text-primary' : 'text-text-muted'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Live Polling Caption Indicator */}
        <div className="flex items-center gap-2 text-caption font-caption text-text-muted self-start sm:self-auto py-1 shrink-0">
          <span
            className="w-2 h-2 rounded-full bg-primary animate-pulse"
            aria-hidden="true"
          />
          <span>Live updates enabled • Polling every 10s</span>
        </div>
      </div>

      {/* Ticket List / Empty State / Loading */}
      {isLoading ? (
        <div className="bg-surface border border-border rounded-xl divide-y divide-border animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-5 space-y-3">
              <div className="flex justify-between items-center">
                <div className="h-5 w-2/3 bg-surface-sunken rounded" />
                <div className="h-6 w-20 bg-surface-sunken rounded" />
              </div>
              <div className="h-4 w-1/3 bg-surface-sunken rounded" />
            </div>
          ))}
        </div>
      ) : tickets.length === 0 ? (
        /* Overall Zero Tickets Empty State (Stitch Screen 5) */
        <EmptyState />
      ) : filteredTickets.length === 0 ? (
        /* Filtered Empty State (Spec §5.4) */
        <EmptyState
          isFilterEmpty={true}
          title={`No ${activeFilter.toLowerCase()} tickets`}
          description={`There are currently no support queries matching the "${activeFilter}" status filter.`}
          actionLabel="Show all tickets"
          onAction={() => setActiveFilter('All')}
          showTopics={false}
        />
      ) : (
        /* Divided Ticket List Container (Stitch Screen 4) */
        <div
          id="ticket-list-region"
          role="region"
          aria-label={`${activeFilter} tickets list`}
          className="bg-surface border border-border rounded-xl overflow-hidden divide-y divide-border"
        >
          {displayedTickets.map((ticket) => {
            const activity = formatTicketActivity(ticket);
            const isUnread = ticket.has_unread;
            const isClosed = ticket.status === 'Closed';
            const isHighlighted = recentlyUpdatedId === ticket.id;

            return (
              <article
                key={ticket.id}
                className={`relative group transition-colors duration-150 p-5 cursor-pointer block ${
                  isHighlighted ? 'bg-primary-tint/60' : 'hover:bg-surface-sunken/60'
                } ${isClosed ? 'bg-surface' : ''}`}
              >
                {/* Line 1: Subject (Left) and Status Badge (Right) */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                  <div
                    className={`flex items-start md:items-center gap-2.5 min-w-0 ${
                      isUnread ? '' : 'pl-[18px]'
                    }`}
                  >
                    {isUnread && (
                      <span
                        className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2 md:mt-0"
                        title="Unread update"
                      >
                        <span className="sr-only">New reply</span>
                      </span>
                    )}
                    <h2
                      className={`font-body-lg text-body-lg transition-colors line-clamp-2 md:line-clamp-1 truncate ${
                        isUnread
                          ? 'font-semibold text-text group-hover:text-primary'
                          : isClosed
                          ? 'font-medium text-text-muted group-hover:text-text'
                          : 'font-medium text-text group-hover:text-primary'
                      }`}
                    >
                      {/* Whole-Row Accessible Link via ::after */}
                      <Link
                        href={`/tickets/${ticket.id}`}
                        className="focus:outline-none after:absolute after:inset-0 after:content-[''] after:z-10"
                      >
                        {ticket.subject}
                      </Link>
                    </h2>
                  </div>

                  {/* Status Badge */}
                  <div className="shrink-0 self-start md:self-center z-20">
                    <StatusBadge status={ticket.status} />
                  </div>
                </div>

                {/* Line 2: Metadata & Last Activity */}
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-y-2 text-caption font-caption text-text-muted pl-[18px]">
                  {/* Left metadata */}
                  <div className="flex items-center gap-3">
                    <span
                      className={`font-figure font-medium tabular-nums ${
                        isClosed ? 'text-text-muted' : 'text-text'
                      }`}
                    >
                      {ticket.id}
                    </span>
                    <span className="text-border-strong" aria-hidden="true">
                      •
                    </span>
                    <span>
                      {ticket.book_title ? (
                        <>
                          About{' '}
                          <em
                            className={`italic font-normal ${
                              isClosed ? 'text-text-muted' : 'text-text'
                            }`}
                          >
                            {ticket.book_title}
                          </em>
                        </>
                      ) : (
                        'General / account level'
                      )}
                    </span>
                    {ticket.category && (
                      <>
                        <span
                          className="hidden sm:inline text-border-strong"
                          aria-hidden="true"
                        >
                          •
                        </span>
                        <span className="hidden sm:inline bg-surface-sunken px-2 py-0.5 rounded text-[11px] text-text-muted uppercase tracking-wider font-semibold">
                          {ticket.category}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Right activity */}
                  <div
                    className={`flex items-center gap-1.5 ${
                      activity.isOfficialReply
                        ? 'font-medium text-text'
                        : 'text-text-muted'
                    }`}
                  >
                    {activity.isOfficialReply && (
                      <MessageSquare
                        className="w-4 h-4 text-text-muted shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    <span>
                      {activity.text}
                      {activity.isAwaiting && (
                        <span className="text-secondary font-medium">
                          Awaiting coordinator
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Show more button if list exceeds 20 items (Spec §5.4) */}
      {!isLoading && filteredTickets.length > visibleCount && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setVisibleCount((prev) => prev + 20)}
            className="px-4 py-2 bg-surface hover:bg-surface-sunken border border-border rounded-lg text-label text-text font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
          >
            Show more ({filteredTickets.length - visibleCount} remaining)
          </button>
        </div>
      )}

      {/* Editorial SLA Info Callout Strip (Stitch Screen 4 & 5 Parity) */}
      <div className="mt-6 p-4 rounded-lg bg-surface border border-border flex items-start gap-3.5">
        <Clock
          className="w-5 h-5 text-primary mt-0.5 shrink-0"
          aria-hidden="true"
        />
        <div className="text-caption font-caption text-text-muted space-y-0.5">
          <p className="font-medium text-text">Editorial Help Desk SLA</p>
          <p>
            Responses from BookLeaf publishing coordinators typically take 12 to 24 business hours. We aim to reply within 48 hours for complex technical or distribution queries.
          </p>
        </div>
      </div>
    </div>
  );
}
