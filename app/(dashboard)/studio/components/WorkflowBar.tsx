'use client';

// ============================================
// Workflow Bar - System-Driven 3-Step Indicator
// ============================================
// Automatic state transitions based on editor state
// User NEVER manually switches steps
// LongLabs-style: calm, quiet confidence, tool-like

import { useEffect, useRef } from 'react';
import { useStudio } from '@/lib/studio/studioContext';
import { WORKFLOW_STEPS, type WorkflowStep } from '@/lib/studio/workflow';

/**
 * Derives the active workflow step from current editor state.
 * 3-step system-driven workflow:
 *
 * Step 1: 'brief' - User defining intent (no AI output yet)
 * Step 2: 'draft' - AI has produced output, no issues/suggestions
 * Step 3: 'review' - Issues/suggestions present OR approved
 *
 * Transitions are AUTOMATIC - user never clicks stepper.
 */
function deriveActiveStep(state: {
  hasAIGeneration: boolean;
  hasIssuesOrSuggestions: boolean;
  isApproved: boolean;
}): WorkflowStep {
  const { hasAIGeneration, hasIssuesOrSuggestions, isApproved } = state;

  // Priority 1: Approved OR has issues/suggestions → Step 3 (Rà soát)
  if (isApproved || (hasIssuesOrSuggestions && hasAIGeneration)) {
    return 'review';
  }

  // Priority 2: AI has generated output with no issues → Step 2 (Nháp)
  if (hasAIGeneration) {
    return 'draft';
  }

  // Priority 3: Default → Step 1 (Brief)
  return 'brief';
}

interface WorkflowBarProps {
  onReviewPhaseEnter?: () => void;
}

export default function WorkflowBar({ onReviewPhaseEnter }: WorkflowBarProps) {
  const { messages, approvedMessageId } = useStudio();
  const prevStepRef = useRef<WorkflowStep>('brief');

  // Derive signals from editor state
  const hasAIGeneration = messages.some(m => m.role === 'assistant');

  const latestAssistantWithQL = [...messages].reverse().find(
    m => m.role === 'assistant' && m.meta?.qualityLock
  );
  const qualityFeedback = latestAssistantWithQL?.meta?.qualityLock?.feedback;
  const qualityDecision = latestAssistantWithQL?.meta?.qualityLock?.decision;

  const hasIssuesOrSuggestions = qualityFeedback
    ? (qualityFeedback.status === 'FAIL' || qualityFeedback.status === 'WARNING')
    : (qualityDecision === 'FAIL' || qualityDecision === 'DRAFT');

  const isApproved = approvedMessageId !== null;

  // Derive active step from state (system-driven)
  const derivedStep = deriveActiveStep({ hasAIGeneration, hasIssuesOrSuggestions, isApproved });
  const activeStepIndex = WORKFLOW_STEPS.findIndex(s => s.id === derivedStep);

  // Auto-trigger callback when entering review phase
  useEffect(() => {
    const prevStep = prevStepRef.current;
    prevStepRef.current = derivedStep;

    if (derivedStep === 'review' && prevStep !== 'review' && onReviewPhaseEnter) {
      onReviewPhaseEnter();
    }
  }, [derivedStep, onReviewPhaseEnter]);

  return (
    <div className="mb-6">
      {/* Section Label - Small caps style, very quiet */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-medium tracking-[0.08em] text-zinc-400 dark:text-zinc-500 uppercase">
          Tiến trình
        </span>
        <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 tabular-nums">
          {activeStepIndex + 1} / {WORKFLOW_STEPS.length}
        </span>
      </div>

      {/* Continuous Track Container */}
      <div className="relative">
        {/* Background Track */}
        <div className="absolute top-[11px] left-0 right-0 h-[2px] bg-zinc-200/80 dark:bg-zinc-800/80" />

        {/* Progress Fill */}
        <div
          className="absolute top-[11px] left-0 h-[2px] bg-zinc-400 dark:bg-zinc-500 transition-all duration-500 ease-out"
          style={{ width: `${(activeStepIndex / (WORKFLOW_STEPS.length - 1)) * 100}%` }}
        />

        {/* Steps Row */}
        <div className="relative flex justify-between">
          {WORKFLOW_STEPS.map((step, index) => {
            const isActive = index === activeStepIndex;
            const isPast = index < activeStepIndex;
            const isFuture = index > activeStepIndex;

            return (
              <div
                key={step.id}
                className="flex flex-col items-center"
                aria-current={isActive ? 'step' : undefined}
              >
                {/* Step Node */}
                <div
                  className={`
                    relative z-10 flex items-center justify-center
                    w-6 h-6 rounded-full text-[11px] font-medium
                    transition-all duration-300
                    ${isActive
                      ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 ring-4 ring-zinc-900/10 dark:ring-zinc-100/10'
                      : isPast
                      ? 'bg-zinc-400 dark:bg-zinc-500 text-white'
                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500'
                    }
                  `}
                >
                  {isPast ? (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="font-mono">{index + 1}</span>
                  )}
                </div>

                {/* Step Label */}
                <span
                  className={`
                    mt-2 text-[11px] leading-tight text-center
                    transition-all duration-300
                    ${isActive
                      ? 'font-medium text-zinc-900 dark:text-zinc-100'
                      : isPast
                      ? 'font-normal text-zinc-500 dark:text-zinc-400'
                      : 'font-normal text-zinc-400 dark:text-zinc-600'
                    }
                  `}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
