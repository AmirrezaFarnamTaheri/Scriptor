/**
 * useCustomCalloutTypes
 * ----------------------
 * Manages user-defined callout / admonition type definitions stored in the
 * vault config. These extend the built-in set (note, warning, tip, etc.)
 * with custom labels, icons, and CSS-variable-based colors.
 *
 * Feature 1.9 — Custom Callout / Admonition Types
 *
 * Usage:
 *  ```tsx
 *  const { callouts, addCallout, removeCallout, updateCallout } =
 *    useCustomCalloutTypes(config, saveConfig)
 *  ```
 *
 * Format in vault config (`custom_callouts: CalloutDefinition[]`).
 * The renderer reads this list and generates `.callout-<id>` CSS custom
 * properties for background, border, and icon color.
 */

import { useState, useCallback } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CalloutDefinition {
  /** Unique lowercase identifier used as the callout type: `> [!mytype]`. */
  id: string
  /** Display label shown in the callout header. */
  label: string
  /**
   * CSS color value for the callout accent (border, icon).
   * Should be a CSS custom property reference or a literal color.
   * Example: `'var(--orange)'` or `'#e07b39'`
   */
  accentColor: string
  /**
   * Unicode character or emoji used as the icon.
   * Example: `'★'`, `'⚠'`, `'§'`
   */
  icon?: string
  /** Optional description shown in settings UI. */
  description?: string
}

export interface CustomCalloutTypesConfig {
  callouts: CalloutDefinition[]
  saveCallouts: (callouts: CalloutDefinition[]) => Promise<void> | void
}

export interface CustomCalloutTypesResult {
  callouts: CalloutDefinition[]
  addCallout: (callout: CalloutDefinition) => void
  removeCallout: (id: string) => void
  updateCallout: (id: string, patch: Partial<Omit<CalloutDefinition, 'id'>>) => void
  /** Returns true if `id` is a valid unused identifier. */
  isValidId: (id: string) => boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ID_RE = /^[a-z0-9-]{2,32}$/

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCustomCalloutTypes({
  callouts: initial,
  saveCallouts,
}: CustomCalloutTypesConfig): CustomCalloutTypesResult {
  const [callouts, setCallouts] = useState<CalloutDefinition[]>(initial)

  const persist = useCallback(
    (next: CalloutDefinition[]) => {
      setCallouts(next)
      void saveCallouts(next)
    },
    [saveCallouts],
  )

  const addCallout = useCallback(
    (callout: CalloutDefinition) => {
      persist([...callouts.filter((c) => c.id !== callout.id), callout])
    },
    [callouts, persist],
  )

  const removeCallout = useCallback(
    (id: string) => {
      persist(callouts.filter((c) => c.id !== id))
    },
    [callouts, persist],
  )

  const updateCallout = useCallback(
    (id: string, patch: Partial<Omit<CalloutDefinition, 'id'>>) => {
      persist(callouts.map((c) => (c.id === id ? { ...c, ...patch } : c)))
    },
    [callouts, persist],
  )

  const isValidId = useCallback(
    (id: string) => ID_RE.test(id) && !callouts.some((c) => c.id === id),
    [callouts],
  )

  return { callouts, addCallout, removeCallout, updateCallout, isValidId }
}
