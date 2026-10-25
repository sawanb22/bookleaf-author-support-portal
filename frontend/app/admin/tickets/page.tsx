'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  ArrowUpDown,
  ArrowDown,
  ArrowUp,
  Sparkles,
  Clock,
  CheckCheck,
  CheckCircle,
  Edit2,
  Lock,
  X,
  Keyboard,
  CheckSquare,
  Square,
  MinusSquare,
  Send,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { mockDb } from '@/lib/mock/db';
import { Ticket, TicketStatus, TicketPriority, AdminMetric } from '@/lib/mock/types';
import { MetricCards } from '@/components/admin/MetricCards';
import { PriorityGlyph } from '@/components/admin/PriorityGlyph';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatRelativeTime } from '@/lib/formatters';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/mock/auth-context';

type StatusFilterTab = 'All' | 'Unassigned' | 'Open' | 'In progress' | 'Resolved';

type SortField = 'urgency' | 'id' | 'updated_at' | 'priority' | 'sla';
type SortDirection = 'asc' | 'desc';

export default function AdminTicketsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const currentAdmin = user?.name || 'Rahul';
  const currentInitials = user?.avatar_initials || 'RS';

  // Reactive DB data
  const [tickets, setTickets] = useState<Ticket[]>(() => mockDb.getTickets());
  const [metrics, setMetrics] = useState<AdminMetric>(() => mockDb.getAdminMetrics());

  // Filter states
  const [activeTab, setActiveTab] = useState<StatusFilterTab>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [priorityFilter, setPriorityFilter] = useState('All Priorities');

  // Sorting: Default to urgency (Critical oldest first -> High oldest -> Medium -> Low)
  const [sortField, setSortField] = useState<SortField>('urgency');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Keyboard navigation
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  // Live updates notification pill simulation
  const [newTicketsPillCount, setNewTicketsPillCount] = useState<number>(0);
  const [liveHighlightTicketId, setLiveHighlightTicketId] = useState<string | null>(null);

  // Quick preview slide-over drawer
  const [previewTicketId, setPreviewTicketId] = useState<string | null>(null);
  const [drawerReplyText, setDrawerReplyText] = useState('');
  const [isSendingDrawerReply, setIsSendingDrawerReply] = useState(false);

  // Synchronize with live FastAPI backend backed by Neon PostgreSQL
  const refreshFromDb = useCallback(async () => {
    if (typeof window !== 'undefined') {
      try {
        const [queueRes, statsRes] = await Promise.all([
          apiClient.admin.getQueue().catch(() => null),
          apiClient.admin.getStats().catch(() => null),
        ]);
        if (queueRes?.items && Array.isArray(queueRes.items)) {
          setTickets(queueRes.items);
        } else {
          setTickets(mockDb.getTickets());
        }
        if (statsRes) {
          setMetrics({
            total_in_queue: statsRes.total_in_queue,
            needs_first_reply: statsRes.needs_first_reply,
            near_sla_breach_count: (statsRes as any).near_sla_breach_count ?? 0,
            awaiting_author: statsRes.awaiting_author,
            ai_draft_ready: statsRes.ai_draft_ready,
            resolved_today: statsRes.resolved_today,
            sla_compliance_rate: (statsRes as any).sla_compliance_rate ?? 100,
          });
        } else {
          setMetrics(mockDb.getAdminMetrics());
        }
        return;
      } catch {
        // Fall through to mockDb on offline/network errors
      }
    }

    setTickets(mockDb.getTickets());
    setMetrics(mockDb.getAdminMetrics());
  }, []);

  useEffect(() => {
    refreshFromDb();
    const unsubscribe = mockDb.subscribe(refreshFromDb);

    // Live Server-Sent Events from FastAPI event bus
    const eventSource = apiClient.admin.createEventSource();
    if (eventSource) {
      eventSource.addEventListener('ticket.created', () => {
        setNewTicketsPillCount((prev) => prev + 1);
        refreshFromDb();
      });
      eventSource.addEventListener('ticket.updated', () => refreshFromDb());
      eventSource.addEventListener('message.created', () => refreshFromDb());
      eventSource.addEventListener('ticket.classified', () => refreshFromDb());
    }

    const interval = setInterval(refreshFromDb, 10000); // 10s polling cadence

    return () => {
      unsubscribe();
      clearInterval(interval);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [refreshFromDb]);

  // Handle Live Notification Pill click (Merge new tickets)
  const handleShowNewTickets = () => {
    setNewTicketsPillCount(0);
    refreshFromDb();
    if (tickets.length > 0) {
      setLiveHighlightTicketId(tickets[0].id);
      setTimeout(() => setLiveHighlightTicketId(null), 2000);
    }
  };

  // Self-assignment action
  const handleAssignToMe = useCallback(
    async (e: React.MouseEvent, ticketId: string) => {
      e.stopPropagation();
      if (typeof window !== 'undefined') {
        try {
          await apiClient.admin.updateTicket(ticketId, { assignee: currentAdmin });
        } catch {}
      }
      mockDb.assignTicket(ticketId, currentAdmin, currentInitials);
      refreshFromDb();
    },
    [refreshFromDb, currentAdmin, currentInitials]
  );

  // Compute status counts for tabs
  const tabCounts = useMemo(() => {
    return {
      all: tickets.length,
      unassigned: tickets.filter((t) => !t.assignee).length,
      open: tickets.filter((t) => t.status === 'Open').length,
      inProgress: tickets.filter((t) => t.status === 'In progress').length,
      resolved: tickets.filter((t) => t.status === 'Resolved').length,
    };
  }, [tickets]);

  // Filtered & Sorted tickets
  const filteredTickets = useMemo(() => {
    let result = [...tickets];

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
      const cleanPriority = priorityFilter.split(' ')[0]; // Handle "Critical (4 bars)"
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

    // Sorting
    result.sort((a, b) => {
      if (sortField === 'urgency') {
        const urgencyOrder: Record<string, number> = {
          Critical: 1,
          High: 2,
          Medium: 3,
          Low: 4,
        };
        const isUnresolvedA = a.status !== 'Resolved' && a.status !== 'Closed' ? 1 : 2;
        const isUnresolvedB = b.status !== 'Resolved' && b.status !== 'Closed' ? 1 : 2;
        if (isUnresolvedA !== isUnresolvedB) return isUnresolvedA - isUnresolvedB;

        const pA = urgencyOrder[a.priority] || 5;
        const pB = urgencyOrder[b.priority] || 5;
        if (pA !== pB) {
          return sortDirection === 'asc' ? pA - pB : pB - pA;
        }
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        return timeA - timeB; // oldest first
      }
      if (sortField === 'id') {
        const numA = parseInt(a.id.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(b.id.replace(/\D/g, ''), 10) || 0;
        return sortDirection === 'asc' ? numA - numB : numB - numA;
      }
      if (sortField === 'priority') {
        const order: Record<TicketPriority, number> = {
          Critical: 4,
          High: 3,
          Medium: 2,
          Low: 1,
        };
        const pA = order[a.priority as TicketPriority] || 0;
        const pB = order[b.priority as TicketPriority] || 0;
        return sortDirection === 'asc' ? pA - pB : pB - pA;
      }
      if (sortField === 'sla') {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        return sortDirection === 'asc' ? timeA - timeB : timeB - timeA;
      }
      // Default: updated_at
      const timeA = new Date(a.updated_at).getTime();
      const timeB = new Date(b.updated_at).getTime();
      return sortDirection === 'asc' ? timeA - timeB : timeB - timeA;
    });

    return result;
  }, [tickets, activeTab, categoryFilter, priorityFilter, searchQuery, sortField, sortDirection]);

  // Bulk selection handlers
  const isAllSelected =
    filteredTickets.length > 0 &&
    filteredTickets.every((t) => selectedIds.has(t.id));
  const isSomeSelected =
    selectedIds.size > 0 && !isAllSelected;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTickets.map((t) => t.id)));
    }
  };

  const handleToggleSelectRow = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBulkAssignToMe = async () => {
    const ids = Array.from(selectedIds);
    if (typeof window !== 'undefined') {
      await Promise.all(
        ids.map((id) =>
          apiClient.admin.updateTicket(id, { assignee: currentAdmin }).catch(() => null)
        )
      );
    }
    ids.forEach((id) => {
      mockDb.assignTicket(id, currentAdmin, currentInitials);
    });
    setSelectedIds(new Set());
    refreshFromDb();
  };

  const handleBulkMarkResolved = async () => {
    const ids = Array.from(selectedIds);
    if (typeof window !== 'undefined') {
      await Promise.all(
        ids.map((id) =>
          apiClient.admin.updateTicket(id, { status: 'Resolved' }).catch(() => null)
        )
      );
    }
    ids.forEach((id) => {
      mockDb.updateTicketStatus(id, 'Resolved');
    });
    setSelectedIds(new Set());
    refreshFromDb();
  };

  // Keyboard navigation: J, K, Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === 'j' || e.key === 'J' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => {
          const next = prev < filteredTickets.length - 1 ? prev + 1 : prev;
          rowRefs.current[next]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          return next;
        });
      } else if (e.key === 'k' || e.key === 'K' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : 0;
          rowRefs.current[next]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          return next;
        });
      } else if (e.key === 'Enter' && focusedIndex >= 0 && focusedIndex < filteredTickets.length) {
        e.preventDefault();
        const targetTicket = filteredTickets[focusedIndex];
        if (targetTicket) {
          setPreviewTicketId(targetTicket.id);
        }
      } else if (e.key === 'Escape') {
        if (previewTicketId) {
          setPreviewTicketId(null);
        } else if (selectedIds.size > 0) {
          setSelectedIds(new Set());
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedIndex, filteredTickets, previewTicketId, selectedIds]);

  // Preview ticket details
  const previewTicket = useMemo(() => {
    if (!previewTicketId) return null;
    return tickets.find((t) => t.id === previewTicketId) || null;
  }, [previewTicketId, tickets]);

  const handleSendDrawerReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!previewTicketId || !drawerReplyText.trim()) return;

    setIsSendingDrawerReply(true);
    try {
      if (typeof window !== 'undefined') {
        try {
          await apiClient.admin.sendMessage(previewTicketId, drawerReplyText.trim());
        } catch {}
      }
      mockDb.addMessage(previewTicketId, {
        sender_name: `${currentAdmin}, BookLeaf support`,
        sender_role: 'support',
        body: drawerReplyText.trim(),
      });
      setDrawerReplyText('');
      refreshFromDb();
    } finally {
      setIsSendingDrawerReply(false);
    }
  };

  // Helper for SLA calculations
  const getSlaIndicator = (ticket: Ticket) => {
    if (ticket.status === 'Resolved' || ticket.status === 'Closed') {
      return {
        main: 'Resolved',
        sub: 'Turnaround: 18h',
        color: 'text-text-muted',
        icon: null,
      };
    }

    const createdTime = new Date(ticket.created_at).getTime();
    const now = new Date().getTime();
    const hoursElapsed = Math.floor((now - createdTime) / (1000 * 60 * 60));
    const targetHours = ticket.sla_target_hours || 48;
    const hoursRemaining = targetHours - hoursElapsed;

    if (ticket.priority === 'Critical' || hoursRemaining <= 6) {
      return {
        main: `Approaching SLA (${hoursElapsed}h)`,
        sub: `${Math.max(1, hoursRemaining)}h left of ${targetHours}h limit`,
        color: 'text-priority-critical-text font-semibold',
        icon: 'warning',
      };
    }

    if (hoursRemaining <= 24) {
      return {
        main: `Reply due in ${hoursRemaining}h`,
        sub: `Opened ${hoursElapsed}h ago`,
        color: 'text-priority-high-text font-medium',
        icon: 'schedule',
      };
    }

    return {
      main: `Opened ${hoursElapsed}h ago`,
      sub: `${hoursRemaining}h SLA cushion`,
      color: 'text-text font-normal',
      icon: null,
    };
  };

  const getAgeBadge = (ticket: Ticket) => {
    if (ticket.status === 'Resolved' || ticket.status === 'Closed') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-surface-sunken text-text-muted border border-border">
          Resolved
        </span>
      );
    }
    const createdTime = new Date(ticket.created_at).getTime();
    const now = new Date().getTime();
    const hoursElapsed = Math.max(0, Math.floor((now - createdTime) / (1000 * 60 * 60)));

    if (hoursElapsed >= 72) {
      return (
        <span
          data-testid="age-badge-red"
          className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-red-100 text-red-900 border border-red-300"
          title={`Aging ticket: ${hoursElapsed}h unresolved (>= 72h)`}
        >
          <Clock className="w-3 h-3 mr-1 text-red-700" />
          <span>{hoursElapsed}h old</span>
        </span>
      );
    }
    if (hoursElapsed >= 24) {
      return (
        <span
          data-testid="age-badge-amber"
          className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-100 text-amber-900 border border-amber-300"
          title={`Aging ticket: ${hoursElapsed}h unresolved (>= 24h)`}
        >
          <Clock className="w-3 h-3 mr-1 text-amber-700" />
          <span>{hoursElapsed}h old</span>
        </span>
      );
    }
    return (
      <span
        data-testid="age-badge-normal"
        className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-normal bg-surface-sunken text-text-muted border border-border"
        title={`Ticket age: ${hoursElapsed}h`}
      >
        <Clock className="w-3 h-3 mr-1 text-text-subtle" />
        <span>{hoursElapsed}h old</span>
      </span>
    );
  };

  const getAiAssistBadge = (ticket: Ticket) => {
    const status = ticket.ai_assist_status || 'Reviewing';
    if (status === 'Draft ready') {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium bg-status-open-bg text-status-open-text border border-status-open-text/10">
          <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Draft ready</span>
        </span>
      );
    }
    if (status === 'Reviewing') {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium bg-surface-sunken text-text-muted border border-border">
          <Clock className="w-3.5 h-3.5 text-text-subtle" aria-hidden="true" />
          <span>Reviewing</span>
        </span>
      );
    }
    if (status === 'Draft sent') {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium bg-surface-sunken text-text border border-border">
          <CheckCheck className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
          <span>Draft sent</span>
        </span>
      );
    }
    if (status === 'Resolved via AI draft') {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium bg-status-resolved-bg text-status-resolved-text border border-status-resolved-text/10">
          <CheckCircle className="w-3.5 h-3.5 text-status-resolved-text" aria-hidden="true" />
          <span>Resolved via AI</span>
        </span>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* 1. Page Header & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="font-title-page text-title-page text-text tracking-tight">
              Support Queue
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-sunken text-text-muted border border-border tabular-nums">
              {metrics.total_in_queue} active
            </span>
          </div>
          <p className="font-body text-body text-text-muted mt-1 max-w-2xl">
            Manage inbound author queries, verify AI classifications, and track response SLAs against publishing deadlines.
          </p>
        </div>

        {/* Quick Bulk Actions / Reset Header Controls */}
        <div className="flex items-center space-x-3 shrink-0">
          {selectedIds.size > 0 ? (
            <div className="flex items-center space-x-2 bg-primary-tint border border-primary/30 px-3 py-1.5 rounded-md animate-in fade-in duration-150">
              <span className="text-xs font-medium text-primary tabular-nums">
                {selectedIds.size} selected
              </span>
              <button
                type="button"
                onClick={handleBulkAssignToMe}
                className="text-xs bg-primary text-on-primary hover:bg-primary-hover px-2.5 py-1 rounded transition-colors"
              >
                Assign to me
              </button>
              <button
                type="button"
                onClick={handleBulkMarkResolved}
                className="text-xs bg-surface text-text hover:bg-surface-sunken border border-border px-2 py-1 rounded transition-colors"
              >
                Resolve
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-text-muted hover:text-text p-1"
                title="Deselect all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter('All Categories');
                  setPriorityFilter('All Priorities');
                  setActiveTab('All');
                  setSearchQuery('');
                }}
                className="inline-flex items-center space-x-1.5 h-10 px-3.5 bg-surface border border-border rounded text-text font-label text-sm hover:bg-surface-sunken hover:border-border-strong transition-colors"
              >
                <span>Reset filters</span>
              </button>
              <button
                type="button"
                onClick={refreshFromDb}
                className="inline-flex items-center space-x-1.5 h-10 px-3.5 bg-surface border border-border rounded text-text font-label text-sm hover:bg-surface-sunken hover:border-border-strong transition-colors"
              >
                <span>Refresh queue</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2. 5 KPI Metric Cards Banner */}
      <MetricCards
        metrics={metrics}
        onFilterClick={(type) => {
          if (type === 'needs_reply') {
            setActiveTab('Open');
          } else if (type === 'awaiting_author') {
            setActiveTab('In progress');
          } else if (type === 'resolved') {
            setActiveTab('Resolved');
          } else {
            setActiveTab('All');
          }
        }}
      />

      {/* 3. Filter Bar & Live Polling Status */}
      <div className="bg-surface border border-border rounded p-3 space-y-3">
        {/* Top Sub-row: Status Filter Tabs and Live Polling Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border/70 pb-3">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5" role="tablist">
            {(
              [
                ['All', tabCounts.all],
                ['Unassigned', tabCounts.unassigned],
                ['Open', tabCounts.open],
                ['In progress', tabCounts.inProgress],
                ['Resolved', tabCounts.resolved],
              ] as [StatusFilterTab, number][]
            ).map(([tab, count]) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded text-xs font-medium font-label transition-colors tabular-nums ${
                    isActive
                      ? 'bg-text text-surface font-semibold shadow-xs'
                      : 'bg-surface hover:bg-surface-sunken text-text-muted hover:text-text border border-transparent hover:border-border'
                  }`}
                >
                  {tab} ({count})
                </button>
              );
            })}
          </div>

          {/* Live Updates Notification Pill per §3.9 */}
          <div className="flex items-center space-x-2 text-xs font-caption text-text-muted shrink-0 bg-surface-sunken border border-border px-2.5 py-1 rounded">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />
            <span>Live updates active • Polling every 10s</span>
            {newTicketsPillCount > 0 && (
              <>
                <span className="text-border-strong">|</span>
                <button
                  type="button"
                  onClick={handleShowNewTickets}
                  className="bg-primary-tint text-primary border border-primary/20 rounded-full py-0.5 px-2 font-medium hover:bg-primary/20 transition-colors inline-flex items-center space-x-1"
                >
                  <span>{newTicketsPillCount} new tickets. Show</span>
                  <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Bottom Sub-row: Search, Category, and Priority Filters */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
              <Search className="w-4 h-4" aria-hidden="true" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ticket ID, author name, or book title..."
              className="block w-full h-10 pl-9 pr-8 text-sm font-body text-text bg-surface border border-border rounded focus:border-primary focus:ring-0 placeholder:text-text-muted"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-text-muted hover:text-text"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <div className="w-full md:w-56 shrink-0">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter by category"
              className="block w-full h-10 px-3 text-sm font-label text-text bg-surface border border-border rounded focus:border-primary focus:ring-0 cursor-pointer"
            >
              <option value="All Categories">All Categories</option>
              <option value="Royalty & Payments">Royalty &amp; Payments</option>
              <option value="Production & Proofs">Production &amp; Proofs</option>
              <option value="ISBN & Distribution">ISBN &amp; Distribution</option>
              <option value="Author Copies">Author Copies</option>
              <option value="Cover & Design">Cover &amp; Design</option>
              <option value="General Inquiry">General Inquiry</option>
            </select>
          </div>

          {/* Priority Dropdown */}
          <div className="w-full md:w-44 shrink-0">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              aria-label="Filter by priority"
              className="block w-full h-10 px-3 text-sm font-label text-text bg-surface border border-border rounded focus:border-primary focus:ring-0 cursor-pointer"
            >
              <option value="All Priorities">All Priorities</option>
              <option value="Critical">Critical (4 bars)</option>
              <option value="High">High (3 bars)</option>
              <option value="Medium">Medium (2 bars)</option>
              <option value="Low">Low (1 bar)</option>
            </select>
          </div>

          {/* Clear Filter Ghost Action */}
          {(searchQuery || categoryFilter !== 'All Categories' || priorityFilter !== 'All Priorities' || activeTab !== 'All') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setCategoryFilter('All Categories');
                setPriorityFilter('All Priorities');
                setActiveTab('All');
              }}
              className="px-2.5 h-10 text-xs text-text-muted hover:text-text font-medium flex items-center justify-center transition-colors whitespace-nowrap"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* 4. High-Density Operational Table */}
      <div className="bg-surface border border-border rounded overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            {/* Table Header: sunken #EDF1EF */}
            <thead>
              <tr className="bg-surface-sunken border-b border-border text-text-muted font-label text-xs uppercase tracking-wider select-none">
                {/* Bulk Select Checkbox */}
                <th className="py-3 pl-4 pr-2 w-10" scope="col">
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    aria-label={isAllSelected ? 'Deselect all rows' : 'Select all rows'}
                    className="p-1 -m-1 text-text hover:text-primary focus:outline-none"
                  >
                    {isAllSelected ? (
                      <CheckSquare className="w-4 h-4 text-primary" />
                    ) : isSomeSelected ? (
                      <MinusSquare className="w-4 h-4 text-primary" />
                    ) : (
                      <Square className="w-4 h-4 text-border-strong" />
                    )}
                  </button>
                </th>

                {/* Ticket & Subject (Sortable) */}
                <th className="py-3 px-3 min-w-[300px]" scope="col">
                  <button
                    type="button"
                    onClick={() => {
                      if (sortField === 'id') {
                        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                      } else {
                        setSortField('id');
                        setSortDirection('asc');
                      }
                    }}
                    className="flex items-center space-x-1 group uppercase text-left hover:text-text focus:outline-none"
                  >
                    <span>Ticket &amp; Subject</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-text-subtle group-hover:text-text" />
                  </button>
                </th>

                {/* Author & Book */}
                <th className="py-3 px-3 min-w-[190px]" scope="col">
                  <span>Author &amp; Book</span>
                </th>

                {/* Category */}
                <th className="py-3 px-3 min-w-[170px]" scope="col">
                  <span>Category</span>
                </th>

                {/* Priority (Sortable) */}
                <th className="py-3 px-3 w-32" scope="col">
                  <button
                    type="button"
                    onClick={() => {
                      if (sortField === 'urgency') {
                        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                      } else {
                        setSortField('urgency');
                        setSortDirection('asc');
                      }
                    }}
                    className="flex items-center space-x-1 group uppercase hover:text-text focus:outline-none"
                  >
                    <span>Priority</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-text-subtle group-hover:text-text" />
                  </button>
                </th>

                {/* Status */}
                <th className="py-3 px-3 w-32" scope="col">
                  <span>Status</span>
                </th>

                {/* AI Assist */}
                <th className="py-3 px-3 min-w-[140px]" scope="col">
                  <span>AI Assist</span>
                </th>

                {/* SLA / Age (Sortable) */}
                <th className="py-3 px-3 min-w-[150px]" scope="col">
                  <button
                    type="button"
                    onClick={() => {
                      if (sortField === 'sla') {
                        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                      } else {
                        setSortField('sla');
                        setSortDirection('asc');
                      }
                    }}
                    className="flex items-center space-x-1 group uppercase hover:text-text focus:outline-none"
                  >
                    <span>SLA / Age</span>
                    {sortField === 'sla' ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-primary" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-text-subtle group-hover:text-text" />
                    )}
                  </button>
                </th>

                {/* Assignee */}
                <th className="py-3 pl-3 pr-4 min-w-[140px] text-right" scope="col">
                  <span>Assignee</span>
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-border text-sm">
              {filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 px-4 text-center">
                    <div className="max-w-md mx-auto space-y-3">
                      <p className="font-serif text-title-section text-text">
                        No tickets found
                      </p>
                      <p className="font-body text-sm text-text-muted">
                        There are no support tickets matching your current filter criteria.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setCategoryFilter('All Categories');
                          setPriorityFilter('All Priorities');
                          setActiveTab('All');
                        }}
                        className="inline-flex items-center px-4 py-2 bg-primary text-on-primary rounded text-sm font-medium hover:bg-primary-hover transition-colors"
                      >
                        Reset filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTickets.map((ticket, index) => {
                  const isSelected = selectedIds.has(ticket.id);
                  const isFocused = focusedIndex === index;
                  const isLiveHighlight = liveHighlightTicketId === ticket.id;
                  const isCritical = ticket.priority === 'Critical';
                  const sla = getSlaIndicator(ticket);

                  return (
                    <tr
                      key={ticket.id}
                      ref={(el) => {
                        rowRefs.current[index] = el;
                      }}
                      onClick={() => setPreviewTicketId(ticket.id)}
                      className={`group transition-colors duration-150 cursor-pointer ${
                        isLiveHighlight
                          ? 'bg-primary-tint/70 animate-pulse'
                          : isSelected
                          ? 'bg-primary-tint/40'
                          : isFocused
                          ? 'bg-primary-tint/50 ring-2 ring-primary ring-inset'
                          : isCritical
                          ? 'bg-priority-critical-bg/20 hover:bg-priority-critical-bg/35'
                          : 'hover:bg-surface-sunken/60'
                      }`}
                    >
                      {/* Checkbox */}
                      <td
                        className="py-3.5 pl-4 pr-2 align-top"
                        onClick={(e) => handleToggleSelectRow(e, ticket.id)}
                      >
                        <button
                          type="button"
                          aria-label={`Select ticket ${ticket.id}`}
                          className="p-1 -m-1 text-text hover:text-primary focus:outline-none"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-primary" />
                          ) : (
                            <Square className="w-4 h-4 text-border-strong group-hover:text-text" />
                          )}
                        </button>
                      </td>

                      {/* Ticket & Subject */}
                      <td className="py-3.5 px-3 align-top">
                        <div className="flex items-start space-x-2">
                          {ticket.has_unread ? (
                            <span
                              className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0"
                              title="Unread author response"
                            />
                          ) : isCritical ? (
                            <span
                              className="w-2 h-2 rounded-full bg-danger mt-1.5 shrink-0"
                              title="Critical urgency"
                            />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-transparent mt-1.5 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono text-xs font-semibold text-text tabular-nums">
                                {ticket.id}
                              </span>
                              <span
                                className={`text-caption font-caption ${
                                   isCritical
                                    ? 'text-danger font-medium'
                                    : 'text-text-subtle'
                                }`}
                              >
                                {isCritical
                                  ? 'Critical SLA'
                                  : ticket.channel === 'Email sync'
                                  ? 'Email sync'
                                  : 'via Portal'}
                              </span>
                            </div>
                            <span className="font-medium text-text group-hover:text-primary transition-colors block mt-0.5 line-clamp-1">
                              {ticket.subject}
                            </span>
                            <p className="text-caption font-caption text-text-muted line-clamp-1 mt-0.5">
                              &ldquo;{ticket.description}&rdquo;
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Author & Book */}
                      <td className="py-3.5 px-3 align-top">
                        <div className="font-medium text-text">{ticket.author_name}</div>
                        <div className="font-serif text-xs text-text-muted italic truncate max-w-[180px]">
                          {ticket.book_title || 'General inquiry'}
                        </div>
                      </td>

                      {/* Category with AI Override Marker */}
                      <td className="py-3.5 px-3 align-top">
                        <div>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-label bg-surface border border-border text-text">
                            {ticket.category}
                          </span>
                          {(ticket.category_overridden || ticket.priority_overridden) && (
                            <div
                              className="flex items-center space-x-1 text-[11px] text-text-subtle mt-1"
                              title={`Changed from AI suggestion: ${
                                ticket.original_ai_category || 'Royalty & Payments'
                              }`}
                            >
                              <Edit2 className="w-3 h-3 text-text-muted" aria-hidden="true" />
                              <span>Changed from AI</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Priority Glyph (4 vertical bars) */}
                      <td className="py-3.5 px-3 align-top">
                        <PriorityGlyph priority={ticket.priority} />
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-3 align-top">
                        <StatusBadge status={ticket.status} />
                      </td>

                      {/* AI Assist Status */}
                      <td className="py-3.5 px-3 align-top">
                        {getAiAssistBadge(ticket)}
                      </td>

                      {/* SLA / Age */}
                      <td className="py-3.5 px-3 align-top">
                        {getAgeBadge(ticket)}
                        <div className={`text-xs ${sla.color} tabular-nums flex items-center space-x-1 mt-1`}>
                          <span>{sla.main}</span>
                        </div>
                        <div className="text-[11px] font-caption text-text-subtle mt-0.5 tabular-nums">
                          {sla.sub}
                        </div>
                      </td>

                      {/* Assignee / Quick Self-Assignment Action */}
                      <td className="py-3.5 pl-3 pr-4 align-top text-right">
                        {ticket.assignee ? (
                          <div className="inline-flex items-center justify-end">
                            <span className="text-xs font-medium text-text">
                              {ticket.assignee}
                            </span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => handleAssignToMe(e, ticket.id)}
                            className="text-xs text-primary font-medium hover:bg-primary-tint px-2 py-1 rounded transition-colors border border-primary/20"
                          >
                            Assign to me
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 5. Table Footer & Pagination / Keyboard Navigation Helper */}
        <div className="bg-surface border-t border-border px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-caption text-text-muted">
          {/* Left: Count and Keyboard Tip */}
          <div className="flex items-center space-x-4">
            <span className="tabular-nums">
              Showing <strong className="font-medium text-text">1–{filteredTickets.length}</strong> of{' '}
              <strong className="font-medium text-text">{tickets.length}</strong> tickets
            </span>
            <span className="hidden md:inline-flex items-center space-x-1.5 bg-surface-sunken px-2 py-0.5 rounded text-[11px] text-text-subtle border border-border">
              <Keyboard className="w-3.5 h-3.5 text-text-subtle" aria-hidden="true" />
              <span>
                Tip: Press <kbd className="font-mono text-text bg-white px-1 border border-border rounded">J</kbd>/
                <kbd className="font-mono text-text bg-white px-1 border border-border rounded">K</kbd> to navigate,{' '}
                <kbd className="font-mono text-text bg-white px-1 border border-border rounded">Enter</kbd> to open
              </span>
            </span>
          </div>

          {/* Right: Operational Status */}
          <div className="flex items-center space-x-3">
            <span className="text-text-subtle">SLA Target: 48h Resolution</span>
            <span className="w-1 h-1 rounded-full bg-border-strong" aria-hidden="true" />
            <span className="tabular-nums">{metrics.sla_compliance_rate}% SLA Compliant</span>
          </div>
        </div>
      </div>

      {/* 6. Internal Operational Notification Strip per Design Spec §3.6 */}
      <div className="bg-surface-sunken border border-dashed border-border-strong rounded p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs font-body text-text-muted">
        <div className="flex items-center space-x-2.5">
          <Lock className="w-4 h-4 text-text-subtle shrink-0" aria-hidden="true" />
          <span>
            <strong className="font-medium text-text">SLA Reminder:</strong> Next SLA audit batch occurs at 18:00 IST. Ensure AI-drafted responses for high priority royalty queries are authorized before print pipeline cutoff.
          </span>
        </div>
        <span className="font-caption text-text-subtle text-[11px] shrink-0">
          BookLeaf Ops v2.4.8
        </span>
      </div>

      {/* 7. Quick Slide-Over Preview Drawer */}
      {previewTicket && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-ticket-title"
          className="fixed inset-0 z-50 overflow-hidden bg-text/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-200"
          onClick={() => setPreviewTicketId(null)}
        >
          <div
            className="w-full max-w-xl bg-surface h-full shadow-overlay flex flex-col border-l border-border animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface-sunken/40">
              <div className="flex items-center space-x-2">
                <span className="font-mono text-sm font-semibold text-text tabular-nums">
                  {previewTicket.id}
                </span>
                <StatusBadge status={previewTicket.status} />
                <PriorityGlyph priority={previewTicket.priority} />
                {getAgeBadge(previewTicket)}
              </div>
              <div className="flex items-center space-x-2">
                <Link
                  href={`/admin/tickets/${previewTicket.id}`}
                  className="p-1.5 text-text-muted hover:text-text hover:bg-surface-sunken rounded transition-colors"
                  title="Open full page view"
                >
                  <ExternalLink className="w-4 h-4" />
                </Link>
                <button
                  type="button"
                  onClick={() => setPreviewTicketId(null)}
                  className="p-1.5 text-text-muted hover:text-text hover:bg-surface-sunken rounded transition-colors"
                  aria-label="Close preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* Subject & Author Info */}
              <div>
                <h2
                  id="preview-ticket-title"
                  className="font-serif text-title-section text-text leading-tight"
                >
                  {previewTicket.subject}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
                  <span>Author: <strong className="text-text">{previewTicket.author_name}</strong></span>
                  {previewTicket.book_title && (
                    <span>Book: <em className="font-serif text-text">{previewTicket.book_title}</em></span>
                  )}
                  <span>Category: <strong className="text-text">{previewTicket.category}</strong></span>
                </div>
              </div>

              {/* Description */}
              <div className="bg-surface-sunken/60 p-4 rounded-md border border-border">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                  Original Query Description
                </p>
                <p className="text-sm font-body text-text whitespace-pre-wrap">
                  {previewTicket.description}
                </p>
              </div>

              {/* Message Thread */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Conversation Thread ({(previewTicket.messages || []).length} messages)
                </h3>
                {(!previewTicket.messages || previewTicket.messages.length === 0) ? (
                  <p className="text-xs text-text-muted italic">No replies yet.</p>
                ) : (
                  previewTicket.messages.map((msg) => {
                    const isAuthor = msg.sender_role === 'author';
                    return (
                      <div
                        key={msg.id}
                        className={`p-3.5 rounded-md text-sm ${
                          isAuthor
                            ? 'bg-surface border border-border'
                            : 'bg-primary-tint border-l-4 border-primary'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                          <span className="font-semibold text-text">{msg.sender_name}</span>
                          <span className="tabular-nums">{formatRelativeTime(msg.created_at)}</span>
                        </div>
                        <p className="font-body text-text whitespace-pre-wrap">{msg.body}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Drawer Quick Reply Composer */}
            <form
              onSubmit={handleSendDrawerReply}
              className="p-4 border-t border-border bg-surface-sunken/30 space-y-2"
            >
              <textarea
                value={drawerReplyText}
                onChange={(e) => setDrawerReplyText(e.target.value)}
                placeholder="Write an official BookLeaf reply or resolution note..."
                rows={3}
                className="w-full text-sm font-body p-2.5 bg-surface border border-border rounded focus:border-primary focus:ring-0 placeholder:text-text-muted resize-none"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (typeof window !== 'undefined') {
                        try {
                          await apiClient.admin.updateTicket(previewTicket.id, { status: 'Resolved' });
                        } catch {}
                      }
                      mockDb.updateTicketStatus(previewTicket.id, 'Resolved');
                      refreshFromDb();
                    }}
                    className="text-xs bg-surface border border-border hover:bg-surface-sunken text-text px-2.5 py-1.5 rounded transition-colors"
                  >
                    Mark Resolved
                  </button>
                  {!previewTicket.assignee && (
                    <button
                      type="button"
                      onClick={(e) => handleAssignToMe(e, previewTicket.id)}
                      className="text-xs text-primary hover:bg-primary-tint border border-primary/20 px-2.5 py-1.5 rounded transition-colors"
                    >
                      Assign to me
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={!drawerReplyText.trim() || isSendingDrawerReply}
                  className="inline-flex items-center space-x-1.5 text-xs font-medium bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-pressed px-3.5 py-1.5 rounded transition-colors disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingDrawerReply ? 'Sending...' : 'Send Reply'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
