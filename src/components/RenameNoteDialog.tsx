import type { RenameNoteDryRunOutput } from '../types/vault'

interface RenameNoteDialogProps {
  currentPath: string
  preview: RenameNoteDryRunOutput | null
  isApplying: boolean
  onClose: () => void
  onPreview: (toPath: string, updateLinks: boolean) => void
  onApply: (toPath: string, updateLinks: boolean) => void
}

export function RenameNoteDialog({
  currentPath,
  preview,
  isApplying,
  onClose,
  onPreview,
  onApply,
}: RenameNoteDialogProps) {
  const folderPrefix = currentPath.includes('/')
    ? `${currentPath.slice(0, currentPath.lastIndexOf('/') + 1)}`
    : ''
  const defaultStem = currentPath.replace(/\.md$/i, '').split('/').pop() ?? 'note'

  const buildTargetPath = (nextName: string) => {
    const filename = nextName.endsWith('.md') ? nextName : `${nextName}.md`
    return `${folderPrefix}${filename}`
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <form
        className="rename-dialog"
        role="dialog"
        aria-label="Rename note"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          const nextName = String(data.get('name') ?? '').trim()
          const updateLinks = data.get('updateLinks') === 'on'
          if (!nextName) return
          onApply(buildTargetPath(nextName), updateLinks)
        }}
      >
        <header>
          <h2>Rename note</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <p className="rename-current-path">
          <span>Current path</span>
          <code>{currentPath}</code>
        </p>

        <label>
          <span>New filename</span>
          <input name="name" defaultValue={defaultStem} required />
        </label>

        <label className="checkbox-row">
          <input name="updateLinks" type="checkbox" defaultChecked />
          <span>Update wikilinks across the vault</span>
        </label>

        <div className="rename-actions">
          <button
            type="button"
            className="toolbar-button"
            onClick={(event) => {
              const form = (event.currentTarget.closest('form') as HTMLFormElement | null)
              if (!form) return
              const data = new FormData(form)
              const nextName = String(data.get('name') ?? '').trim()
              const updateLinks = data.get('updateLinks') === 'on'
              if (!nextName) return
              onPreview(buildTargetPath(nextName), updateLinks)
            }}
          >
            Dry run
          </button>
          <button type="submit" className="primary-button" disabled={isApplying}>
            {isApplying ? 'Applying...' : 'Apply rename'}
          </button>
        </div>

        {preview && (
          <div className="rename-preview">
            <strong>
              {preview.link_edits} link edits across {preview.affected_files.length} files
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
        )}
      </form>
    </div>
  )
}
