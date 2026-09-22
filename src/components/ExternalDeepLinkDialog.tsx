import { useRef } from 'react'

import type { DeepLinkTarget } from '../hooks/usePlatformShell'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useI18n } from '../lib/i18n'

export interface ExternalDeepLinkDialogProps {
  target: DeepLinkTarget
  onCancel: () => void
  onConfirm: () => void
}

/**
 * Confirms an OS/deep-link request inside Scriptor instead of delegating trust
 * decisions to a browser-native `window.confirm` surface.
 */
export function ExternalDeepLinkDialog({ target, onCancel, onConfirm }: ExternalDeepLinkDialogProps) {
  const { t } = useI18n()
  const dialogRef = useRef<HTMLDivElement>(null)

  useEscapeToClose(true, onCancel)
  useFocusTrap(dialogRef, { active: true, initialFocus: true })

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <div
        ref={dialogRef}
        className="rename-dialog external-deep-link-dialog"
        role="alertdialog"
        data-help-topic="external-links"
        aria-modal="true"
        aria-labelledby="external-deep-link-title"
        aria-describedby="external-deep-link-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="external-deep-link-title">{t('security.externalLinkTitle')}</h2>
          <button type="button" className="icon-button" onClick={onCancel} aria-label={t('actions.close')}>
            ×
          </button>
        </header>
        <p id="external-deep-link-description">
          {t('security.externalLinkDescription', {
            resource: target.kind === 'vault' ? t('security.externalLinkVault') : t('security.externalLinkNote'),
          })}
        </p>
        <code className="external-deep-link-path">{target.path}</code>
        <div className="rename-actions">
          <button type="button" className="toolbar-button" onClick={onCancel}>
            {t('actions.cancel')}
          </button>
          <button type="button" className="primary-button" onClick={onConfirm}>
            {t('security.externalLinkOpen')}
          </button>
        </div>
      </div>
    </div>
  )
}
