import { useCallback, useEffect, useMemo, useState } from 'react'
import { deriveEffectiveGitSelection, selectGitPanelState } from '../lib/gitPanelState'
import { buildAutoCommitMessage } from '../lib/autoCommitMessage'
import type { GitStatus } from '../types/vault'
import { useI18n } from '../lib/i18n'
import type { PendingGitAction } from '../components/git/GitConfirmDialog'

export type GitTab = 'changes' | 'diff'

export interface UseGitPanelStateParams {
  status: GitStatus | null
  statusError: string | null
  isStatusLoading: boolean
  activePath: string | null
  readNoteAtHead?: (path: string) => Promise<string | null>
  readNoteWorking?: (path: string) => Promise<string | null>
}

export function useGitPanelState({
  status,
  statusError,
  isStatusLoading,
  activePath,
  readNoteAtHead,
  readNoteWorking,
}: UseGitPanelStateParams) {
  const { t } = useI18n()
  const [messageDraft, setMessageDraft] = useState<{ fingerprint: string; value: string } | null>(null)
  const [selected, setSelected] = useState<Set<string> | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingGitAction | null>(null)
  const [tab, setTab] = useState<GitTab>('changes')
  const [diffPath, setDiffPath] = useState<string | null>(null)
  const [diffState, setDiffState] = useState<{
    path: string
    before: string
    after: string
    error: string | null
  } | null>(null)

  const panelState = selectGitPanelState(status, statusError, isStatusLoading)
  const changedPaths = useMemo(
    () => status?.changed_files.map((file) => file.path) ?? [],
    [status],
  )

  const changedFingerprint = changedPaths.join('|')
  const automaticMessage = changedPaths.length > 0
    ? buildAutoCommitMessage(changedPaths)
    : t('git.updateVaultNotes')
  const message = messageDraft?.fingerprint === changedFingerprint
    ? messageDraft.value
    : automaticMessage

  const setMessage = useCallback((value: string) => {
    setMessageDraft({ fingerprint: changedFingerprint, value })
  }, [changedFingerprint])

  const defaultSelection = useMemo(() => {
    if (activePath && changedPaths.includes(activePath)) return [activePath]
    return changedPaths.slice(0, 1)
  }, [activePath, changedPaths])

  const effectiveSelection = useMemo(
    () => deriveEffectiveGitSelection(selected, changedPaths, defaultSelection),
    [changedPaths, defaultSelection, selected],
  )

  const handleToggleSelect = useCallback((path: string, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current ?? defaultSelection)
      if (checked) {
        next.add(path)
      } else {
        next.delete(path)
      }
      return next
    })
  }, [defaultSelection])

  const handlePreviewDiff = useCallback((path: string) => {
    setDiffPath(path)
    setTab('diff')
  }, [])

  const previewPath = diffPath ?? (activePath && changedPaths.includes(activePath) ? activePath : effectiveSelection[0] ?? null)

  useEffect(() => {
    if (tab !== 'diff' || !previewPath) return
    let cancelled = false
    const requestedPath = previewPath
    const readBefore = readNoteAtHead ? readNoteAtHead(requestedPath) : Promise.resolve(null)
    const readWorking = readNoteWorking ? readNoteWorking(requestedPath) : Promise.resolve(null)
    void Promise.all([readBefore, readWorking])
      .then(async ([head, working]) => {
        const before = head ?? ''
        const after = working ?? (readNoteAtHead ? (await readNoteAtHead(requestedPath)) ?? '' : '')
        if (!cancelled) setDiffState({ path: requestedPath, before, after, error: null })
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setDiffState({
            path: requestedPath,
            before: '',
            after: '',
            error: error instanceof Error ? error.message : t('git.couldNotLoadDiff'),
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [previewPath, readNoteAtHead, readNoteWorking, t, tab])

  const activeDiffState = diffState?.path === previewPath ? diffState : null
  const diffBefore = activeDiffState?.before ?? ''
  const diffAfter = activeDiffState?.after ?? ''
  const diffStatus = activeDiffState?.error ?? (tab === 'diff' && previewPath ? t('git.loadingDiff') : '')

  return {
    panelState,
    changedPaths,
    message,
    setMessage,
    effectiveSelection,
    pendingAction,
    setPendingAction,
    tab,
    setTab,
    diffPath,
    setDiffPath,
    previewPath,
    diffBefore,
    diffAfter,
    diffStatus,
    handleToggleSelect,
    handlePreviewDiff,
  }
}
