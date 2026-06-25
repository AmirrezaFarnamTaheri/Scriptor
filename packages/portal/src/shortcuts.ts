export interface ParsedShortcut {
  mod: boolean
  shift: boolean
  alt: boolean
  key: string
}

const MODIFIERS = new Set(['mod', 'ctrl', 'control', 'cmd', 'meta', 'shift', 'alt', 'option'])

/** Parse `mod+shift+1` style shortcut strings. */
export function parseShortcut(raw: string | null | undefined): ParsedShortcut | null {
  if (!raw?.trim()) return null
  const parts = raw.toLowerCase().split('+').map((part) => part.trim()).filter(Boolean)
  if (parts.length === 0) return null

  const parsed: ParsedShortcut = { mod: false, shift: false, alt: false, key: '' }
  for (const part of parts) {
    if (part === 'mod' || part === 'ctrl' || part === 'control' || part === 'cmd' || part === 'meta') {
      parsed.mod = true
      continue
    }
    if (part === 'shift') {
      parsed.shift = true
      continue
    }
    if (part === 'alt' || part === 'option') {
      parsed.alt = true
      continue
    }
    if (!MODIFIERS.has(part)) {
      parsed.key = part.length === 1 ? part : part
    }
  }
  if (!parsed.key) return null
  return parsed
}

function eventUsesMod(event: KeyboardEvent): boolean {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
  return isMac ? event.metaKey : event.ctrlKey
}

export function shortcutMatches(event: KeyboardEvent, shortcut: ParsedShortcut): boolean {
  if (eventUsesMod(event) !== shortcut.mod) return false
  if (event.shiftKey !== shortcut.shift) return false
  if (event.altKey !== shortcut.alt) return false
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key.toLowerCase()
  return key === shortcut.key
}

export function formatShortcutLabel(raw: string | null | undefined): string {
  const parsed = parseShortcut(raw)
  if (!parsed) return ''
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
  const parts: string[] = []
  if (parsed.mod) parts.push(isMac ? '⌘' : 'Ctrl')
  if (parsed.shift) parts.push(isMac ? '⇧' : 'Shift')
  if (parsed.alt) parts.push(isMac ? '⌥' : 'Alt')
  parts.push(parsed.key.toUpperCase())
  return parts.join(isMac ? '' : '+')
}
