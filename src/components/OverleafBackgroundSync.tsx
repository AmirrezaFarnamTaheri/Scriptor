import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { overleafRead, overleafPush } from '../bridge/commands/overleaf'
import { sourceFileRead, sourceFileSave } from '../bridge/commands/source_files'
import { autoSyncPreferenceKey, decideAutoSync, readAutoSyncEnabled } from '../lib/autoSyncPreference'
import { overleafBindingKey, readOverleafBinding } from '../lib/overleafBinding'
import type { SourceDocument } from '../lib/sourceFile'

interface Props {
  document: SourceDocument
  canTransfer: () => boolean
  onApplied: (document: SourceDocument) => void
  onStatus: (status: string) => void
}

/** File-scoped background watch while the Source editor is open.
 * This is bounded Git snapshot synchronization, not character-level editing.
 * Never apply an unknown or concurrent history without an explicit review. */
export function OverleafBackgroundSync({ document, canTransfer, onApplied, onStatus }: Props) {
  const callbacks = useRef({ canTransfer, onApplied, onStatus })
  useLayoutEffect(() => { callbacks.current = { canTransfer, onApplied, onStatus } }, [canTransfer, onApplied, onStatus])
  const baseline = useRef<{ key: string; text: string } | null>(null)
  const lastNotice = useRef('')
  const scope = useMemo(() => {
    try {
      const binding = readOverleafBinding(localStorage, overleafBindingKey(document.vault_id, document.path))
      if (!binding) return null
      return {
        ...binding,
        key: autoSyncPreferenceKey('overleaf', document.vault_id, binding.projectId, binding.remotePath),
      }
    } catch { return null }
  }, [document.vault_id, document.path])

  useEffect(() => {
    if (!scope || !readAutoSyncEnabled(localStorage, scope.key)) return
    let live = true
    let timer: ReturnType<typeof setTimeout> | null = null
    const allowed = () => live && callbacks.current.canTransfer()
      && readAutoSyncEnabled(localStorage, scope.key)
    const note = (message: string) => {
      if (live && lastNotice.current !== message) {
        lastNotice.current = message
        callbacks.current.onStatus(message)
      }
    }
    const schedule = (delay: number) => {
      if (live && readAutoSyncEnabled(localStorage, scope.key)) timer = setTimeout(() => { void tick() }, delay)
    }
    const tick = async () => {
      if (!live || !readAutoSyncEnabled(localStorage, scope.key)) return
      if (window.document.hidden || !callbacks.current.canTransfer()) { schedule(30_000); return }
      try {
        const local = await sourceFileRead(document.vault_id, document.path)
        if (!allowed()) return
        const remote = await overleafRead(document.vault_id, scope.projectId, scope.remotePath)
        if (!allowed()) return
        const previous = baseline.current?.key === scope.key ? baseline.current.text : null
        const direction = decideAutoSync(previous, local.content, remote.content)
        if (direction === 'equal') {
          baseline.current = { key: scope.key, text: local.content }
        } else if (direction === 'pull' && remote.content !== null) {
          if (!allowed()) return
          const saved = await sourceFileSave(local, remote.content)
          if (!live) return
          baseline.current = { key: scope.key, text: remote.content }
          callbacks.current.onApplied(saved)
          note('Auto-sync imported a co-author update from Overleaf. Local save was checked for conflicts.')
        } else if (direction === 'push' && remote.content !== null) {
          if (!allowed()) return
          await overleafPush(document.vault_id, scope.projectId, scope.remotePath, local.content, remote)
          if (!live) return
          baseline.current = { key: scope.key, text: local.content }
          note('Auto-sync shared a saved source change with Overleaf.')
        } else {
          note('Overleaf and the saved local file differ without a known shared base. Open Overleaf sync to review; nothing was overwritten.')
        }
      } catch (caught) {
        if (!live) return
        live = false
        note(`Overleaf auto-sync paused after an error: ${caught instanceof Error ? caught.message : String(caught)}. Open Overleaf sync to review and retry.`)
      } finally {
        if (live) schedule(30_000)
      }
    }
    const resumed = () => {
      if (live && !window.document.hidden) {
        if (timer) clearTimeout(timer)
        schedule(1_000)
      }
    }
    window.document.addEventListener('visibilitychange', resumed)
    schedule(1_000)
    return () => {
      live = false
      if (timer) clearTimeout(timer)
      window.document.removeEventListener('visibilitychange', resumed)
    }
  }, [scope, document.vault_id, document.path])
  return null
}
