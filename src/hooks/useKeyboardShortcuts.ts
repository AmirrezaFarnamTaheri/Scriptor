import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { isValidShortcut as validateShortcut } from '../lib/keyboardShortcuts'
import { expectRecord } from '../lib/runtimeSchema'
import { readVersionedStorage, writeVersionedStorage } from '../lib/versionedStorage'

const STORAGE_KEY = 'scriptor:keyboard-shortcuts'
const SHORTCUTS_CHANGED_EVENT = 'scriptor:keyboard-shortcuts-changed'

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
  })
}

function saveOverrides(overrides: Record<string, string | null>): void {
  writeVersionedStorage(STORAGE_KEY, 1, overrides)
  window.queueMicrotask(() => window.dispatchEvent(new Event(SHORTCUTS_CHANGED_EVENT)))
}

/** Validates the canonical shortcut syntax accepted by the editor and key handler. */
export function isValidShortcut(shortcut: string): boolean {
  return validateShortcut(shortcut)
}

/** Provides synchronized shortcut overrides backed by versioned browser storage. */
export function useKeyboardShortcuts() {
  const [overrides, setOverrides] = useState<Record<string, string | null>>(loadOverrides)
  const overridesRef = useRef(overrides)
  const pendingPersistenceRef = useRef<Record<string, string | null> | null>(null)

  useEffect(() => {
    if (pendingPersistenceRef.current !== overrides) return
    pendingPersistenceRef.current = null
    saveOverrides(overrides)
  }, [overrides])

  useEffect(() => {
    const reload = () => {
      const next = loadOverrides()
      pendingPersistenceRef.current = null
      overridesRef.current = next
      setOverrides(next)
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) reload()
    }
    window.addEventListener(SHORTCUTS_CHANGED_EVENT, reload)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(SHORTCUTS_CHANGED_EVENT, reload)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const commitOverrides = useCallback((next: Record<string, string | null>) => {
    overridesRef.current = next
    pendingPersistenceRef.current = next
    setOverrides(next)
  }, [])

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
      const next = Object.assign(emptyOverrides(), overridesRef.current, { [commandId]: shortcut })
      commitOverrides(next)
    },
    [commitOverrides],
  )

  const resetShortcut = useCallback(
    (commandId: string) => {
      const next = Object.assign(emptyOverrides(), overridesRef.current)
      delete next[commandId]
      commitOverrides(next)
    },
    [commitOverrides],
  )

  const resetAllShortcuts = useCallback(() => {
    commitOverrides(emptyOverrides())
  }, [commitOverrides])

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
