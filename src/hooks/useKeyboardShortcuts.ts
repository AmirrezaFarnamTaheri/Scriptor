import { useCallback, useMemo, useState } from 'react'

const STORAGE_KEY = 'scriptor:keyboard-shortcuts'

export interface ShortcutOverride {
  commandId: string
  shortcut: string | null
}

function loadOverrides(): Record<string, string | null> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, string | null>
  } catch {
    return {}
  }
}

function saveOverrides(overrides: Record<string, string | null>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
}

const VALID_KEY_PATTERN = /^(Ctrl|Alt|Shift|Meta)(\+(Ctrl|Alt|Shift|Meta))*\+[A-Za-z0-9]$|^[A-Za-z0-9]$|^F\d{1,2}$|^Escape$|^Enter$|^Tab$|^Backspace$|^Delete$|^Home$|^End$|^PageUp$|^PageDown$|^ArrowUp$|^ArrowDown$|^ArrowLeft$|^ArrowRight$|^Space$/

export function isValidShortcut(shortcut: string): boolean {
  if (!shortcut || !shortcut.trim()) return false
  return VALID_KEY_PATTERN.test(shortcut.trim())
}

export function useKeyboardShortcuts() {
  const [overrides, setOverrides] = useState<Record<string, string | null>>(loadOverrides)

  const getShortcut = useCallback(
    (commandId: string, defaultShortcut?: string): string | undefined => {
      if (commandId in overrides) {
        const override = overrides[commandId]
        return override === null ? undefined : override
      }
      return defaultShortcut
    },
    [overrides],
  )

  const setShortcut = useCallback(
    (commandId: string, shortcut: string | null) => {
      setOverrides((prev) => {
        const next = { ...prev, [commandId]: shortcut }
        saveOverrides(next)
        return next
      })
    },
    [],
  )

  const resetShortcut = useCallback(
    (commandId: string) => {
      setOverrides((prev) => {
        const next = { ...prev }
        delete next[commandId]
        saveOverrides(next)
        return next
      })
    },
    [],
  )

  const resetAllShortcuts = useCallback(() => {
    setOverrides({})
    saveOverrides({})
  }, [])

  const hasOverride = useCallback(
    (commandId: string) => commandId in overrides,
    [overrides],
  )

  return useMemo(
    () => ({
      getShortcut,
      setShortcut,
      resetShortcut,
      resetAllShortcuts,
      hasOverride,
      overrides,
    }),
    [getShortcut, setShortcut, resetShortcut, resetAllShortcuts, hasOverride, overrides],
  )
}
