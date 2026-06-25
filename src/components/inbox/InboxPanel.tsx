import { Inbox, CheckCircle2 } from 'lucide-react'

import type { NoteIndexSummary } from '../../types/vault'

interface InboxPanelProps {
  notes: NoteIndexSummary[]
  activePath: string | null
  onOpenNote: (path: string) => void
  onOrganize: (path: string) => void
}

export function InboxPanel({ notes, activePath, onOpenNote, onOrganize }: InboxPanelProps) {
  if (notes.length === 0) {
    return <p className="empty-state">Inbox is clear — no unorganized notes.</p>
  }

  return (
    <section className="inbox-panel" aria-label="Inbox">
      <header className="inbox-panel-header">
        <Inbox size={16} />
        <strong>Inbox ({notes.length})</strong>
      </header>
      <ul>
        {notes.map((note) => (
          <li key={note.path}>
            <button
              type="button"
              className={activePath === note.path ? 'note-row active' : 'note-row'}
              onClick={() => onOpenNote(note.path)}
            >
              <FileLabel note={note} />
            </button>
            <button
              type="button"
              className="toolbar-button inbox-organize-button"
              title="Mark organized"
              onClick={() => onOrganize(note.path)}
            >
              <CheckCircle2 size={14} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function FileLabel({ note }: { note: NoteIndexSummary }) {
  return (
    <>
      <span>{note.title}</span>
      <small>
        {note.note_type ? `${note.note_type} · ` : ''}
        {note.path}
      </small>
    </>
  )
}
