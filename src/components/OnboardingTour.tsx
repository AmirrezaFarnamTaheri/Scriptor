import { useMemo, useRef, useState } from 'react'

import { UnifiedPanelShell } from './chrome/UnifiedPanelShell'
import { formatShortcut } from '../lib/keyboardShortcuts'

interface TourStep {
  title: string
  body: string
}

interface OnboardingTourProps {
  onComplete: () => void
  onOpenCheatsheet?: () => void
}

/** Guides first-run users without asking them to interact with controls hidden behind the modal. */
export function OnboardingTour({ onComplete, onOpenCheatsheet }: OnboardingTourProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const primaryActionRef = useRef<HTMLButtonElement>(null)
  const commandShortcut = useMemo(() => formatShortcut('Mod+K') ?? 'Ctrl+K', [])
  const steps = useMemo<readonly TourStep[]>(
    () => [
      {
        title: 'Your vault',
        body: 'Scriptor works with a folder of Markdown notes. After this tour, Open Vault in the top bar lets you choose one; an already-open vault appears in the left sidebar.',
      },
      {
        title: 'Search notes',
        body: 'The search field in the vault sidebar searches note content. Press F while you are not typing to focus it quickly.',
      },
      {
        title: 'Command palette',
        body: `Press ${commandShortcut} or click the command field in the top bar to run commands and open notes quickly.`,
      },
      {
        title: 'Inspector rail',
        body: 'The right rail holds document structure, links, references, rendered output, and plugin tools. Collapse it when you want more writing space.',
      },
      {
        title: 'Editor tools',
        body: 'Frequent formatting stays in the editor bar. Less-used structure and workflow actions are grouped in the Structure, Insert, Typography, and Tools menus.',
      },
    ],
    [commandShortcut],
  )
  const step = steps[stepIndex]
  const isLast = stepIndex >= steps.length - 1

  const progress = (
    <div className="onboarding-progress-meta">
      <span className="onboarding-step-label">
        Step {stepIndex + 1} of {steps.length}
      </span>
      <progress
        className="onboarding-progress"
        max={steps.length}
        value={stepIndex + 1}
        aria-label={`Tour progress: step ${stepIndex + 1} of ${steps.length}`}
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
          {stepIndex > 0 ? (
            <button
              type="button"
              className="toolbar-button"
              onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
            >
              Back
            </button>
          ) : null}
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
              onClick={() => setStepIndex((current) => Math.min(current + 1, steps.length - 1))}
            >
              Next
            </button>
          )}
        </div>
      </footer>
    </UnifiedPanelShell>
  )
}
