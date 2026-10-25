import React from 'react';
import { AdminMetric } from '@/lib/mock/types';

export interface MetricCardsProps {
  metrics: AdminMetric;
  className?: string;
  onFilterClick?: (filterKey: string) => void;
}

export function MetricCards({
  metrics,
  className = '',
  onFilterClick,
}: MetricCardsProps) {
  return (
    <section
      aria-label="Operational metrics summary"
      className={`grid grid-cols-2 md:grid-cols-5 gap-3 ${className}`}
    >
      {/* 1. Total in Queue */}
      <div
        onClick={() => onFilterClick?.('all')}
        className={`bg-surface border border-border p-3.5 rounded flex flex-col justify-between transition-colors ${
          onFilterClick ? 'cursor-pointer hover:border-border-strong hover:bg-surface-sunken/40' : ''
        }`}
      >
        <span className="text-caption font-caption text-text-muted">Total in Queue</span>
        <div className="flex items-baseline space-x-2 mt-1">
          <span className="font-figure-lg text-figure-lg font-semibold text-text tabular-nums">
            {metrics.total_in_queue}
          </span>
          <span className="text-[12px] text-text-subtle font-caption">tickets</span>
        </div>
      </div>

      {/* 2. Needs First Reply (Urgent Highlight with Amber/Orange Left Border) */}
      <div
        onClick={() => onFilterClick?.('needs_reply')}
        className={`bg-surface border border-border p-3.5 rounded flex flex-col justify-between border-l-4 border-l-[#A5420A] transition-colors ${
          onFilterClick ? 'cursor-pointer hover:border-border-strong hover:bg-surface-sunken/40' : ''
        }`}
      >
        <span className="text-caption font-caption text-text-muted">Needs First Reply</span>
        <div className="flex items-baseline justify-between mt-1">
          <span className="font-figure-lg text-figure-lg font-semibold text-text tabular-nums">
            {metrics.needs_first_reply}
          </span>
          <span className="text-[11px] font-caption text-priority-high-text bg-priority-high-bg px-1.5 py-0.5 rounded font-medium">
            {metrics.near_sla_breach_count > 0
              ? `${metrics.near_sla_breach_count} near 48h`
              : 'On track'}
          </span>
        </div>
      </div>

      {/* 3. Awaiting Author */}
      <div
        onClick={() => onFilterClick?.('awaiting_author')}
        className={`bg-surface border border-border p-3.5 rounded flex flex-col justify-between transition-colors ${
          onFilterClick ? 'cursor-pointer hover:border-border-strong hover:bg-surface-sunken/40' : ''
        }`}
      >
        <span className="text-caption font-caption text-text-muted">Awaiting Author</span>
        <div className="flex items-baseline space-x-2 mt-1">
          <span className="font-figure-lg text-figure-lg font-semibold text-text tabular-nums">
            {metrics.awaiting_author}
          </span>
          <span className="text-[12px] text-text-subtle font-caption">responses</span>
        </div>
      </div>

      {/* 4. AI Draft Ready (Steel Blue Left Border) */}
      <div
        onClick={() => onFilterClick?.('ai_draft')}
        className={`bg-surface border border-border p-3.5 rounded flex flex-col justify-between border-l-4 border-l-[#1E4F8C] transition-colors ${
          onFilterClick ? 'cursor-pointer hover:border-border-strong hover:bg-surface-sunken/40' : ''
        }`}
      >
        <span className="text-caption font-caption text-text-muted">AI Draft Ready</span>
        <div className="flex items-baseline justify-between mt-1">
          <span className="font-figure-lg text-figure-lg font-semibold text-status-open-text tabular-nums">
            {metrics.ai_draft_ready}
          </span>
          <span className="text-[11px] font-caption text-status-open-text bg-status-open-bg px-1.5 py-0.5 rounded font-medium">
            Queued
          </span>
        </div>
      </div>

      {/* 5. Resolved Today (Green Accent) */}
      <div
        onClick={() => onFilterClick?.('resolved')}
        className={`bg-surface border border-border p-3.5 rounded flex flex-col justify-between col-span-2 md:col-span-1 transition-colors ${
          onFilterClick ? 'cursor-pointer hover:border-border-strong hover:bg-surface-sunken/40' : ''
        }`}
      >
        <span className="text-caption font-caption text-text-muted">Resolved Today</span>
        <div className="flex items-baseline space-x-2 mt-1">
          <span className="font-figure-lg text-figure-lg font-semibold text-status-resolved-text tabular-nums">
            {metrics.resolved_today}
          </span>
          <span className="text-[12px] text-status-resolved-text font-caption font-medium">
            {metrics.sla_compliance_rate}% SLA
          </span>
        </div>
      </div>
    </section>
  );
}
