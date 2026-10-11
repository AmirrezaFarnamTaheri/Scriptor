export const WORKSPACE_SHORTCUT_STORAGE_KEY = 'scriptor:workspace-shortcuts:v1'
const MAX_ITEMS = 128
const DEFAULT_IDS = new Set(['writing', 'source', 'preview'])

export interface WorkspaceShortcutItem {
  id: string
  shown: boolean
  pinned: boolean
  label: string
  /** Zero preserves the label's natural width. */
  width: number
  fontSize: number
}

export interface WorkspaceShortcutPreferences {
  version: 1
  visible: boolean
  items: WorkspaceShortcutItem[]
}

const validId = (id: unknown): id is string => typeof id === 'string' && /^[A-Za-z0-9][A-Za-z0-9:._-]{0,255}$/.test(id)
const defaultItem = (id: string): WorkspaceShortcutItem => ({ id, shown: DEFAULT_IDS.has(id), pinned: DEFAULT_IDS.has(id), label: '', width: 0, fontSize: 12 })
export function defaultWorkspaceShortcutPreferences(): WorkspaceShortcutPreferences {
  return { version: 1, visible: true, items: [...DEFAULT_IDS].map(defaultItem) }
}

/** Stored UI labels are plain text; no command bodies, markup or CSS are accepted. */
export function parseWorkspaceShortcutPreferences(raw: string | null): WorkspaceShortcutPreferences {
  if (!raw || raw.length > 65_536) return defaultWorkspaceShortcutPreferences()
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') return defaultWorkspaceShortcutPreferences()
    const saved = value as Record<string, unknown>
    if (saved.version !== 1 || typeof saved.visible !== 'boolean' || !Array.isArray(saved.items)) return defaultWorkspaceShortcutPreferences()
    const seen = new Set<string>()
    const items: WorkspaceShortcutItem[] = []
    for (const candidate of saved.items.slice(0, MAX_ITEMS)) {
      if (!candidate || typeof candidate !== 'object') continue
      const item = candidate as Record<string, unknown>
      if (!validId(item.id) || seen.has(item.id)) continue
      seen.add(item.id)
      const bounded = (number: unknown, fallback: number, min: number, max: number) => typeof number === 'number' && Number.isFinite(number)
        ? Math.max(min, Math.min(max, Math.round(number))) : fallback
      items.push({
        id: item.id, shown: item.shown === true, pinned: item.pinned === true,
        label: typeof item.label === 'string' ? item.label.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 80) : '',
        width: item.width === 0 || item.width === undefined ? 0 : bounded(item.width, 0, 64, 320),
        fontSize: bounded(item.fontSize, 12, 11, 18),
      })
    }
    return { version: 1, visible: saved.visible, items }
  } catch { return defaultWorkspaceShortcutPreferences() }
}

/** Preserve configured ordering; newly available integrations stay opt-in. */
export function getWorkspaceShortcutItems(preferences: WorkspaceShortcutPreferences, catalogIds: readonly string[]): WorkspaceShortcutItem[] {
  const ids = [...new Set(catalogIds.filter(validId))].slice(0, MAX_ITEMS)
  const available = new Set(ids)
  const configured = preferences.items.filter(item => available.has(item.id))
  const configuredIds = new Set(configured.map(item => item.id))
  return [...configured, ...ids.filter(id => !configuredIds.has(id)).map(defaultItem)]
}
