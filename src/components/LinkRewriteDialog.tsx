import type { ReactNode } from 'react'

import type { LinkRewritePreview } from '../types/vault'

interface LinkRewriteDialogProps {
  title: string
  subtitle: string
  preview: LinkRewritePreview | null
  isApplying: boolean
  applyLabel?: string
  onClose: () => void
  onPreview: () => void
  onApply: () => void
  children: ReactNode
}

export function LinkRewriteDialog({
  title,
  subtitle,
  preview,
  isApplying,
  applyLabel = 'Apply rewrite',
  onClose,
  onPreview,
  onApply,
  children,
}: LinkRewriteDialogProps) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <form
        className="rename-dialog"
        role="dialog"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          onApply()
        }}
      >
        <header>
          <h2>{title}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <p className="rename-current-path">
          <span>{subtitle}</span>
        </p>

        {children}

        <div className="rename-actions">
          <button type="button" className="toolbar-button" onClick={onPreview}>
            Dry run
          </button>
          <button type="submit" className="primary-button" disabled={isApplying}>
            {isApplying ? 'Applying…' : applyLabel}
          </button>
        </div>

        {preview ? (
          <div className="rename-preview">
            <strong>
              {preview.edits} edit{preview.edits === 1 ? '' : 's'} across {preview.affected_files.length} file
              {preview.affected_files.length === 1 ? '' : 's'}
            </strong>
            <ul>
              {preview.affected_files.map((file) => (
                <li key={file}>{file}</li>
              ))}
            </ul>
            {preview.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : null}
      </form>
    </div>
  )
}
