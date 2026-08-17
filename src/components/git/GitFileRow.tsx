import React, { useId } from 'react'
import type { GitChangedFile } from '../../types/vault'
import { useI18n } from '../../lib/i18n'

export interface GitFileRowProps {
  file: GitChangedFile
  isActive: boolean
  isSelected: boolean
  onToggleSelect: (path: string, selected: boolean) => void
  onOpenNote?: (path: string) => void
  onPreviewDiff?: (path: string) => void
  onResolveConflict?: (path: string) => void
}

export const GitFileRow = React.memo(function GitFileRow({
  file,
  isActive,
  isSelected,
  onToggleSelect,
  onOpenNote,
  onPreviewDiff,
  onResolveConflict,
}: GitFileRowProps) {
  const { t } = useI18n()
  const checkboxId = useId()
  const isMarkdown = file.path.endsWith('.md')
  const noteLabel = file.path.replace(/\.md$/i, '').split(/[\\/]/).pop() ?? file.path

  return (
    <li className={isActive ? 'git-file-active' : undefined}>
      <div className="git-file-selection">
        <input
          id={checkboxId}
          type="checkbox"
          checked={isSelected}
          onChange={(event) => onToggleSelect(file.path, event.target.checked)}
        />
        <label htmlFor={checkboxId}>
          <span>
            {isMarkdown ? noteLabel : file.path}
            {isMarkdown ? <small className="git-file-path">{file.path}</small> : null}
          </span>
          <small>{file.conflict ? t('git.conflict') : file.status}</small>
        </label>
      </div>
      <div className="git-file-row-actions">
        {isMarkdown && onOpenNote ? (
          <button type="button" className="git-note-link" onClick={() => onOpenNote(file.path)}>
            {t('git.openNote')}
          </button>
        ) : null}
        {isMarkdown && onPreviewDiff ? (
          <button type="button" onClick={() => onPreviewDiff(file.path)}>
            {t('git.previewDiff')}
          </button>
        ) : null}
        {file.conflict && onResolveConflict ? (
          <button
            type="button"
            className="conflict-resolve-btn"
            onClick={() => onResolveConflict(file.path)}
          >
            {t('git.resolve')}
          </button>
        ) : null}
      </div>
    </li>
  )
})
