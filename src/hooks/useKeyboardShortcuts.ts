import { useCallback, useMemo, useState } from 'react'

import { expectRecord } from '../lib/runtimeSchema'
import { readVersionedStorage, writeVersionedStorage } from '../lib/versionedStorage'

const STORAGE_KEY = 'scriptor:keyboard-shortcuts'

export interface ShortcutOverride {
  commandId: string
  shortcut: string | null
}

/**
 * Overrides always use a null prototype so an `in` / lookup on an inherited
 * name (`constructor`, `toString`, …) cannot resolve to a built-in.
 */
function emptyOverrides(): Record<string, string | null> {
  return Object.create(null) as Record<string, string | null>
}

function validateOverrides(value: unknown): Record<string, string | null> {
  const parsed = expectRecord(value, 'keyboard shortcuts')
  const output = emptyOverrides()
  for (const [key, shortcut] of Object.entries(parsed)) {
    if (typeof shortcut === 'string' || shortcut === null) {
      output[key] = shortcut
    }
  }
  return output
}

function loadOverrides(): Record<string, string | null> {
  return readVersionedStorage({
    key: STORAGE_KEY,
    schemaVersion: 1,
    fallback: emptyOverrides(),
    validate: validateOverrides,
    migrate: validateOverrides,
  })
}

function saveOverrides(overrides: Record<string, string | null>): void {
  writeVersionedStorage(STORAGE_KEY, 1, overrides)
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
      if (Object.hasOwn(overrides, commandId)) {
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
        const next = Object.assign(emptyOverrides(), prev, { [commandId]: shortcut })
        saveOverrides(next)
        return next
      })
    },
    [],
  )

  const resetShortcut = useCallback(
    (commandId: string) => {
      setOverrides((prev) => {
        const next = Object.assign(emptyOverrides(), prev)
        delete next[commandId]
        saveOverrides(next)
        return next
      })
    },
    [],
  )

  const resetAllShortcuts = useCallback(() => {
    setOverrides(emptyOverrides())
    saveOverrides(emptyOverrides())
  }, [])

  const hasOverride = useCallback(
    (commandId: string) => Object.hasOwn(overrides, commandId),
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
