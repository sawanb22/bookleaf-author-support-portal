'use client';

import React from 'react';
import { Landmark, Lock } from 'lucide-react';
import { TicketMessage } from '@/lib/mock/types';
import { formatDate } from '@/lib/formatters';

export interface MessageBlockProps {
  message: TicketMessage;
  isAuthorCurrentUser?: boolean;
  isHighlighted?: boolean;
  className?: string;
}

export function MessageBlock({
  message,
  isAuthorCurrentUser = false,
  isHighlighted = false,
  className = '',
}: MessageBlockProps) {
  const isAuthor = message.sender_role === 'author';
  const isSupport = message.sender_role === 'support' || message.sender_role === 'admin';
  const isAi = message.sender_role === 'ai';
  const isInternalNote = message.is_internal_note;

  // Format sender name with "(you)" for author
  const rawSender = message.sender_name || (isAuthor ? 'Priya Sharma' : 'Rahul, BookLeaf support');
  const cleanSender = rawSender.replace(/\s*\(you\)$/i, '').trim();

  // Determine card container styles
  let containerStyle = 'bg-surface border border-border rounded-md p-5 sm:p-6';
  if (isInternalNote) {
    containerStyle = 'bg-surface-sunken border border-dashed border-border-strong rounded-md p-5 sm:p-6';
  } else if (isAi) {
    containerStyle = 'bg-ai-tint border border-ai border-l-[3px] border-l-ai rounded-md p-5 sm:p-6';
  } else if (isSupport) {
    containerStyle = 'bg-primary-tint border border-border border-l-[3px] border-l-primary rounded-md p-5 sm:p-6';
  }

  return (
    <article
      aria-label={`Message from ${cleanSender}`}
      className={`transition-colors duration-1000 ${containerStyle} ${
        isHighlighted ? 'ring-2 ring-primary/40 bg-primary-tint/90' : ''
      } ${className}`}
    >
      {/* Header Row: Sender Meta and Timestamp */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-semibold text-text text-sm sm:text-base">
              {cleanSender}
              {isAuthor && isAuthorCurrentUser && (
                <span className="font-normal text-text-muted ml-1 text-sm">(you)</span>
              )}
            </span>

            {/* Official Support Badge */}
            {isSupport && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-surface text-primary border border-border leading-none">
                Official
              </span>
            )}

            {/* Internal Note / Staff Tag */}
            {isInternalNote && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-surface text-text-muted border border-border-strong leading-none">
                <Lock className="w-3 h-3" />
                Internal note
              </span>
            )}
            {isAi && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-surface text-ai border border-ai/20 leading-none">
                AI draft
              </span>
            )}
          </div>

          <p className="font-caption text-caption text-text-muted leading-tight mt-0.5">
            {isSupport
              ? 'Operations Lead'
              : isInternalNote
              ? 'Only visible to BookLeaf team'
              : isAi
              ? 'Review before sending'
              : 'Author'}
          </p>
        </div>

        {/* Timestamp */}
        <time
          dateTime={message.created_at}
          title={formatDate(message.created_at, { includeTime: true })}
          className="font-caption text-caption text-text-muted tabular-nums shrink-0 whitespace-nowrap"
        >
          {formatDate(message.created_at, { includeTime: true })}
        </time>
      </div>

      {/* Prose Message Body (body-lg, max 68ch line width, preserved line breaks) */}
      <div className="font-body-lg text-body-lg text-text max-w-[68ch] leading-relaxed whitespace-pre-line break-words">
        {message.body}
      </div>

      {/* Disbursement Context Footer (BookLeaf Official Replies) */}
      {message.disbursement_note && (
        <div className="mt-4 pt-3 border-t border-primary/20 flex items-center gap-2 font-caption text-caption text-text-muted">
          <Landmark className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
          <span className="tabular-nums font-medium text-text">
            {message.disbursement_note}
          </span>
        </div>
      )}
    </article>
  );
}
