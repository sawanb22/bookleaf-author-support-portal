'use client';

import React from 'react';
import { Info } from 'lucide-react';
import { TicketStatus } from '@/lib/mock/types';
import { FIRST_RESPONSE_TARGET_HOURS, STATUS_HELPER_COPY } from '@/lib/constants';

export interface StatusProgressLineProps {
  status: TicketStatus | string;
  lastUpdated?: Date | string;
  className?: string;
}

const STEPS: readonly TicketStatus[] = ['Open', 'In progress', 'Resolved', 'Closed'];

export function StatusProgressLine({
  status,
  lastUpdated,
  className = '',
}: StatusProgressLineProps) {
  // Normalize current step index (fallback to 0 'Open' if unrecognized)
  const currentStepIndex = Math.max(0, STEPS.indexOf(status as TicketStatus));

  // Determine width percent of completed connector bar across the 4 nodes
  // Distance from Node 0 (center 12.5%) to Node 3 (center 87.5%) is 75% total.
  // Each of the 3 spans between nodes accounts for 33.333% of the connector line.
  const activePercent = Math.min(100, Math.max(0, (currentStepIndex / (STEPS.length - 1)) * 100));

  // Helper text derived dynamically from status and SLA target hours
  const helperText =
    STATUS_HELPER_COPY[status] ||
    `We’ve received your query. We aim to reply within ${FIRST_RESPONSE_TARGET_HOURS} hours.`;

  // Format relative last updated time
  const formatLastUpdatedText = () => {
    if (!lastUpdated) return 'Updated just now';
    const date = typeof lastUpdated === 'string' ? new Date(lastUpdated) : lastUpdated;
    if (isNaN(date.getTime())) return 'Updated just now';
    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSec < 60) return 'Updated just now';
    if (diffSec < 3600) return `Updated ${Math.floor(diffSec / 60)}m ago`;
    return 'Updated recently';
  };

  return (
    <section
      aria-label="Ticket progress status"
      className={`bg-surface border border-border rounded-md p-4 sm:p-6 ${className}`}
    >
      {/* Horizontal 4-Node Stepper (stays horizontal on mobile down to 320px) */}
      <div className="relative w-full">
        {/* Connector Line Track (spans from center of Node 0 to center of Node 3) */}
        <div
          className="absolute top-3 left-[12.5%] right-[12.5%] h-[2px] -translate-y-1/2 z-0 bg-border pointer-events-none"
          aria-hidden="true"
        >
          {/* Completed Green Segment (#1B6B4F) */}
          <div
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${activePercent}%` }}
          />
        </div>

        {/* 4 Ordered Step Nodes */}
        <ol className="relative z-10 grid grid-cols-4 w-full list-none p-0 m-0">
          {STEPS.map((step, index) => {
            const isCompleted = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const isFuture = index > currentStepIndex;

            return (
              <li
                key={step}
                className="flex flex-col items-center text-center"
                aria-current={isCurrent ? 'step' : undefined}
              >
                {/* Node Center Anchor Container (24px height aligns with 24px halo) */}
                <div className="h-6 w-full flex items-center justify-center">
                  {isCompleted && (
                    /* Past Node: 14px filled #1B6B4F with 4px white center dot */
                    <div
                      className="w-[14px] h-[14px] rounded-full bg-primary flex items-center justify-center shadow-none transition-transform"
                      title={`${step} (Completed)`}
                    >
                      <div className="w-[4px] h-[4px] rounded-full bg-surface" />
                    </div>
                  )}

                  {isCurrent && (
                    /* Current Node: 16px filled #1B6B4F with 24px #E6F1EC halo ring and 5px white dot */
                    <div
                      className="w-6 h-6 rounded-full bg-primary-tint flex items-center justify-center transition-all"
                      title={`${step} (Current)`}
                    >
                      <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                        <div className="w-[5px] h-[5px] rounded-full bg-surface" />
                      </div>
                    </div>
                  )}

                  {isFuture && (
                    /* Future Node: 14px white circle with 2px #C3CBC6 border */
                    <div
                      className="w-[14px] h-[14px] rounded-full bg-surface border-2 border-border-strong transition-colors"
                      title={`${step} (Upcoming)`}
                    />
                  )}
                </div>

                {/* Step Label (stays horizontal on mobile down to 320px) */}
                <span
                  className={`mt-2 text-[12px] sm:text-[13px] leading-tight block px-0.5 ${
                    isCurrent
                      ? 'font-semibold text-text'
                      : 'font-normal text-text-muted'
                  }`}
                >
                  {step}
                </span>

                {/* Screen Reader Status Description */}
                <span className="sr-only">
                  {isCompleted
                    ? 'Completed step'
                    : isCurrent
                    ? 'Current step'
                    : 'Upcoming step'}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Helper Text & Last Updated Row */}
      <div className="mt-5 sm:mt-6 pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
          <p className="font-body text-body text-text">
            {helperText}
          </p>
        </div>
        <span className="font-caption text-caption text-text-muted tabular-nums sm:text-right shrink-0">
          {formatLastUpdatedText()}
        </span>
      </div>
    </section>
  );
}
