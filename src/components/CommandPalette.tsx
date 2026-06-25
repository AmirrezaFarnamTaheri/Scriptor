import { useEffect, useMemo, useRef, useState } from 'react'

import { useEscapeToClose } from '../hooks/useEscapeToClose'

export interface PaletteCommand {
  id: string
  label: string
  run: () => void
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  commands: Array<{ id: string; label: string; run: () => void }>
}

export function CommandPalette({ open, onClose, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return commands
    return commands.filter((command) => command.label.toLowerCase().includes(needle))
  }, [commands, query])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query, open])

  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLButtonElement>('[data-active="true"]')
    active?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex, filtered.length])

  useEscapeToClose(open, onClose)

  const runSelected = (command: PaletteCommand) => {
    command.run()
    onClose()
    setQuery('')
  }

  if (!open) return null

  return (
    <div className="command-palette-overlay" role="dialog" aria-label="Command palette">
      <div className="command-palette">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setSelectedIndex((current) => Math.min(current + 1, Math.max(filtered.length - 1, 0)))
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              setSelectedIndex((current) => Math.max(current - 1, 0))
            } else if (event.key === 'Enter' && filtered[selectedIndex]) {
              event.preventDefault()
              runSelected(filtered[selectedIndex])
            }
          }}
          placeholder="Type a command…"
          aria-label="Command palette search"
          aria-controls="command-palette-list"
          aria-activedescendant={
            filtered[selectedIndex] ? `command-palette-item-${filtered[selectedIndex].id}` : undefined
          }
          autoFocus
        />
        <ul id="command-palette-list" ref={listRef} role="listbox">
          {filtered.map((command, index) => (
            <li key={command.id} role="presentation">
              <button
                type="button"
                id={`command-palette-item-${command.id}`}
                role="option"
                aria-selected={index === selectedIndex}
                data-active={index === selectedIndex ? 'true' : undefined}
                className={index === selectedIndex ? 'active' : undefined}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => runSelected(command)}
              >
                {command.label}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close command palette">
          ×
        </button>
      </div>
    </div>
  )
}
