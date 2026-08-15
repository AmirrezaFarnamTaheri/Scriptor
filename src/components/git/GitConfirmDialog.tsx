import { useI18n } from '../../lib/i18n'

export type PendingGitAction =
  | { kind: 'commit'; files: string[]; message: string }
  | { kind: 'pull' }
  | { kind: 'push' }

export interface GitConfirmDialogProps {
  pendingAction: PendingGitAction
  isBusy: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function GitConfirmDialog({
  pendingAction,
  isBusy,
  onCancel,
  onConfirm,
}: GitConfirmDialogProps) {
  const { t } = useI18n()

  return (
    <div className="git-confirm-dialog" role="alertdialog" aria-label={t('git.confirmAction')}>
      <p>
        {pendingAction.kind === 'commit'
          ? t('git.commitConfirm', { count: pendingAction.files.length, message: pendingAction.message })
          : pendingAction.kind === 'pull'
            ? t('git.pullConfirm')
            : t('git.pushConfirm')}
      </p>
      {pendingAction.kind === 'commit' ? (
        <ul className="git-confirm-files">
          {pendingAction.files.map((path) => (
            <li key={path}>{path}</li>
          ))}
        </ul>
      ) : null}
      <div className="git-confirm-actions">
        <button type="button" className="toolbar-button" onClick={onCancel}>
          {t('actions.cancel')}
        </button>
        <button
          type="button"
          className="primary-button"
          disabled={isBusy}
          onClick={onConfirm}
        >
          {t('actions.confirm')}
        </button>
      </div>
    </div>
  )
}
