import { AlertTriangle } from 'lucide-react'

import type { ExternalChangeConflict } from '../types/vault'

interface ExternalChangeBannerProps {
  conflict: ExternalChangeConflict
  onReload: () => void
  onKeepEditing: () => void
}

export function ExternalChangeBanner({ conflict, onReload, onKeepEditing }: ExternalChangeBannerProps) {
  return (
    <div className="external-change-banner" role="alert">
      <AlertTriangle aria-hidden="true" />
      <div className="external-change-banner-copy">
        <strong>This note changed on disk</strong>
        <span>
          {conflict.path} was modified externally while you have unsaved edits.
        </span>
      </div>
      <div className="external-change-banner-actions">
        <button type="button" className="toolbar-button" onClick={onReload}>
          Reload from disk
        </button>
        <button type="button" className="toolbar-button" onClick={onKeepEditing}>
          Keep editing
        </button>
      </div>
    </div>
  )
}
