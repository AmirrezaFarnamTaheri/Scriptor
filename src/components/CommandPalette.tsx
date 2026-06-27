import { useEffect, useMemo, useRef, useState } from 'react'

import { useEscapeToClose } from '../hooks/useEscapeToClose'
import { useI18n } from '../lib/i18n'

export interface PaletteCommand {
  id: string
  label: string
  run: () => void
  group?: 'command' | 'note'
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  commands: Array<{ id: string; label: string; run: () => void }>
  searchNotes?: (query: string) => Promise<Array<{ path: string; title: string }>>
  onOpenNote?: (path: string) => void
}

export function CommandPalette({ open, onClose, commands, searchNotes, onOpenNote }: CommandPaletteProps) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [noteHits, setNoteHits] = useState<Array<{ path: string; title: string }>>([])
  const [isSearchingNotes, setIsSearchingNotes] = useState(false)
  const listRef = useRef<HTMLUListElement>(null)
  const searchTimer = useRef<number | null>(null)

  const noteCommands = useMemo<PaletteCommand[]>(
    () =>
      noteHits.map((hit) => ({
        id: `note:${hit.path}`,
        label: hit.title,
        group: 'note' as const,
        run: () => {
          onOpenNote?.(hit.path)
        },
      })),
    [noteHits, onOpenNote],
  )

  const mergedCommands = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const filteredCommands = needle
      ? commands.filter((command) => command.label.toLowerCase().includes(needle))
      : commands
    if (!searchNotes || !needle) {
      return filteredCommands.map((command) => ({ ...command, group: 'command' as const }))
    }
    return [
      ...filteredCommands.map((command) => ({ ...command, group: 'command' as const })),
      ...noteCommands,
    ]
  }, [commands, noteCommands, query, searchNotes])

  useEffect(() => {
    if (!open || !searchNotes) {
      setNoteHits([])
      return
    }
    const needle = query.trim()
    if (needle.length < 2) {
      setNoteHits([])
      return
    }
    if (searchTimer.current) {
      window.clearTimeout(searchTimer.current)
    }
    searchTimer.current = window.setTimeout(() => {
      setIsSearchingNotes(true)
      void searchNotes(needle)
        .then((hits) => setNoteHits(hits.slice(0, 12)))
        .catch(() => setNoteHits([]))
        .finally(() => setIsSearchingNotes(false))
    }, 200)
    return () => {
      if (searchTimer.current) {
        window.clearTimeout(searchTimer.current)
      }
    }
  }, [open, query, searchNotes])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query, open])

  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLButtonElement>('[data-active="true"]')
    active?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex, mergedCommands.length])

  useEscapeToClose(open, onClose)

  const runSelected = (command: PaletteCommand) => {
    command.run()
    onClose()
    setQuery('')
    setNoteHits([])
  }

  if (!open) return null

  return (
    <div className="command-palette-overlay" role="dialog" aria-label={t('commandPalette.ariaLabel')}>
      <div className="command-palette">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setSelectedIndex((current) => Math.min(current + 1, Math.max(mergedCommands.length - 1, 0)))
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              setSelectedIndex((current) => Math.max(current - 1, 0))
            } else if (event.key === 'Enter' && mergedCommands[selectedIndex]) {
              event.preventDefault()
              runSelected(mergedCommands[selectedIndex])
            }
          }}
          placeholder={t('commandPalette.placeholder')}
          aria-label={t('commandPalette.ariaLabel')}
          aria-controls="command-palette-list"
          aria-activedescendant={
            mergedCommands[selectedIndex] ? `command-palette-item-${mergedCommands[selectedIndex].id}` : undefined
          }
          autoFocus
        />
        {isSearchingNotes ? <p className="command-palette-hint">{t('commandPalette.searchingNotes')}</p> : null}
        <ul id="command-palette-list" ref={listRef} role="listbox">
          {mergedCommands.map((command, index) => (
            <li key={command.id} role="presentation">
              <button
                type="button"
                id={`command-palette-item-${command.id}`}
                role="option"
                aria-selected={index === selectedIndex}
                data-active={index === selectedIndex ? 'true' : undefined}
                className={command.group === 'note' ? 'command-palette-note-hit' : undefined}
                onClick={() => runSelected(command)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                {command.group === 'note' ? (
                  <>
                    <strong>{command.label}</strong>
                    <small>{command.id.replace(/^note:/, '')}</small>
                  </>
                ) : (
                  command.label
                )}
              </button>
            </li>
          ))}
        </ul>
        {mergedCommands.length === 0 ? <p className="command-palette-hint">{t('commandPalette.noResults')}</p> : null}
      </div>
    </div>
  )
}
