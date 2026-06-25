import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

import { vaultFrontmatterSet } from '../bridge/commands'

interface FrontmatterInspectorProps {
  path: string
  fields: Record<string, unknown>
  onClose: () => void
  onSaved: () => void
}

export function FrontmatterInspector({ path, fields, onClose, onSaved }: FrontmatterInspectorProps) {
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [status, setStatus] = useState('')

  useEffect(() => {
    const next: Record<string, string> = {}
    for (const [key, value] of Object.entries(fields)) {
      next[key] = value == null ? '' : String(value)
    }
    setDraft(next)
  }, [fields, path])

  const saveField = async (field: string) => {
    setStatus('Saving…')
    try {
      await vaultFrontmatterSet(path, field, draft[field] ?? '')
      setStatus(`Saved ${field}`)
      onSaved()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save field')
    }
  }

  const entries = Object.keys(draft).sort((left, right) => left.localeCompare(right))

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="frontmatter-inspector" role="dialog" aria-label="Frontmatter" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Frontmatter</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </header>
        <p className="health-subtitle">{path}</p>
        {entries.length === 0 ? (
          <p className="empty-state">No frontmatter fields on this note.</p>
        ) : (
          <ul className="frontmatter-fields">
            {entries.map((field) => (
              <li key={field}>
                <label>
                  {field}
                  <input
                    value={draft[field] ?? ''}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, [field]: event.target.value }))
                    }
                  />
                </label>
                <button type="button" className="toolbar-button" onClick={() => void saveField(field)}>
                  Save
                </button>
              </li>
            ))}
          </ul>
        )}
        {status ? <p className="settings-status">{status}</p> : null}
      </section>
    </div>
  )
}
