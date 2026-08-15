import { type ReactNode } from 'react'
import { X } from 'lucide-react'

interface AppToastProps {
  message: string
  onDismiss: () => void
  /** Optional icon to show beside the message (e.g. <CheckCircle2 /> for success). */
  icon?: ReactNode
}

export function AppToast({ message, onDismiss, icon }: AppToastProps) {
  return (
    <div className="app-toast" role="status" aria-live="polite" aria-atomic="true">
      {icon ? <span className="app-toast-icon" aria-hidden="true">{icon}</span> : null}
      <p>{message}</p>
      <button type="button" className="icon-button" onClick={onDismiss} aria-label="Dismiss notification">
        <X size={14} />
      </button>
    </div>
  )
}

/**
 * Wraps multiple AppToast instances in a stacking region so they don't overlap.
 * Usage: render one <AppToastRegion> and pass children as <AppToast> elements.
 */
export function AppToastRegion({ children }: { children: ReactNode }) {
  return (
    <div className="app-toast-region" aria-label="Notifications">
      {children}
    </div>
  )
}
