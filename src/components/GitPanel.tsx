import { useEffect, useMemo, useState } from 'react'
import { GitBranch } from 'lucide-react'

import { buildAutoCommitMessage } from '../lib/autoCommitMessage'
import { UnifiedPanelShell } from './chrome/UnifiedPanelShell'
import { GitDiffPreview } from './GitDiffPreview'
import type { PanelPresentation } from '../hooks/usePanelPresentation'
import type { GitStatus } from '../types/vault'
import { useI18n } from '../lib/i18n'

type PendingGitAction =
  | { kind: 'commit'; files: string[]; message: string }
  | { kind: 'pull' }
  | { kind: 'push' }

type GitTab = 'changes' | 'diff'

interface GitPanelProps {
  status: GitStatus | null
  activePath: string | null
  isBusy: boolean
  presentation?: PanelPresentation
  onClose: () => void
  onRefresh: () => void
  onCommit: (files: string[], message: string) => void
  onPull: () => void
  onPush: () => void
  onResolveConflict?: (path: string) => void
  onOpenNote?: (path: string) => void
  readNoteAtHead?: (path: string) => Promise<string | null>
  readNoteWorking?: (path: string) => Promise<string | null>
}

export function GitPanel({
  status,
  activePath,
  isBusy,
  presentation = 'modal',
  onClose,
  onRefresh,
  onCommit,
  onPull,
  onPush,
  onResolveConflict,
  onOpenNote,
  readNoteAtHead,
  readNoteWorking,
}: GitPanelProps) {
  const { t } = useI18n()
  const [messageDraft, setMessageDraft] = useState<{ fingerprint: string; value: string } | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pendingAction, setPendingAction] = useState<PendingGitAction | null>(null)
  const [tab, setTab] = useState<GitTab>('changes')
  const [diffPath, setDiffPath] = useState<string | null>(null)
  const [diffState, setDiffState] = useState<{
    path: string
    before: string
    after: string
    error: string | null
  } | null>(null)

  const changedPaths = useMemo(
    () => status?.changed_files.map((file) => file.path) ?? [],
    [status],
  )

  const changedFingerprint = changedPaths.join('|')
  const automaticMessage = changedPaths.length > 0
    ? buildAutoCommitMessage(changedPaths)
    : 'Update vault notes'
  const message = messageDraft?.fingerprint === changedFingerprint
    ? messageDraft.value
    : automaticMessage
  const setMessage = (value: string) => {
    setMessageDraft({ fingerprint: changedFingerprint, value })
  }

  const effectiveSelection = useMemo(() => {
    if (selected.size > 0) return Array.from(selected)
    if (activePath && changedPaths.includes(activePath)) return [activePath]
    return changedPaths.slice(0, 1)
  }, [activePath, changedPaths, selected])

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
            error: error instanceof Error ? error.message : 'Could not load diff preview',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [previewPath, readNoteAtHead, readNoteWorking, tab])

  const activeDiffState = diffState?.path === previewPath ? diffState : null
  const diffBefore = activeDiffState?.before ?? ''
  const diffAfter = activeDiffState?.after ?? ''
  const diffStatus = activeDiffState?.error ?? (tab === 'diff' && previewPath ? 'Loading diff preview…' : '')

  const noteLabel = (path: string) => path.replace(/\.md$/i, '').split(/[\\/]/).pop() ?? path

  const commitTemplates = [
    'Update vault notes',
    'Draft: refine active note',
    'Organize knowledge links and tags',
  ] as const

  if (!status?.is_repo) {
    return (
      <UnifiedPanelShell
        title={t('git.title')}
        subtitle={t('git.subtitle')}
        icon={<GitBranch size={18} />}
        ariaLabel={t('git.status')}
        onClose={onClose}
        presentation={presentation}
        className="git-panel knowledge-filters-panel"
      >
        <p className="empty-state">{t('git.notARepo')}</p>
      </UnifiedPanelShell>
    )
  }

  return (
    <UnifiedPanelShell
      title={t('git.title')}
      subtitle={`${status.branch ?? t('git.detached')}${status.has_upstream ? ` · ${t('git.aheadBehind', { ahead: status.ahead, behind: status.behind })}` : ''}`}
      icon={<GitBranch size={18} />}
      ariaLabel={t('git.status')}
      onClose={onClose}
      presentation={presentation}
      className="git-panel knowledge-filters-panel"
      wide
      tabs={[
        { id: 'changes', label: t('git.changes') },
        { id: 'diff', label: t('git.headDiff') },
      ]}
      activeTab={tab}
      onTabChange={(next) => setTab(next as GitTab)}
      headerActions={
        <button type="button" className="toolbar-button" disabled={isBusy} onClick={onRefresh}>
          {t('actions.refresh')}
        </button>
      }
    >
      {status.has_conflicts ? (
        <p className="git-conflict-banner" role="alert">
          {t('git.mergeConflict', { count: status.conflicted_files.length })}
        </p>
      ) : null}

      {tab === 'changes' ? (
        <>
          <div className="git-actions">
            <button
              type="button"
              className="toolbar-button"
              disabled={isBusy || !status.has_upstream || status.has_conflicts}
              onClick={() => setPendingAction({ kind: 'pull' })}
            >
              {t('git.pull')}
            </button>
            <button
              type="button"
              className="toolbar-button"
              disabled={isBusy || !status.has_upstream || status.has_conflicts}
              onClick={() => setPendingAction({ kind: 'push' })}
            >
              {t('git.push')}
            </button>
          </div>

          <div className="git-changes">
            <strong>{status.clean ? 'Working tree clean' : `${status.changed_files.length} changed file(s)`}</strong>
            {activePath && changedPaths.includes(activePath) ? (
              <p className="health-subtitle git-active-note">Active note has uncommitted changes: {noteLabel(activePath)}</p>
            ) : null}
            {!status.clean && (
              <ul>
                {status.changed_files.map((file) => (
                  <li key={file.path} className={file.path === activePath ? 'git-file-active' : undefined}>
                    <label>
                      <input
                        type="checkbox"
                        checked={effectiveSelection.includes(file.path)}
                        onChange={(event) => {
                          setSelected((current) => {
                            const next = new Set(current.size > 0 ? current : effectiveSelection)
                            if (event.target.checked) {
                              next.add(file.path)
                            } else {
                              next.delete(file.path)
                            }
                            return next
                          })
                        }}
                      />
                      <span>
                        {file.path.endsWith('.md') ? (
                          <button type="button" className="git-note-link" onClick={() => onOpenNote?.(file.path)}>
                            {noteLabel(file.path)}
                          </button>
                        ) : (
                          file.path
                        )}
                        {file.path.endsWith('.md') ? <small className="git-file-path">{file.path}</small> : null}
                      </span>
                      <small>{file.conflict ? 'conflict' : file.status}</small>
                      {file.path.endsWith('.md') ? (
                        <button type="button" onClick={() => {
                          setDiffPath(file.path)
                          setTab('diff')
                        }}>
                          Preview diff
                        </button>
                      ) : null}
                      {file.conflict && onResolveConflict ? (
                        <button
                          type="button"
                          className="conflict-resolve-btn"
                          onClick={() => onResolveConflict(file.path)}
                        >
                          Resolve
                        </button>
                      ) : null}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!status.clean && (
            <form
              className="git-commit-form"
              onSubmit={(event) => {
                event.preventDefault()
                if (effectiveSelection.length === 0) return
                setPendingAction({
                  kind: 'commit',
                  files: effectiveSelection,
                  message: message.trim() || 'Update vault notes',
                })
              }}
            >
              <label>
                <span>{t('git.commitMessagePlaceholder')}</span>
                <input value={message} onChange={(event) => setMessage(event.target.value)} required />
              </label>
              <div className="git-commit-templates" aria-label={t('git.commitMessagePlaceholder')}>
                {commitTemplates.map((template) => (
                  <button key={template} type="button" className="toolbar-button" onClick={() => setMessage(template)}>
                    {template}
                  </button>
                ))}
              </div>
              <button type="submit" className="primary-button" disabled={isBusy || effectiveSelection.length === 0}>
                {t('git.commitSelected')}
              </button>
            </form>
          )}
        </>
      ) : (
        <div className="git-diff-tab">
          {previewPath ? (
            <>
              <label className="git-diff-picker">
                <span>Note</span>
                <select value={previewPath} onChange={(event) => setDiffPath(event.target.value)}>
                  {changedPaths
                    .filter((path) => path.endsWith('.md'))
                    .map((path) => (
                      <option key={path} value={path}>
                        {noteLabel(path)}
                      </option>
                    ))}
                </select>
              </label>
              {diffStatus ? <p className="health-subtitle">{diffStatus}</p> : null}
              <GitDiffPreview path={previewPath} before={diffBefore} after={diffAfter} />
              {onOpenNote ? (
                <button type="button" className="toolbar-button" onClick={() => onOpenNote(previewPath)}>
                  {t('actions.open')}
                </button>
              ) : null}
            </>
          ) : (
            <p className="empty-state">{t('git.noChanges')}</p>
          )}
        </div>
      )}

      {pendingAction ? (
        <div className="git-confirm-dialog" role="alertdialog" aria-label={t('git.confirmAction')}>
          <p>
            {pendingAction.kind === 'commit'
              ? t('git.commitSelected') + ` ${pendingAction.files.length} file(s) "${pendingAction.message}"?`
              : pendingAction.kind === 'pull'
                ? t('git.pull') + '?'
                : t('git.push') + '?'}
          </p>
          {pendingAction.kind === 'commit' ? (
            <ul className="git-confirm-files">
              {pendingAction.files.map((path) => (
                <li key={path}>{path}</li>
              ))}
            </ul>
          ) : null}
          <div className="git-confirm-actions">
            <button type="button" className="toolbar-button" onClick={() => setPendingAction(null)}>
              {t('actions.cancel')}
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={isBusy}
              onClick={() => {
                if (pendingAction.kind === 'commit') {
                  onCommit(pendingAction.files, pendingAction.message)
                } else if (pendingAction.kind === 'pull') {
                  onPull()
                } else {
                  onPush()
                }
                setPendingAction(null)
              }}
            >
              {t('actions.check')}
            </button>
          </div>
        </div>
      ) : null}
    </UnifiedPanelShell>
  )
}
