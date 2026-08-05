import type { CSSProperties } from 'react'
import { RotateCcw } from 'lucide-react'

/**
 * Local error fallback for panel-level ErrorBoundary boundaries.
 *
 * Styling mirrors the existing workspace design language (`--surface`,
 * `--border`, `--muted`, `--danger`, `--ink-strong` tokens and the
 * `.panel-loading` overlay geometry) without introducing new stylesheet rules.
 */

const cardStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  justifyItems: 'start',
  maxWidth: 460,
  padding: '16px 18px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--ink-strong)',
  fontSize: 13,
  lineHeight: 1.5,
  boxShadow: '0 8px 28px rgb(0 0 0 / 18%)',
}

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  fontWeight: 600,
}

const detailStyle: CSSProperties = {
  margin: 0,
  color: 'var(--muted)',
  fontSize: 12,
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  background: 'color-mix(in srgb, var(--backdrop, #000) 35%, transparent)',
  zIndex: 60,
  padding: 24,
}

const inlineStyle: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  padding: 24,
  minHeight: 120,
  height: '100%',
}

const accentBarStyle: CSSProperties = {
  width: 36,
  height: 3,
  borderRadius: 2,
  background: 'var(--danger)',
}

const actionsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
}

interface PanelErrorFallbackProps {
  /** Human-readable name of the failed surface, e.g. "Graph". */
  title: string
  /** Optional extra guidance shown under the headline. */
  detail?: string
  /** Reset action injected by ErrorBoundary for recoverable panel failures. */
  onRetry?: () => void
  /** Retry button label. */
  retryLabel?: string
  /** When provided, renders a button that closes/dismisses the failed panel. */
  onDismiss?: () => void
  /** Dismiss button label. */
  dismissLabel?: string
  /**
   * `overlay` matches the fixed full-screen geometry of `.panel-loading` and
   * suits lazily loaded modal panels. `inline` fills its parent container and
   * suits always-mounted subtrees such as the editor or preview pane.
   */
  variant?: 'overlay' | 'inline'
}

export function PanelErrorFallback({
  title,
  detail = 'This panel failed to load. The rest of the workspace is still usable.',
  onRetry,
  retryLabel = 'Retry',
  onDismiss,
  dismissLabel = 'Close',
  variant = 'overlay',
}: PanelErrorFallbackProps) {
  return (
    <div style={variant === 'overlay' ? overlayStyle : inlineStyle} role="alert" aria-live="assertive">
      <div style={cardStyle}>
        <span style={accentBarStyle} aria-hidden="true" />
        <p style={titleStyle}>{title} could not be displayed</p>
        <p style={detailStyle}>{detail}</p>
        {onRetry || onDismiss ? (
          <div style={actionsStyle}>
            {onRetry ? (
              <button
                type="button"
                className="primary-button"
                onClick={onRetry}
                autoFocus
              >
                <RotateCcw aria-hidden="true" />
                {retryLabel}
              </button>
            ) : null}
            {onDismiss ? (
              <button type="button" className="action-button" onClick={onDismiss}>
                {dismissLabel}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
