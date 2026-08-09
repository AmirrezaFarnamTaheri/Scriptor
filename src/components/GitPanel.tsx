import { AlertCircle, CheckCircle2, GitBranch, RefreshCw } from 'lucide-react'
import { UnifiedPanelShell } from './chrome/UnifiedPanelShell'
import { GitDiffPreview } from './GitDiffPreview'
import { GitFileRow } from './git/GitFileRow'
import { GitConfirmDialog } from './git/GitConfirmDialog'
import { useGitPanelState, type GitTab } from '../hooks/useGitPanelState'
import type { PanelPresentation } from '../hooks/usePanelPresentation'
import type { GitStatus } from '../types/vault'
import { useI18n } from '../lib/i18n'

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
  onPull: () => void
  onPush: () => void
  onResolveConflict?: (path: string) => void
  onOpenNote?: (path: string) => void
  readNoteAtHead?: (path: string) => Promise<string | null>
  readNoteWorking?: (path: string) => Promise<string | null>
}

/** Renders repository status, selection, diff, and confirmation flows for the active vault. */
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
    diffPath,
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
  const commitTemplates = [
    t('git.updateVaultNotes'),
    t('git.draftRefineActiveNote'),
    t('git.organizeLinksAndTags'),
  ] as const

  if (panelState === 'loading') {
    return (
      <UnifiedPanelShell
        title={t('git.title')}
        subtitle={t('git.checkingStatus')}
        icon={<GitBranch size={18} />}
        ariaLabel={t('git.status')}
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
        ariaLabel={t('git.status')}
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
            <strong>
              {status.clean
                ? t('git.workingTreeClean')
                : t('git.changedFiles', { count: status.changed_files.length })}
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
              <ul>
                {status.changed_files.map((file) => (
                  <GitFileRow
                    key={file.path}
                    file={file}
                    isActive={file.path === activePath}
                    isSelected={effectiveSelection.includes(file.path)}
                    onToggleSelect={handleToggleSelect}
                    onOpenNote={onOpenNote}
                    onPreviewDiff={handlePreviewDiff}
                    onResolveConflict={onResolveConflict}
                  />
                ))}
              </ul>
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
              onPull()
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
