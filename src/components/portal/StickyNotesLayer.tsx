import { X } from 'lucide-react'

import type { QuickStickyNote } from '@scriptor/portal'

interface StickyNotesLayerProps {
  stickies: QuickStickyNote[]
  visible: boolean
  onUpdate: (note: QuickStickyNote) => void
  onDelete: (id: string) => void
}

export function StickyNotesLayer({ stickies, visible, onUpdate, onDelete }: StickyNotesLayerProps) {
  if (!visible || stickies.length === 0) return null

  return (
    <div className="sticky-notes-layer" aria-label="Sticky notes">
      {stickies.map((note) => (
        <article
          key={note.id}
          className="sticky-note-card"
          style={{
            left: note.x,
            top: note.y,
            width: note.width,
            minHeight: note.height,
            background: note.color,
          }}
        >
          <header>
            <input
              className="sticky-note-title"
              value={note.title}
              onChange={(event) => onUpdate({ ...note, title: event.target.value, updatedAt: new Date().toISOString() })}
            />
            <button type="button" onClick={() => onDelete(note.id)} aria-label="Delete sticky note">
              <X size={14} />
            </button>
          </header>
          <textarea
            className="sticky-note-body"
            value={note.body}
            onChange={(event) => onUpdate({ ...note, body: event.target.value, updatedAt: new Date().toISOString() })}
          />
        </article>
      ))}
    </div>
  )
}
