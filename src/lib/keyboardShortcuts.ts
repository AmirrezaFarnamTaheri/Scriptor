/** Returns the platform-appropriate display label for a single-key shortcut. */
export function shortcutLabel(key: string): string {
  if (typeof navigator === 'undefined') return `Ctrl+${key}`
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform) ? `⌘${key}` : `Ctrl+${key}`
}
