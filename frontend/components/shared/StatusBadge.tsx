import React from 'react';

export interface StatusBadgeProps {
  status?: 'Published & Live' | 'In production' | 'Open' | 'In progress' | 'Resolved' | 'Closed' | string | null;
  stage?: string | null;
  className?: string;
}

export function StatusBadge({ status, stage, className = '' }: StatusBadgeProps) {
  // Normalize book vs ticket status
  const safeStatus = status || '';
  const isLive = safeStatus === 'Published & Live';
  const isProduction = safeStatus === 'In production' || Boolean(safeStatus?.startsWith('In Production'));
  const isOpen = safeStatus === 'Open';
  const isInProgress = safeStatus === 'In progress' && !isProduction;
  const isResolved = safeStatus === 'Resolved';
  const isClosed = safeStatus === 'Closed';

  let colorClasses = 'bg-surface-sunken text-text-muted border-border';
  let label = safeStatus;

  if (isLive) {
    colorClasses = 'bg-status-resolved-bg text-status-resolved-text border-status-resolved-text/10';
    label = 'Published & Live';
  } else if (isProduction) {
    colorClasses = 'bg-status-progress-bg text-status-progress-text border-status-progress-text/10';
    if (stage) {
      label = `In Production - ${stage}`;
    } else if (safeStatus.includes(' - ')) {
      label = safeStatus;
    } else {
      label = 'In production';
    }
  } else if (isOpen) {
    colorClasses = 'bg-status-open-bg text-status-open-text border-status-open-text/10';
    label = 'Open';
  } else if (isInProgress) {
    colorClasses = 'bg-status-progress-bg text-status-progress-text border-status-progress-text/10';
    label = 'In progress';
  } else if (isResolved) {
    colorClasses = 'bg-primary-tint text-primary border-primary/20';
    label = 'Resolved';
  } else if (isClosed) {
    colorClasses = 'bg-status-closed-bg text-status-closed-text border-status-closed-text/10';
    label = 'Closed';
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-[4px] text-[13px] font-medium leading-none whitespace-nowrap border ${colorClasses} ${className}`}
    >
      {label}
    </span>
  );
}
