import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bookmark, Search, X } from 'lucide-react'

import { vaultListViewNotes } from '../bridge/commands'
import { isNativeBridgeAvailable } from '../bridge/platform'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import type { ViewNoteHit } from '../types/vault'

interface SavedViewsPanelProps {
  embedded?: boolean
  vaultOpen: boolean
  onClose: () => void
  onOpenNote: (path: string) => void
  promptText: (request: {
    title: string
    label: string
    defaultValue: string
    submitLabel?: string
  }) => Promise<string | null>
}

interface SavedViewPreset {
  id: string
  label: string
  titleContains: string
  tagHas: string
  pathMatches: string
  modifiedWithinDays: string
  inboxOnly?: boolean
}

const PRESETS_STORAGE_KEY = 'scriptor.saved-views.presets'

function loadPresets(): SavedViewPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY)
    if (!raw) return defaultPresets()
    const parsed = JSON.parse(raw) as SavedViewPreset[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : defaultPresets()
  } catch {
    return defaultPresets()
  }
}

function defaultPresets(): SavedViewPreset[] {
  return [
    {
      id: 'recent-week',
      label: 'Modified this week',
      titleContains: '',
      tagHas: '',
      pathMatches: '',
      modifiedWithinDays: '7',
    },
    {
      id: 'inbox',
      label: 'Inbox (unorganized)',
      titleContains: '',
      tagHas: '',
      pathMatches: '',
      modifiedWithinDays: '',
      inboxOnly: true,
    },
  ]
}

function buildFilterJson(input: {
  titleContains: string
  tagHas: string
  pathMatches: string
  modifiedWithinDays: string
  inboxOnly?: boolean
}): string {
  const conditions: Array<{ op: string; value?: string }> = []
  const title = input.titleContains.trim()
  const tag = input.tagHas.trim().replace(/^#/, '')
  const path = input.pathMatches.trim()
  const days = input.modifiedWithinDays.trim()

  if (input.inboxOnly) {
    conditions.push({ op: 'in inbox' })
  }
  if (title.length > 0) {
    conditions.push({ op: 'title contains', value: title })
  }
  if (tag.length > 0) {
    conditions.push({ op: 'tag has', value: tag })
  }
  if (path.length > 0) {
    conditions.push({ op: 'path matches', value: path })
  }
  if (days.length > 0) {
    conditions.push({ op: 'modified within days', value: days })
  }

  if (conditions.length === 0) {
    return '{"any":[{"op":"title contains","value":""}]}'
  }
  return JSON.stringify({ all: conditions })
}

export function SavedViewsPanel({
  embedded = false,
  vaultOpen,
  onClose,
  onOpenNote,
  promptText,
}: SavedViewsPanelProps) {
  const canQuery = vaultOpen && isNativeBridgeAvailable()
  const [titleContains, setTitleContains] = useState('')
  const [tagHas, setTagHas] = useState('')
  const [pathMatches, setPathMatches] = useState('')
  const [modifiedWithinDays, setModifiedWithinDays] = useState('')
  const [inboxOnly, setInboxOnly] = useState(false)
  const [results, setResults] = useState<ViewNoteHit[]>([])
  const [status, setStatus] = useState('Build a filter and run search.')
  const [presets, setPresets] = useState<SavedViewPreset[]>(() => loadPresets())

  useEscapeToClose(!embedded, onClose)

  const filterJson = useMemo(
    () =>
      buildFilterJson({
        titleContains,
        tagHas,
        pathMatches,
        modifiedWithinDays,
        inboxOnly,
      }),
    [inboxOnly, modifiedWithinDays, pathMatches, tagHas, titleContains],
  )

  const runQuery = useCallback(async () => {
    if (!canQuery) return
    setStatus('Searching…')
    try {
      const hits = await vaultListViewNotes(filterJson)
      setResults(hits)
      setStatus(`${hits.length} note${hits.length === 1 ? '' : 's'} match this view`)
    } catch (error) {
      setResults([])
      setStatus(error instanceof Error ? error.message : 'View query failed')
    }
  }, [canQuery, filterJson])

  useEffect(() => {
    if (!canQuery) return
    void runQuery()
  }, [canQuery, runQuery])

  const applyPreset = (preset: SavedViewPreset) => {
    setTitleContains(preset.titleContains)
    setTagHas(preset.tagHas)
    setPathMatches(preset.pathMatches)
    setModifiedWithinDays(preset.modifiedWithinDays)
    setInboxOnly(Boolean(preset.inboxOnly))
  }

  const saveCurrentPreset = () => {
    void promptText({
      title: 'Save view',
      label: 'Name for this saved view',
      defaultValue: 'My view',
      submitLabel: 'Save',
    }).then((label) => {
      if (!label) return
      const next: SavedViewPreset = {
        id: crypto.randomUUID(),
        label,
        titleContains,
        tagHas,
        pathMatches,
        modifiedWithinDays,
      }
      const updated = [...presets, next]
      setPresets(updated)
      localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(updated))
    })
  }

  const body = (
    <>
      {embedded ? (
        <p className="health-subtitle">{canQuery ? status : 'Open a vault in the desktop app.'}</p>
      ) : null}

      <div className="saved-views-presets">
          {presets.map((preset) => (
            <button key={preset.id} type="button" className="toolbar-button" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
          <button type="button" className="toolbar-button" onClick={saveCurrentPreset}>
            Save current…
          </button>
        </div>

        <form
          className="saved-views-form"
          onSubmit={(event) => {
            event.preventDefault()
            void runQuery()
          }}
        >
          <label>
            Title contains
            <input value={titleContains} onChange={(event) => setTitleContains(event.target.value)} />
          </label>
          <label>
            Tag has
            <input value={tagHas} onChange={(event) => setTagHas(event.target.value)} placeholder="project" />
          </label>
          <label>
            Path matches
            <input value={pathMatches} onChange={(event) => setPathMatches(event.target.value)} placeholder="notes/*" />
          </label>
          <label>
            Modified within days
            <input
              type="number"
              min={1}
              value={modifiedWithinDays}
              onChange={(event) => setModifiedWithinDays(event.target.value)}
              placeholder="7"
            />
          </label>
          <button type="submit" className="primary-button" disabled={!canQuery}>
            <Search size={16} />
            Run view
          </button>
        </form>

        <ul className="knowledge-note-list">
          {results.map((note) => (
            <li key={note.path}>
              <button
                type="button"
                onClick={() => {
                  onOpenNote(note.path)
                  if (!embedded) onClose()
                }}
              >
                <span>{note.title}</span>
                <small>{note.path}</small>
              </button>
            </li>
          ))}
        </ul>
    </>
  )

  if (embedded) {
    return <div className="knowledge-workbench-embed">{body}</div>
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="saved-views-panel knowledge-filters-panel"
        role="dialog"
        aria-label="Saved views"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <h2>
              <Bookmark size={18} />
              Saved views
            </h2>
            <p className="health-subtitle">{canQuery ? status : 'Open a vault in the desktop app.'}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close saved views">
            <X />
          </button>
        </header>
        {body}
      </section>
    </div>
  )
}
