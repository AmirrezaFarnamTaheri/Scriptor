import type { ReactNode } from 'react'

interface EmptyStateProps {
  /** Icon to display (lucide-react element). */
  icon: ReactNode
  /** Short headline, e.g. "No headings yet". */
  title: string
  /** Optional supporting sentence. */
  description?: string
  /** Optional call-to-action. */
  action?: {
    label: string
    onClick: () => void
  }
  /** Extra class applied to the root element. */
  className?: string
}

/**
 * Shared empty-state treatment used across inspector panels, search results,
 * and any other zero-data view. Ensures consistent padding, iconography, and
 * copy hierarchy throughout the app.
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={`empty-state-block${className ? ` ${className}` : ''}`} aria-live="polite">
      <span className="empty-state-icon" aria-hidden="true">
        {icon}
      </span>
      <p className="empty-state-title">{title}</p>
      {description ? <p className="empty-state-desc">{description}</p> : null}
      {action ? (
        <button type="button" className="action-button" onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
    </div>
  )
}
