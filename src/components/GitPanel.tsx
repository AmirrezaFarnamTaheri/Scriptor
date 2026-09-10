import { AlertCircle, CheckCircle2, GitBranch, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { formatLocalDate } from '@scriptor/core/date'
import { UnifiedPanelShell } from './chrome/UnifiedPanelShell'
import { GitDiffPreview } from './GitDiffPreview'
import { GitFileRow } from './git/GitFileRow'
import { GitConfirmDialog } from './git/GitConfirmDialog'
import { useGitPanelState, type GitTab } from '../hooks/useGitPanelState'
import type { PanelPresentation } from '../hooks/usePanelPresentation'
import type { GitPullStrategy } from '../bridge/commands/git'
import type { GitStatus } from '../types/vault'
import { useI18n } from '../lib/i18n'
import { evaluate } from '@scriptor/template-engine'

export interface GitPanelProps {
  status: GitStatus | null
  statusError: string | null
  isStatusLoading: boolean
  activePath: string | null
  isBusy: boolean
  presentation?: PanelPresentation
  onClose: () => void
  onRefresh: () => void
  onCommit: (files: string[], message: string) => void
  onPull: (strategy: GitPullStrategy) => void
  onPush: () => void
  onResolveConflict?: (path: string) => void
  onOpenNote?: (path: string) => void
  readNoteAtHead?: (path: string) => Promise<string | null>
  readNoteWorking?: (path: string) => Promise<string | null>
}

const GIT_ROW_HEIGHT = 56
const GIT_ROW_OVERSCAN = 8

export function GitPanel({
  status,
  statusError,
  isStatusLoading,
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
  const {
    panelState,
    changedPaths,
    message,
    setMessage,
    effectiveSelection,
    pendingAction,
    setPendingAction,
    tab,
    setTab,
    diffPath: _diffPath,
    setDiffPath,
    previewPath,
    diffBefore,
    diffAfter,
    diffStatus,
    handleToggleSelect,
    handlePreviewDiff,
  } = useGitPanelState({
    status,
    statusError,
    isStatusLoading,
    activePath,
    readNoteAtHead,
    readNoteWorking,
  })

  const noteLabel = (path: string) => path.replace(/\.md$/i, '').split(/[\\/]/).pop() ?? path
  const RAW_COMMIT_TEMPLATES = [
    t('git.updateVaultNotes'),
    t('git.draftRefineActiveNote'),
    t('git.organizeLinksAndTags'),
  ]
  const [commitTemplates, setCommitTemplates] = useState<string[]>(RAW_COMMIT_TEMPLATES)
  const [pullStrategy, setPullStrategy] = useState<GitPullStrategy>('fast-forward')
  const [listScrollTop, setListScrollTop] = useState(0)
  const [listViewportHeight, setListViewportHeight] = useState(420)
  const listViewportRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const viewport = listViewportRef.current
    if (!viewport || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setListViewportHeight(entry.contentRect.height)
    })
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const today = formatLocalDate()
    const numFiles = effectiveSelection.length
    const files = effectiveSelection.map(noteLabel).join(', ')
    const ctx = { date: today, numFiles: String(numFiles), files }

    let cancelled = false
    Promise.all(
      RAW_COMMIT_TEMPLATES.map((template) =>
        evaluate(template, { context: ctx })
          .then(({ text }) => text)
          .catch(() => template),
      ),
    ).then((resolved) => {
      if (!cancelled) setCommitTemplates(resolved)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveSelection.length, effectiveSelection.join(',')])

  if (panelState === 'loading') {
    return (
      <UnifiedPanelShell
        title={t('git.title')}
        subtitle={t('git.checkingStatus')}
        icon={<GitBranch size={18} />}
        ariaLabel={t('git.title')}
        onClose={onClose}
        presentation={presentation}
        className="git-panel knowledge-filters-panel"
      >
        <div className="git-skeleton-loading" aria-busy="true" aria-label={t('git.loadingStatus')}>
          <div className="vault-skeleton-folder" />
          <div className="vault-skeleton-row" />
          <div className="vault-skeleton-row" />
          <div className="vault-skeleton-row" />
        </div>
      </UnifiedPanelShell>
    )
  }

  if (panelState === 'error') {
    return (
      <UnifiedPanelShell
        title={t('git.title')}
        subtitle={t('git.statusUnavailable')}
        icon={<GitBranch size={18} />}
        ariaLabel={t('git.title')}
        onClose={onClose}
        presentation={presentation}
        className="git-panel knowledge-filters-panel"
      >
        <div className="preview-error-state" role="alert">
          <AlertCircle size={24} className="text-danger" />
          <p>{statusError}</p>
          <button type="button" className="toolbar-button" disabled={isStatusLoading} onClick={onRefresh}>
            <RefreshCw size={14} />
            {t('actions.retry')}
          </button>
        </div>
      </UnifiedPanelShell>
    )
  }

  if (panelState === 'not-repository' || !status) {
    return (
      <UnifiedPanelShell
        title={t('git.title')}
        subtitle={t('git.subtitle')}
        icon={<GitBranch size={18} />}
        ariaLabel={t('git.title')}
        onClose={onClose}
        presentation={presentation}
        className="git-panel knowledge-filters-panel"
      >
        <p className="empty-state">{t('git.notARepo')}</p>
      </UnifiedPanelShell>
    )
  }

  const canPull = status.has_upstream && !status.has_conflicts
  const canPush = status.has_upstream && status.ahead > 0 && !status.has_conflicts
  const diverged = status.ahead > 0 && status.behind > 0

  return (
    <UnifiedPanelShell
      title={t('git.title')}
      subtitle={`${status.branch ?? t('git.detached')}${status.has_upstream ? ` · ${t('git.aheadBehind', { ahead: status.ahead, behind: status.behind })}` : ''}`}
      icon={<GitBranch size={18} />}
      ariaLabel={t('git.title')}
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
        <button type="button" className="toolbar-button" disabled={isBusy || isStatusLoading} onClick={onRefresh}>
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
          <div className="git-actions" aria-label="Remote synchronization">
            {status.has_upstream && status.ahead === 0 && status.behind === 0 ? (
              <span className="health-subtitle">Remote is up to date.</span>
            ) : null}
            {canPull ? (
              <label className="git-pull-strategy">
                <span>{diverged ? 'Diverged branches — pull strategy' : 'Pull strategy'}</span>
                <select value={pullStrategy} onChange={(event) => setPullStrategy(event.target.value as GitPullStrategy)}>
                  <option value="fast-forward">Fast-forward only</option>
                  <option value="merge">Merge commit</option>
                  <option value="rebase">Rebase local commits</option>
                </select>
              </label>
            ) : null}
            <button
              type="button"
              className="toolbar-button"
              disabled={isBusy || !canPull}
              onClick={() => setPendingAction({ kind: 'pull', strategy: pullStrategy })}
            >
              {t('git.pull')}{status.behind > 0 ? ` (${status.behind})` : ''}
            </button>
            <button
              type="button"
              className="toolbar-button"
              disabled={isBusy || !canPush}
              title={status.has_upstream && status.ahead === 0 ? 'No local commits to push' : undefined}
              onClick={() => setPendingAction({ kind: 'push' })}
            >
              {t('git.push')}{status.ahead > 0 ? ` (${status.ahead})` : ''}
            </button>
          </div>

          <div className="git-changes">
            <strong>
              {status.clean
                ? t('git.workingTreeClean')
                : t(status.changed_files.length === 1 ? 'git.changedFile' : 'git.changedFiles', { count: status.changed_files.length })}
            </strong>
            {activePath && changedPaths.includes(activePath) ? (
              <p className="health-subtitle git-active-note">
                {t('git.activeNoteChanged', { note: noteLabel(activePath) })}
              </p>
            ) : null}
            {status.clean ? (
              <div className="git-clean-state">
                <CheckCircle2 size={32} className="text-success" />
                <p>{t('git.everythingUpToDate', { branch: status.branch ?? 'HEAD' })}</p>
                <button type="button" className="toolbar-button" disabled={isBusy || isStatusLoading} onClick={onRefresh}>
                  <RefreshCw size={14} />
                  {t('actions.refresh')}
                </button>
              </div>
            ) : (
              <div
                ref={listViewportRef}
                onScroll={(event) => setListScrollTop(event.currentTarget.scrollTop)}
                style={{ maxHeight: '420px', overflowY: 'auto' }}
              >
                <ul style={{ height: status.changed_files.length * GIT_ROW_HEIGHT, position: 'relative' }}>
                  {(() => {
                    const viewport = listViewportHeight
                    const first = Math.max(0, Math.floor(listScrollTop / GIT_ROW_HEIGHT) - GIT_ROW_OVERSCAN)
                    const visible = Math.ceil(viewport / GIT_ROW_HEIGHT) + GIT_ROW_OVERSCAN * 2
                    const last = Math.min(status.changed_files.length, first + visible)
                    return status.changed_files.slice(first, last).map((file, offset) => {
                      const logicalIndex = first + offset
                      return (
                        <GitFileRow
                          key={file.path}
                          file={file}
                          isActive={file.path === activePath}
                          isSelected={effectiveSelection.includes(file.path)}
                          onToggleSelect={handleToggleSelect}
                          onOpenNote={onOpenNote}
                          onPreviewDiff={handlePreviewDiff}
                          onResolveConflict={onResolveConflict}
                          positionInSet={logicalIndex + 1}
                          setSize={status.changed_files.length}
                          style={{
                            position: 'absolute',
                            top: logicalIndex * GIT_ROW_HEIGHT,
                            left: 0,
                            right: 0,
                            height: GIT_ROW_HEIGHT,
                          }}
                        />
                      )
                    })
                  })()}
                </ul>
              </div>
            )}
          </div>

          {!status.clean ? (
            <form
              className="git-commit-form"
              onSubmit={(event) => {
                event.preventDefault()
                if (effectiveSelection.length === 0) return
                setPendingAction({
                  kind: 'commit',
                  files: effectiveSelection,
                  message: message.trim() || t('git.updateVaultNotes'),
                })
              }}
            >
              <label>
                <span>{t('git.commitMessagePlaceholder')}</span>
                <input value={message} onChange={(event) => setMessage(event.target.value)} required />
              </label>
              <details className="git-commit-template-details">
                <summary>Message suggestions</summary>
                <div className="git-commit-templates" aria-label="Commit message suggestions">
                  {commitTemplates.map((template) => (
                    <button key={template} type="button" className="toolbar-button" onClick={() => setMessage(template)}>
                      {template}
                    </button>
                  ))}
                </div>
              </details>
              <button type="submit" className="primary-button" disabled={isBusy || effectiveSelection.length === 0}>
                {t('git.commitSelected')} ({effectiveSelection.length})
              </button>
            </form>
          ) : null}
        </>
      ) : (
        <div className="git-diff-tab">
          {previewPath ? (
            <>
              <label className="git-diff-picker">
                <span>{t('git.note')}</span>
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
        <GitConfirmDialog
          pendingAction={pendingAction}
          isBusy={isBusy}
          onCancel={() => setPendingAction(null)}
          onConfirm={() => {
            if (pendingAction.kind === 'commit') {
              onCommit(pendingAction.files, pendingAction.message)
            } else if (pendingAction.kind === 'pull') {
              onPull(pendingAction.strategy)
            } else {
              onPush()
            }
            setPendingAction(null)
          }}
        />
      ) : null}
    </UnifiedPanelShell>
  )
}
