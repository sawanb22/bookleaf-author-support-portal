'use client';

import React from 'react';
import Link from 'next/link';
import {
  Ticket,
  Plus,
  CreditCard,
  BookOpen,
  Truck,
  FileEdit,
  RotateCcw,
} from 'lucide-react';

export interface EmptyStateProps {
  /** Main heading */
  title?: string;
  /** Explanatory description */
  description?: string;
  /** CTA button text */
  actionLabel?: string;
  /** Link destination for CTA button */
  actionHref?: string;
  /** Optional click handler (takes precedence over actionHref) */
  onAction?: () => void;
  /** Whether to display the 2x2 common topics guide (spec §3.8 / screen 5) */
  showTopics?: boolean;
  /** Whether this is an empty filter variant */
  isFilterEmpty?: boolean;
  /** Custom icon override */
  icon?: React.ReactNode;
  /** Additional wrapper CSS classes */
  className?: string;
}

export function EmptyState({
  title = 'No tickets yet',
  description = 'You don’t have any support queries yet. Once you submit a question about your books, royalties, or production, it will appear here so you can track its progress and replies.',
  actionLabel = 'New support query',
  actionHref = '/tickets/new',
  onAction,
  showTopics = true,
  isFilterEmpty = false,
  icon,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`bg-surface border border-border rounded-xl p-8 py-16 sm:py-20 text-center flex flex-col items-center justify-center ${className}`}
    >
      {/* Editorial Ticket Icon Badge in Primary Tint Circle */}
      <div className="w-14 h-14 rounded-full bg-primary-tint flex items-center justify-center text-primary mb-5 shrink-0">
        {icon ?? <Ticket className="w-7 h-7 stroke-[1.5]" aria-hidden="true" />}
      </div>

      {/* Heading */}
      <h2 className="font-title-section text-title-section font-semibold text-text tracking-tight mb-2">
        {title}
      </h2>

      {/* Description */}
      <p className="font-body text-body text-text-muted max-w-lg mx-auto mb-6 leading-relaxed">
        {description}
      </p>

      {/* Primary Action Button */}
      {onAction ? (
        <button
          type="button"
          onClick={onAction}
          className={`inline-flex items-center gap-1.5 h-10 px-5 bg-primary hover:bg-primary-hover active:bg-primary-pressed text-on-primary font-label text-label rounded-lg transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
            showTopics ? 'mb-10' : ''
          }`}
        >
          {isFilterEmpty ? (
            <RotateCcw className="w-4 h-4 shrink-0" aria-hidden="true" />
          ) : (
            <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
          )}
          <span>{actionLabel}</span>
        </button>
      ) : actionHref ? (
        <Link
          href={actionHref}
          className={`inline-flex items-center gap-1.5 h-10 px-5 bg-primary hover:bg-primary-hover active:bg-primary-pressed text-on-primary font-label text-label rounded-lg transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
            showTopics ? 'mb-10' : ''
          }`}
        >
          {isFilterEmpty ? (
            <RotateCcw className="w-4 h-4 shrink-0" aria-hidden="true" />
          ) : (
            <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
          )}
          <span>{actionLabel}</span>
        </Link>
      ) : null}

      {/* Quick Guide / Common Topics Help Strip (Stitch Screen 5 Parity) */}
      {showTopics && (
        <div className="w-full max-w-xl border-t border-border pt-6 mt-2">
          <p className="text-caption font-label font-medium text-text-muted uppercase tracking-wider mb-3.5 text-center">
            Common topics you can ask about
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
            <Link
              href="/tickets/new?category=Royalty%20%26%20Payments"
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-surface-sunken hover:bg-primary-tint/60 text-caption text-text-muted hover:text-text transition-colors group cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <CreditCard
                className="w-4 h-4 text-primary shrink-0 transition-transform group-hover:scale-110"
                aria-hidden="true"
              />
              <span className="truncate">Royalty &amp; payment settlement</span>
            </Link>
            <Link
              href="/tickets/new?category=Production%20%26%20Proofs"
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-surface-sunken hover:bg-primary-tint/60 text-caption text-text-muted hover:text-text transition-colors group cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <BookOpen
                className="w-4 h-4 text-primary shrink-0 transition-transform group-hover:scale-110"
                aria-hidden="true"
              />
              <span className="truncate">Production stage &amp; proof copies</span>
            </Link>
            <Link
              href="/tickets/new?category=ISBN%20%26%20Distribution"
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-surface-sunken hover:bg-primary-tint/60 text-caption text-text-muted hover:text-text transition-colors group cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <Truck
                className="w-4 h-4 text-primary shrink-0 transition-transform group-hover:scale-110"
                aria-hidden="true"
              />
              <span className="truncate">ISBN &amp; retail distribution</span>
            </Link>
            <Link
              href="/tickets/new?category=Cover%20%26%20Design"
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-surface-sunken hover:bg-primary-tint/60 text-caption text-text-muted hover:text-text transition-colors group cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <FileEdit
                className="w-4 h-4 text-primary shrink-0 transition-transform group-hover:scale-110"
                aria-hidden="true"
              />
              <span className="truncate">Author bio &amp; cover adjustments</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
