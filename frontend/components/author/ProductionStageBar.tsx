import React from 'react';
import { PRODUCTION_STAGES } from '@/lib/constants';

export interface ProductionStageBarProps {
  stage?: string | null;
  className?: string;
}

interface StageStep {
  name: string;
  segmentTitle: string;
  displayLabel: string;
}

const STAGES: StageStep[] = [
  { name: 'Manuscript Received', segmentTitle: '1. Manuscript', displayLabel: '1. Manuscript' },
  { name: 'Editing', segmentTitle: '2. Editing', displayLabel: '2. Editing' },
  { name: 'Cover Design', segmentTitle: '3. Cover Design', displayLabel: '3. Cover' },
  { name: 'Typesetting', segmentTitle: '4. Typesetting', displayLabel: '4. Typeset' },
  { name: 'Proofreading', segmentTitle: '5. Proofing', displayLabel: '5. Proofing' },
  { name: 'ISBN Assignment', segmentTitle: '6. ISBN', displayLabel: '6. ISBN' },
  { name: 'Printing', segmentTitle: '7. Printing', displayLabel: '7. Printing' },
  { name: 'Distribution Setup', segmentTitle: '8. Distribution', displayLabel: '8. Distribution' },
  { name: 'Published & Live', segmentTitle: '9. Live', displayLabel: '9. Live' },
];

export function ProductionStageBar({ stage, className = '' }: ProductionStageBarProps) {
  // Normalize stage string (e.g. "In Production - Cover Design" -> "Cover Design")
  const cleanStage = stage
    ? stage.replace(/^In Production\s*-\s*/i, '').trim()
    : 'Manuscript Received';

  // Find 1-based index
  const stageIdx = STAGES.findIndex(
    (s) => s.name.toLowerCase() === cleanStage.toLowerCase()
  );
  const currentStep = stageIdx !== -1 ? stageIdx + 1 : 3; // Default to Stage 3 (Cover Design) if unknown
  const currentStageName = stageIdx !== -1 ? STAGES[stageIdx].name : cleanStage;

  return (
    <div className={`bg-surface-sunken p-3.5 border border-border rounded ${className}`}>
      {/* Header Row */}
      <div className="flex items-center justify-between mb-2">
        <span className="font-label text-[13px] font-medium text-text flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" aria-hidden="true" />
          Now in {currentStageName}
        </span>
        <span className="font-caption text-[12px] text-text-muted tabular-nums">
          Stage {currentStep} of {STAGES.length}
        </span>
      </div>

      {/* Discrete 9-segment Progress Bar */}
      <div
        role="img"
        aria-label={`Production progress. Current stage: ${currentStageName}. Stage ${currentStep} of ${STAGES.length}.`}
        className="grid grid-cols-9 gap-1.5 h-2"
      >
        {STAGES.map((s, idx) => {
          const stepNum = idx + 1;
          const isCompleted = stepNum < currentStep;
          const isActive = stepNum === currentStep;

          let barStyle = 'h-full bg-border rounded-[1px]';
          let title = `${s.segmentTitle}: Pending`;

          if (isCompleted) {
            barStyle = 'h-full bg-primary rounded-[1px]';
            title = `${s.segmentTitle}: Completed`;
          } else if (isActive) {
            barStyle = 'h-full bg-primary rounded-[1px] ring-2 ring-primary ring-offset-1';
            title = `${s.segmentTitle}: Active Stage`;
          }

          return <div key={s.name} className={barStyle} title={title} />;
        })}
      </div>

      {/* Stage Labels */}
      <div className="mt-2.5 flex justify-between font-caption text-[11px] text-text-muted leading-tight">
        {STAGES.map((s, idx) => {
          const stepNum = idx + 1;
          const isCompleted = stepNum < currentStep;
          const isActive = stepNum === currentStep;

          let textClass = 'text-text-muted';
          if (isCompleted) {
            textClass = 'text-primary font-medium';
          } else if (isActive) {
            textClass = 'text-text font-semibold';
          }

          return (
            <span key={s.name} className={textClass}>
              {s.displayLabel}
            </span>
          );
        })}
      </div>
    </div>
  );
}
