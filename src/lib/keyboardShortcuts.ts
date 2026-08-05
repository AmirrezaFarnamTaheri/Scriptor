export interface ShortcutEventLike {
  key: string
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  metaKey: boolean
}

interface ParsedShortcut {
  key: string
  ctrl: boolean
  alt: boolean
  shift: boolean
  meta: boolean
  mod: boolean
}

const MODIFIERS = new Set(['Ctrl', 'Alt', 'Shift', 'Meta', 'Mod'])
const NAMED_KEYS = new Set([
  'Escape',
  'Enter',
  'Tab',
  'Backspace',
  'Delete',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'Backslash',
])

function isMacPlatform(platform?: string): boolean {
  const resolved = platform ?? (typeof navigator === 'undefined' ? '' : navigator.platform)
  return /Mac|iPhone|iPad|iPod/i.test(resolved)
}

function normalizeShortcutKey(key: string): string | null {
  const trimmed = key.trim()
  if (/^[A-Za-z0-9]$/.test(trimmed)) return trimmed.toUpperCase()
  if (/^F\d{1,2}$/i.test(trimmed)) return trimmed.toUpperCase()
  const named = Array.from(NAMED_KEYS).find((candidate) => candidate.toLowerCase() === trimmed.toLowerCase())
  return named ?? null
}

function parseShortcut(shortcut: string): ParsedShortcut | null {
  const parts = shortcut.split('+').map((part) => part.trim())
  if (parts.some((part) => part.length === 0)) return null

  const keyPart = parts.at(-1)
  if (!keyPart) return null
  const key = normalizeShortcutKey(keyPart)
  if (!key) return null

  const modifierParts = parts.slice(0, -1)
  if (modifierParts.some((part) => !MODIFIERS.has(part))) return null
  if (new Set(modifierParts).size !== modifierParts.length) return null
  if (modifierParts.includes('Mod') && (modifierParts.includes('Ctrl') || modifierParts.includes('Meta'))) {
    return null
  }

  return {
    key,
    ctrl: modifierParts.includes('Ctrl'),
    alt: modifierParts.includes('Alt'),
    shift: modifierParts.includes('Shift'),
    meta: modifierParts.includes('Meta'),
    mod: modifierParts.includes('Mod'),
  }
}

/** Returns whether a shortcut uses the supported canonical modifier and key syntax. */
export function isValidShortcut(shortcut: string): boolean {
  return parseShortcut(shortcut.trim()) !== null
}

function eventKey(eventKey: string): string {
  if (eventKey === ' ') return 'Space'
  if (eventKey === '\\') return 'Backslash'
  return normalizeShortcutKey(eventKey) ?? eventKey
}

/** Returns true when a keyboard event matches a configured shortcut exactly. */
export function matchesShortcut(
  event: ShortcutEventLike,
  shortcut: string | undefined,
  platform?: string,
): boolean {
  if (!shortcut) return false
  const parsed = parseShortcut(shortcut)
  if (!parsed) return false

  const mac = isMacPlatform(platform)
  const expectedCtrl = parsed.ctrl || (parsed.mod && !mac)
  const expectedMeta = parsed.meta || (parsed.mod && mac)

  return (
    eventKey(event.key) === parsed.key &&
    event.ctrlKey === expectedCtrl &&
    event.metaKey === expectedMeta &&
    event.altKey === parsed.alt &&
    event.shiftKey === parsed.shift
  )
}

function displayKey(key: string): string {
  return key === 'Backslash' ? '\\' : key
}

/** Formats a canonical shortcut for the current platform without changing its behavior. */
export function formatShortcut(shortcut: string | undefined, platform?: string): string | undefined {
  if (!shortcut) return undefined
  const parsed = parseShortcut(shortcut)
  if (!parsed) return shortcut

  const mac = isMacPlatform(platform)
  const key = displayKey(parsed.key)
  if (mac) {
    return [
      parsed.mod || parsed.meta ? '⌘' : '',
      parsed.ctrl ? '⌃' : '',
      parsed.alt ? '⌥' : '',
      parsed.shift ? '⇧' : '',
      key,
    ].join('')
  }

  return [
    parsed.mod || parsed.ctrl ? 'Ctrl' : null,
    parsed.meta ? 'Meta' : null,
    parsed.alt ? 'Alt' : null,
    parsed.shift ? 'Shift' : null,
    key,
  ].filter(Boolean).join('+')
}

/** Returns the platform-appropriate display label for a Mod+key shortcut. */
export function shortcutLabel(key: string): string {
  return formatShortcut(`Mod+${key}`) ?? key
}
