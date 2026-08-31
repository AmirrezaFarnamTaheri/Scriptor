import { Suspense } from 'react'

import { gitApplyMergedConflict, gitResolveConflict } from '../../bridge/commands'
import { ErrorBoundary } from '../ErrorBoundary'
import { PanelErrorFallback } from '../PanelErrorFallback'
import { ConflictResolverModal, PanelFallback } from './lazyPanels'

interface ConflictResolverSurfaceProps {
  conflictPath: string
  conflictSource: string
  conflictBasePreview: string | null
  isBusy: boolean
  onClose: () => void
  onResolved: () => void
}

/**
 * Mounts the conflict resolver modal with its error boundary and wires the
 * resolve actions to the git bridge. The caller only decides whether the
 * surface is open and how to refresh the git state after a resolution.
 */
export function ConflictResolverSurface({
  conflictPath,
  conflictSource,
  conflictBasePreview,
  isBusy,
  onClose,
  onResolved,
}: ConflictResolverSurfaceProps) {
  return (
    <ErrorBoundary
      name="conflict-resolver"
      resetKeys={[conflictPath]}
      autoRetryPanelFallback={false}
      fallback={<PanelErrorFallback title="Conflict resolver" onDismiss={onClose} />}
    >
      <Suspense fallback={<PanelFallback />}>
        <ConflictResolverModal
          key={conflictPath}
          path={conflictPath}
          source={conflictSource}
          basePreview={conflictBasePreview}
          isBusy={isBusy}
          onClose={onClose}
          onResolveQuick={(strategy) => {
            void gitResolveConflict(conflictPath, strategy).then(() => {
              onClose()
              onResolved()
            })
          }}
          onResolveMerged={(mergedMarkdown) => {
            void gitApplyMergedConflict(conflictPath, mergedMarkdown).then(() => {
              onClose()
              onResolved()
            })
          }}
        />
      </Suspense>
    </ErrorBoundary>
  )
}
