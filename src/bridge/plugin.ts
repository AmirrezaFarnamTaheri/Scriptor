/**
 * Bridge layer for plugin state persistence.
 */
const PLUGIN_STORAGE_KEY = 'scriptor_enabled_plugins'

export async function savePluginState(enabledIds: Set<string> | string[]): Promise<void> {
  const idsArray = Array.from(enabledIds)
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(PLUGIN_STORAGE_KEY, JSON.stringify(idsArray))
  }
}

export async function loadPluginState(): Promise<Set<string> | null> {
  if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem(PLUGIN_STORAGE_KEY)
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          return new Set(parsed)
        }
      } catch {
        // Fallback on parse error
      }
    }
  }
  return null
}
