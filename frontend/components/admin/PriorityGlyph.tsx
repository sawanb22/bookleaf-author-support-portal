import React from 'react';
import { TicketPriority } from '@/lib/mock/types';

export interface PriorityGlyphProps {
  priority: TicketPriority | string;
  showLabel?: boolean;
  className?: string;
}

const BAR_HEIGHTS = ['h-[6px]', 'h-[8px]', 'h-[10px]', 'h-[12px]'];

export function PriorityGlyph({
  priority,
  showLabel = true,
  className = '',
}: PriorityGlyphProps) {
  let filledBars = 1;
  let activeBarColor = 'bg-text-muted';
  let labelColor = 'text-text-muted font-normal';
  let title = 'Low Priority (1 bar)';

  switch (priority) {
    case 'Critical':
      filledBars = 4;
      activeBarColor = 'bg-priority-critical-text';
      labelColor = 'text-priority-critical-text font-semibold';
      title = 'Critical Priority (4 bars)';
      break;
    case 'High':
      filledBars = 3;
      activeBarColor = 'bg-priority-high-text';
      labelColor = 'text-priority-high-text font-medium';
      title = 'High Priority (3 bars)';
      break;
    case 'Medium':
      filledBars = 2;
      activeBarColor = 'bg-text';
      labelColor = 'text-text font-medium';
      title = 'Medium Priority (2 bars)';
      break;
    case 'Low':
    default:
      filledBars = 1;
      activeBarColor = 'bg-text-muted';
      labelColor = 'text-text-muted font-normal';
      title = 'Low Priority (1 bar)';
      break;
  }

  return (
    <div
      className={`inline-flex items-center space-x-1.5 select-none ${className}`}
      title={title}
      role="img"
      aria-label={`${priority} priority (${filledBars} of 4 bars filled) Priority`}
    >
      {/* 4 vertical bars glyph per spec §3.4: 3px wide, stepped heights 6, 8, 10, 12px */}
      <div className="flex space-x-0.5 items-end h-3.5" aria-hidden="true">
        {BAR_HEIGHTS.map((heightClass, index) => {
          const isFilled = index < filledBars;
          return (
            <span
              key={index}
              className={`w-[3px] ${heightClass} rounded-xs transition-colors ${
                isFilled
                  ? activeBarColor
                  : 'bg-border border border-border-strong/40'
              }`}
            />
          );
        })}
      </div>

      {/* Accompanying text label */}
      {showLabel && (
        <span className={`text-xs ${labelColor} leading-none`}>
          {priority}
        </span>
      )}
    </div>
  );
}
