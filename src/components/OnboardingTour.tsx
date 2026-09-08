import { useRef, useState } from 'react'

import { UnifiedPanelShell } from './chrome/UnifiedPanelShell'

const STEPS = [
  {
    title: 'Open your vault',
    body: 'Use Open Vault in the top bar or recent workspaces menu to load a folder of Markdown notes.',
  },
  {
    title: 'Search notes',
    body: 'Press F or use the vault search box to find text across your index.',
  },
  {
    title: 'Command palette',
    body: 'Press Ctrl+K (or click the omnibar) to run commands and open notes quickly.',
  },
  {
    title: 'Inspector rail',
    body: 'Backlinks, outline, citations, and export profiles live in the inspector on the right.',
  },
  {
    title: 'Cheatsheet',
    body: 'Open the cheatsheet any time from the toolbar for keyboard shortcuts and Markdown tips.',
  },
] as const

interface OnboardingTourProps {
  onComplete: () => void
  onOpenCheatsheet?: () => void
}

/** Guides first-run users through the workspace without permitting accidental dismissal. */
export function OnboardingTour({ onComplete, onOpenCheatsheet }: OnboardingTourProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const primaryActionRef = useRef<HTMLButtonElement>(null)
  const step = STEPS[stepIndex]
  const isLast = stepIndex >= STEPS.length - 1

  const progress = (
    <div className="onboarding-progress-meta">
      <span className="onboarding-step-label">
        Step {stepIndex + 1} of {STEPS.length}
      </span>
      <progress
        className="onboarding-progress"
        max={STEPS.length}
        value={stepIndex + 1}
        aria-label={`Tour progress: step ${stepIndex + 1} of ${STEPS.length}`}
      />
    </div>
  )

  return (
    <UnifiedPanelShell
      title={step.title}
      subtitle={step.body}
      ariaLabel="Product tour"
      modalAriaLabel="Product tour"
      onClose={onComplete}
      className="onboarding-tour"
      headerMeta={progress}
      showClose={false}
      closeOnBackdrop={false}
      closeOnEscape={false}
      initialFocusRef={primaryActionRef}
      initialFocusKey={stepIndex}
    >
      <footer className="onboarding-actions">
        <button type="button" className="toolbar-button onboarding-skip" onClick={onComplete}>
          Skip tour
        </button>
        <div className="onboarding-next-actions">
          {isLast ? (
            <>
              {onOpenCheatsheet ? (
                <button type="button" className="toolbar-button" onClick={onOpenCheatsheet}>
                  Open cheatsheet
                </button>
              ) : null}
              <button
                ref={primaryActionRef}
                type="button"
                className="primary-button"
                onClick={onComplete}
              >
                Finish
              </button>
            </>
          ) : (
            <button
              ref={primaryActionRef}
              type="button"
              className="primary-button"
              onClick={() => setStepIndex((current) => Math.min(current + 1, STEPS.length - 1))}
            >
              Next
            </button>
          )}
        </div>
      </footer>
    </UnifiedPanelShell>
  )
}
