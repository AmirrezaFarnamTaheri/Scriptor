import { useRef, useState } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { X } from 'lucide-react'

import { vaultFrontmatterSet } from '../bridge/commands'


function stringifyFields(fields: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, value == null ? '' : String(value)]),
  )
}

interface FrontmatterInspectorProps {
  path: string
  fields: Record<string, unknown>
  onClose: () => void
  onSaved: () => void
}

export function FrontmatterInspector({ path, fields, onClose, onSaved }: FrontmatterInspectorProps) {
  const [draft, setDraft] = useState<Record<string, string>>(() => stringifyFields(fields))
  const [status, setStatus] = useState('')
  const dialogRef = useRef<HTMLElement>(null)
  useFocusTrap(dialogRef, { active: true })

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
      <section ref={dialogRef} className="frontmatter-inspector" role="dialog" aria-modal="true" aria-label="Frontmatter" onClick={(e) => e.stopPropagation()}>
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
