import { HELP_BY_ID } from './catalog.ts'
import { HELP_STORAGE_KEY, type GuideProgress, type HelpPreferences } from './types.ts'

export interface HelpStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export interface HelpSnapshot { preferences: HelpPreferences; storageWarning: boolean }
export type HelpAction =
  | { type: 'step'; id: string; step: number }
  | { type: 'finish' | 'restart' | 'introduce'; id: string }
  | { type: 'reset' }

export function emptyHelpPreferences(): HelpPreferences { return { version: 1, progress: {} } }
export function getProgress(preferences: HelpPreferences, id: string): GuideProgress {
  return Object.hasOwn(preferences.progress, id) ? preferences.progress[id]! : { step: 0, completed: false, introduced: false }
}

export function parseHelpPreferences(raw: string | null): HelpPreferences {
  if (!raw) return emptyHelpPreferences()
  if (raw.length > 100_000) throw new Error('Help preferences exceed the bounded storage limit')
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1) throw new Error('Unsupported help preferences')
  const records = 'progress' in value && value.progress && typeof value.progress === 'object' ? value.progress : {}
  const progress: Record<string, GuideProgress> = {}
  for (const [id, guide] of HELP_BY_ID) {
    if (!Object.hasOwn(records, id)) continue
    const record: unknown = (records as Record<string, unknown>)[id]
    if (!record || typeof record !== 'object') continue
    const step = 'step' in record && typeof record.step === 'number' && Number.isFinite(record.step) ? record.step : 0
    progress[id] = {
      step: Math.max(0, Math.min(guide.steps.length - 1, Math.floor(step))),
      completed: 'completed' in record && record.completed === true,
      introduced: 'introduced' in record && record.introduced === true,
    }
  }
  // Legacy version-1 payloads may contain retired invitation fields. Ignore
  // them while preserving compatible tour progress.
  return { version: 1, progress }
}

export function reduceHelpPreferences(current: HelpPreferences, action: HelpAction): HelpPreferences {
  if (action.type === 'reset') return { version: 1, progress: {} }
  const guide = HELP_BY_ID.get(action.id)
  if (!guide) return current
  const old = getProgress(current, action.id)
  let next = { ...old }
  if (action.type === 'restart') next = { ...old, step: 0, completed: false }
  if (action.type === 'finish') next = { ...old, step: guide.steps.length - 1, completed: true, introduced: true }
  if (action.type === 'introduce') next = { ...old, introduced: true }
  if (action.type === 'step') {
    const step = Number.isFinite(action.step) ? Math.floor(action.step) : old.step
    next = { ...old, step: Math.max(0, Math.min(guide.steps.length - 1, step)) }
  }
  if (JSON.stringify(old) === JSON.stringify(next)) return current
  return { ...current, progress: { ...current.progress, [action.id]: next } }
}

/** Stable snapshots for React; corrupt or denied storage degrades to a working in-memory session. */
export class HelpProgressStore {
  private snapshot: HelpSnapshot
  private readonly storage: HelpStorage | null
  private readonly listeners = new Set<() => void>()
  constructor(storage: HelpStorage | null) {
    this.storage = storage
    try { this.snapshot = { preferences: parseHelpPreferences(storage?.getItem(HELP_STORAGE_KEY) ?? null), storageWarning: !storage } }
    catch { this.snapshot = { preferences: emptyHelpPreferences(), storageWarning: true } }
  }
  readonly getSnapshot = (): HelpSnapshot => this.snapshot
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
  readonly dispatch = (action: HelpAction): void => {
    const preferences = reduceHelpPreferences(this.snapshot.preferences, action)
    if (preferences === this.snapshot.preferences) return
    let storageWarning = !this.storage
    try { this.storage?.setItem(HELP_STORAGE_KEY, JSON.stringify(preferences)) } catch { storageWarning = true }
    this.snapshot = { preferences, storageWarning }
    this.listeners.forEach((listener) => listener())
  }
  readonly acceptStorage = (raw: string | null): void => {
    try {
      const preferences = parseHelpPreferences(raw)
      if (JSON.stringify(preferences) === JSON.stringify(this.snapshot.preferences)) return
      this.snapshot = { preferences, storageWarning: false }
    } catch { this.snapshot = { ...this.snapshot, storageWarning: true } }
    this.listeners.forEach((listener) => listener())
  }
}
