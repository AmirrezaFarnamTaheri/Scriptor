import { AlertTriangle } from 'lucide-react'
import { ExternalChangeActions } from './ExternalChangeActions'

import type { ExternalChangeConflict } from '../types/vault'

interface ExternalChangeBannerProps {
  conflict: ExternalChangeConflict
  onReload: () => void
  onKeepEditing: () => void
}

export function ExternalChangeBanner({ conflict, onReload, onKeepEditing }: ExternalChangeBannerProps) {
  return (
    <div className="external-change-banner" role="alert" data-help-topic="recovery">
      <AlertTriangle aria-hidden="true" />
      <div className="external-change-banner-copy">
        <strong>This note changed on disk</strong>
        <span>
          <bdi>{conflict.path}</bdi> was modified outside Scriptor while you have unsaved edits.
        </span>
      </div>
      <ExternalChangeActions path={conflict.path} onReload={onReload} onKeepEditing={onKeepEditing} />
    </div>
  )
}
