import { useEffect, useRef, useState } from 'react'

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

export function OnboardingTour({ onComplete, onOpenCheatsheet }: OnboardingTourProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    dialogRef.current?.focus()
  }, [stepIndex])

  const step = STEPS[stepIndex]
  const isLast = stepIndex >= STEPS.length - 1

  return (
    <div className="modal-backdrop onboarding-backdrop" role="presentation">
      <div
        ref={dialogRef}
        className="onboarding-tour"
        role="dialog"
        aria-modal="true"
        aria-label="Product tour"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            onComplete()
          }
        }}
      >
        <header>
          <span className="onboarding-step-label">
            Step {stepIndex + 1} of {STEPS.length}
          </span>
          <h2>{step.title}</h2>
        </header>
        <p>{step.body}</p>
        <footer className="onboarding-actions">
          <button type="button" className="toolbar-button" onClick={onComplete}>
            Skip tour
          </button>
          {isLast ? (
            <>
              {onOpenCheatsheet ? (
                <button type="button" className="toolbar-button" onClick={onOpenCheatsheet}>
                  Open cheatsheet
                </button>
              ) : null}
              <button type="button" className="primary-button" onClick={onComplete}>
                Finish
              </button>
            </>
          ) : (
            <button
              type="button"
              className="primary-button"
              onClick={() => setStepIndex((current) => Math.min(current + 1, STEPS.length - 1))}
            >
              Next
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}
