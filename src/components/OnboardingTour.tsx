import { useRef, useState } from 'react'
import { UnifiedPanelShell } from './chrome/UnifiedPanelShell'
import { getGuide } from '../lib/help/catalog'
import { requestHelp } from '../lib/help/request'

interface OnboardingTourProps {
  onComplete: () => void
  onOpenCheatsheet?: () => void
}

const steps = getGuide('workspace').steps

/** One short first-run overview; detailed contextual tours remain user-invoked. */
export function OnboardingTour({ onComplete, onOpenCheatsheet }: OnboardingTourProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const primaryActionRef = useRef<HTMLButtonElement>(null)
  const step = steps[stepIndex]!
  const isLast = stepIndex >= steps.length - 1
  const openHelp = () => {
    onComplete()
    window.requestAnimationFrame(() => requestHelp('help'))
  }

  const progress = (
    <div className="onboarding-progress-meta">
      <span className="onboarding-step-label">Step {stepIndex + 1} of {steps.length}</span>
      <progress className="onboarding-progress" max={steps.length} value={stepIndex + 1} aria-label={`Tour progress: step ${stepIndex + 1} of ${steps.length}`} />
    </div>
  )

  return (
    <UnifiedPanelShell
      title={step[0]}
      subtitle={step[1]}
      ariaLabel="Product tour"
      helpTopic="workspace"
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
        <button type="button" className="toolbar-button onboarding-skip" onClick={onComplete}>Skip tour</button>
        <div className="onboarding-next-actions">
          {stepIndex > 0 ? <button type="button" className="toolbar-button" onClick={() => setStepIndex((current) => Math.max(0, current - 1))}>Back</button> : null}
          {isLast ? (
            <>
              <button type="button" className="toolbar-button" onClick={openHelp}>Help &amp; guides</button>
              {onOpenCheatsheet ? <button type="button" className="toolbar-button" onClick={onOpenCheatsheet}>Open cheatsheet</button> : null}
              <button ref={primaryActionRef} type="button" className="primary-button" onClick={onComplete}>Finish</button>
            </>
          ) : <button ref={primaryActionRef} type="button" className="primary-button" onClick={() => setStepIndex((current) => Math.min(current + 1, steps.length - 1))}>Next</button>}
        </div>
      </footer>
    </UnifiedPanelShell>
  )
}
