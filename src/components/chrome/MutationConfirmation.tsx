import { useEffect, useRef } from 'react'

import '../../styles/components/mutation-confirmation.css'
import { useI18n } from '../../lib/i18n'

interface MutationConfirmationProps {
  ariaLabel: string
  message: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: () => void
  busy?: boolean
  confirmDisabled?: boolean
  className?: string
}

/**
 * Compact, in-context confirmation for consequential mutations.
 *
 * This deliberately avoids spawning a nested modal. It replaces the mutation
 * trigger in-place, moves focus to the safe Cancel action, and keeps keyboard
 * users inside the parent panel's existing focus contract.
 */
export function MutationConfirmation({
  ariaLabel,
  message,
  confirmLabel,
  onCancel,
  onConfirm,
  busy = false,
  confirmDisabled = false,
  className = '',
}: MutationConfirmationProps) {
  const { t } = useI18n()
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  return (
    <div
      className={`mutation-confirmation${className ? ` ${className}` : ''}`}
      role="group"
      aria-label={ariaLabel}
    >
      <p>{message}</p>
      <div className="mutation-confirmation-actions">
        <button ref={cancelRef} type="button" className="toolbar-button" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="primary-button"
          disabled={busy || confirmDisabled}
          onClick={onConfirm}
        >
          {busy ? `${confirmLabel}…` : confirmLabel}
        </button>
      </div>
    </div>
  )
}
