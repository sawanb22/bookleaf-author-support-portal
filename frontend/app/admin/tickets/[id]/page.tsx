'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Sparkles,
  Lock,
  Send,
  Loader2,
} from 'lucide-react';
import { mockDb } from '@/lib/mock/db';
import { useAuth } from '@/lib/mock/auth-context';
import { apiClient } from '@/lib/api-client';
import { Ticket, TicketStatus } from '@/lib/mock/types';
import { PriorityGlyph } from '@/components/admin/PriorityGlyph';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatRelativeTime, formatDate, formatTicketId } from '@/lib/formatters';

interface AdminTicketDetailsPageProps {
  params: { id: string };
}

export default function AdminTicketDetailsPage({ params }: AdminTicketDetailsPageProps) {
  const router = useRouter();
  const normalizedId = formatTicketId(params.id);
  const { user } = useAuth();
  const currentAdmin = user?.name || 'Rahul';
  const currentInitials = user?.avatar_initials || 'RS';

  const [ticket, setTicket] = useState<Ticket | undefined>(() => mockDb.getTicket(normalizedId));
  const [isLoading, setIsLoading] = useState(!mockDb.getTicket(normalizedId));
  const [replyText, setReplyText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingAiDraft, setIsGeneratingAiDraft] = useState(false);

  // Live draft state
  const [aiDraftContent, setAiDraftContent] = useState('');
  const [isDraftVisible, setIsDraftVisible] = useState(true);

  const refreshTicket = useCallback(async () => {
    if (typeof window !== 'undefined') {
      try {
        const live = await apiClient.admin.getTicket(normalizedId);
        if (live && live.id) {
          setTicket(live);
          if (live.ai_draft) {
            setAiDraftContent(live.ai_draft);
          }
          setIsLoading(false);
          return;
        }
      } catch {
        // Fall through to mockDb on network/offline errors
      }
    }

    const updated = mockDb.getTicket(normalizedId);
    setTicket(updated);
    if (updated?.ai_draft) {
      setAiDraftContent(updated.ai_draft);
    }
    setIsLoading(false);
  }, [normalizedId]);

  useEffect(() => {
    refreshTicket();
    const unsubscribe = mockDb.subscribe(refreshTicket);
    return () => unsubscribe();
  }, [refreshTicket]);

  if (isLoading && !ticket) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-pulse py-8">
        <div className="h-6 w-32 bg-surface-sunken rounded" />
        <div className="h-10 w-3/4 bg-surface-sunken rounded" />
        <div className="h-28 bg-surface-sunken rounded" />
        <div className="h-48 bg-surface-sunken rounded" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <h1 className="font-serif text-title-page text-text">Ticket Not Found</h1>
        <p className="text-sm font-body text-text-muted">
          We could not locate ticket <code className="font-mono">{normalizedId}</code>. It may have been archived or removed.
        </p>
        <Link
          href="/admin/tickets"
          className="inline-flex items-center text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          <span>Back to Admin Queue</span>
        </Link>
      </div>
    );
  }

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    setIsSubmitting(true);
    try {
      if (typeof window !== 'undefined') {
        try {
          if (isInternalNote) {
            await apiClient.admin.addNote(ticket.id, replyText.trim());
          } else {
            await apiClient.admin.sendMessage(
              ticket.id,
              replyText.trim(),
              replyText.trim() === aiDraftContent,
              'In progress'
            );
          }
        } catch (apiErr) {
          console.warn('API error sending admin reply:', apiErr);
        }
      }

      mockDb.addMessage(ticket.id, {
        sender_name: isInternalNote ? `${currentAdmin} (Internal Note)` : `${currentAdmin}, BookLeaf support`,
        sender_role: 'support',
        body: replyText.trim(),
        is_internal_note: isInternalNote,
      });
      setReplyText('');
      refreshTicket();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFetchAiDraft = async (regenerate = false) => {
    setIsGeneratingAiDraft(true);
    try {
      const draftRes = await apiClient.admin.getDraft(ticket.id, regenerate);
      if (draftRes?.body) {
        setAiDraftContent(draftRes.body);
        setIsDraftVisible(true);
      }
    } catch (err) {
      console.warn('Failed to generate draft:', err);
    } finally {
      setIsGeneratingAiDraft(false);
    }
  };

  const handleApplyAiDraft = () => {
    setReplyText(aiDraftContent);
  };

  const handleAssignToMe = async () => {
    if (typeof window !== 'undefined') {
      try {
        await apiClient.admin.updateTicket(ticket.id, { assignee: currentAdmin });
      } catch {}
    }
    mockDb.assignTicket(ticket.id, currentAdmin, currentInitials);
    refreshTicket();
  };

  const handleUpdateStatus = async (status: TicketStatus) => {
    if (typeof window !== 'undefined') {
      try {
        await apiClient.admin.updateTicket(ticket.id, { status });
      } catch {}
    }
    mockDb.updateTicketStatus(ticket.id, status);
    refreshTicket();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/tickets"
          className="inline-flex items-center text-sm font-medium text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          <span>Back to Queue</span>
        </Link>
        <div className="flex items-center space-x-2">
          {!ticket.assignee && (
            <button
              type="button"
              onClick={handleAssignToMe}
              className="px-3 py-1.5 bg-primary-tint text-primary border border-primary/30 rounded text-xs font-medium hover:bg-primary/20 transition-colors"
            >
              Assign to me
            </button>
          )}
          {ticket.status !== 'Resolved' && (
            <button
              type="button"
              onClick={() => handleUpdateStatus('Resolved')}
              className="px-3 py-1.5 bg-surface border border-border hover:bg-surface-sunken rounded text-xs font-medium text-text transition-colors"
            >
              Mark Resolved
            </button>
          )}
          {ticket.status !== 'Closed' && (
            <button
              type="button"
              onClick={() => handleUpdateStatus('Closed')}
              className="px-3 py-1.5 bg-surface border border-border hover:bg-surface-sunken rounded text-xs font-medium text-text-muted transition-colors"
            >
              Close Ticket
            </button>
          )}
        </div>
      </div>

      {/* Ticket Header Card */}
      <div className="bg-surface border border-border rounded p-6 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <span className="font-mono text-base font-semibold text-text tabular-nums">
              {ticket.id}
            </span>
            <StatusBadge status={ticket.status} />
            <PriorityGlyph priority={ticket.priority} />
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-label bg-surface border border-border text-text">
              {ticket.category}
            </span>
          </div>
          <span className="text-xs text-text-subtle font-caption tabular-nums">
            Created: {formatDate(ticket.created_at, { includeTime: true })}
          </span>
        </div>

        <h1 className="font-serif text-title-section text-text leading-snug">
          {ticket.subject}
        </h1>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-body text-text-muted border-t border-border pt-3">
          <div>
            <span className="block text-text-subtle">Author</span>
            <strong className="text-text">{ticket.author_name}</strong>
          </div>
          <div>
            <span className="block text-text-subtle">Book</span>
            <em className="font-serif text-text">{ticket.book_title || 'General inquiry'}</em>
          </div>
          <div>
            <span className="block text-text-subtle">Assignee</span>
            <strong className="text-text">{ticket.assignee || 'Unassigned'}</strong>
          </div>
          <div>
            <span className="block text-text-subtle">SLA Cushion</span>
            <strong className="text-text">48h Resolution Target</strong>
          </div>
        </div>
      </div>

      {/* Suggested Response Panel */}
      {aiDraftContent && isDraftVisible ? (
        <div className="bg-ai-tint border-l-4 border-ai rounded p-4 space-y-3 transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-ai font-semibold text-xs">
              <Sparkles className="w-4 h-4" />
              <span>Suggested Response (Review before dispatch)</span>
            </div>
            <button
              type="button"
              onClick={() => setIsDraftVisible(false)}
              className="text-text-muted hover:text-text text-xs font-medium px-2 py-0.5 rounded hover:bg-surface transition-colors"
              title="Hide draft without discarding"
            >
              Hide Draft
            </button>
          </div>
          <p className="text-sm font-body text-text whitespace-pre-wrap leading-relaxed">
            {aiDraftContent}
          </p>
          <div className="flex items-center space-x-3 pt-1">
            <button
              type="button"
              onClick={handleApplyAiDraft}
              className="px-3.5 py-1.5 bg-ai text-white rounded text-xs font-medium hover:bg-ai/90 active:scale-[0.99] transition-all"
            >
              Use in Composer
            </button>
            <button
              type="button"
              onClick={() => handleFetchAiDraft(true)}
              disabled={isGeneratingAiDraft}
              className="px-3.5 py-1.5 bg-surface border border-ai/30 text-ai rounded text-xs font-medium hover:bg-surface-sunken transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {isGeneratingAiDraft ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Regenerating...</span>
                </>
              ) : (
                <span>Regenerate Draft</span>
              )}
            </button>
          </div>
        </div>
      ) : aiDraftContent ? (
        <div className="bg-surface border border-border rounded p-3.5 flex items-center justify-between gap-3 transition-all">
          <div className="flex items-center space-x-2 text-text text-xs font-medium">
            <Sparkles className="w-4 h-4 text-ai shrink-0" />
            <span>Suggested response draft is ready for review</span>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsDraftVisible(true)}
              className="px-3 py-1.5 bg-ai text-white hover:bg-ai/90 rounded text-xs font-medium transition-colors"
            >
              View Suggested Response
            </button>
            <button
              type="button"
              onClick={() => handleFetchAiDraft(true)}
              disabled={isGeneratingAiDraft}
              className="px-3 py-1.5 bg-surface border border-border hover:bg-surface-sunken rounded text-xs font-medium text-text-muted hover:text-text transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {isGeneratingAiDraft ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Regenerating...</span>
                </>
              ) : (
                <span>Regenerate</span>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-surface border border-border border-dashed rounded p-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center space-x-2 text-text-muted text-xs">
            <Sparkles className="w-4 h-4 text-ai shrink-0" />
            <span>Generate draft response for this inquiry</span>
          </div>
          <button
            type="button"
            onClick={() => handleFetchAiDraft(false)}
            disabled={isGeneratingAiDraft}
            className="px-3 py-1.5 bg-ai-tint text-ai border border-ai/20 hover:bg-ai/20 rounded text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0"
          >
            {isGeneratingAiDraft ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Generating draft...</span>
              </>
            ) : (
              <span>Draft Suggested Response</span>
            )}
          </button>
        </div>
      )}

      {/* Conversation Thread */}
      <div className="space-y-4">
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Thread History
        </h2>

        {(ticket.messages || []).map((msg) => {
          const isAuthor = msg.sender_role === 'author';
          const isInternal = msg.is_internal_note;

          if (isInternal) {
            return (
              <div
                key={msg.id}
                className="bg-surface-sunken border border-dashed border-border-strong rounded p-4 space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <div className="flex items-center space-x-1.5 font-medium text-text">
                    <Lock className="w-3.5 h-3.5 text-text-subtle" />
                    <span>{msg.sender_name}</span>
                    <span className="text-[11px] text-text-subtle font-caption">
                      (Visible only to BookLeaf team)
                    </span>
                  </div>
                  <span className="tabular-nums">{formatRelativeTime(msg.created_at)}</span>
                </div>
                <p className="text-sm font-body text-text whitespace-pre-wrap">{msg.body}</p>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`p-4 rounded border text-sm space-y-1.5 ${
                isAuthor
                  ? 'bg-surface border-border'
                  : 'bg-primary-tint border-l-4 border-primary border-t-0 border-r-0 border-b-0'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-text-muted">
                <span className="font-semibold text-text">{msg.sender_name}</span>
                <span className="tabular-nums">{formatRelativeTime(msg.created_at)}</span>
              </div>
              <p className="font-body text-text whitespace-pre-wrap">{msg.body}</p>
            </div>
          );
        })}
      </div>

      {/* Reply Composer */}
      <form onSubmit={handleSendReply} className="bg-surface border border-border rounded p-5 space-y-3">
        <div className="flex items-center justify-between">
          <label htmlFor="admin-reply" className="font-label text-sm font-medium text-text">
            {isInternalNote ? 'Add Internal Note' : 'Reply to Author'}
          </label>
          <button
            type="button"
            onClick={() => setIsInternalNote((prev) => !prev)}
            className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
              isInternalNote
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : 'text-text-muted hover:text-text bg-surface-sunken border border-border'
            }`}
          >
            {isInternalNote ? '✓ Internal Team Note Only' : 'Switch to Internal Note'}
          </button>
        </div>

        <textarea
          id="admin-reply"
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder={
            isInternalNote
              ? 'Private note for support & editorial team...'
              : 'Write your official response to the author...'
          }
          rows={4}
          className="w-full text-sm font-body p-3 bg-surface border border-border rounded focus:border-primary focus:ring-0 placeholder:text-text-muted"
        />

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-text-subtle font-caption">
            {isInternalNote
              ? 'This note will never be seen by the author.'
              : `Author will see this as ${currentAdmin}, BookLeaf support.`}
          </span>
          <button
            type="submit"
            disabled={!replyText.trim() || isSubmitting}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-primary text-on-primary rounded font-label text-sm font-medium hover:bg-primary-hover active:bg-primary-pressed transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>{isSubmitting ? 'Posting...' : isInternalNote ? 'Save Note' : 'Send Reply'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
