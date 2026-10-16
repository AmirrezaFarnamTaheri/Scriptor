import { useState } from 'react'
import { MutationConfirmation } from './chrome/MutationConfirmation'

/** The editor banner and the diagnostics panel must use identical recovery choices. */
interface ExternalChangeActionsProps {
  path: string
  onReload?: () => void
  onKeepEditing?: () => void
}

export function ExternalChangeActions({ path, onReload, onKeepEditing }: ExternalChangeActionsProps) {
  const [pending, setPending] = useState<'disk' | 'local' | null>(null)
  return (
    <div className="external-change-banner-actions">
      <button type="button" className="toolbar-button" disabled={!onReload} onClick={() => setPending('disk')}>
        Use disk version
      </button>
      <button type="button" className="toolbar-button" disabled={!onKeepEditing} onClick={() => setPending('local')}>
        Keep my changes
      </button>
      {pending ? <MutationConfirmation
        ariaLabel={`${pending === 'disk' ? 'Use disk version' : 'Keep my changes'}: ${path}`}
        message={pending === 'disk'
          ? `Use the version of ${path} saved on disk? Your unsaved edits in Scriptor will be discarded.`
          : `Keep your edits to ${path}? On the next save, they will overwrite changes made outside Scriptor.`}
        confirmLabel={pending === 'disk' ? 'Discard my edits' : 'Overwrite disk changes'}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const action = pending
          setPending(null)
          if (action === 'disk') onReload?.()
          else onKeepEditing?.()
        }}
      /> : null}
    </div>
  )
}
