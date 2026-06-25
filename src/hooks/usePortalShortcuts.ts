import { useEffect } from 'react'

import { parseShortcut, shortcutMatches, type PortalItem } from '@scriptor/portal'

import { writeClipboardText } from '../lib/clipboardText'

interface UsePortalShortcutsOptions {
  items: PortalItem[]
  enabled?: boolean
  onInsert?: (body: string) => void
  onOpenNote?: (path: string) => void
}

export function usePortalShortcuts({
  items,
  enabled = true,
  onInsert,
  onOpenNote,
}: UsePortalShortcutsOptions): void {
  useEffect(() => {
    if (!enabled) return

    const shortcuts = items
      .map((item) => ({ item, parsed: parseShortcut(item.shortcut) }))
      .filter((entry): entry is { item: PortalItem; parsed: NonNullable<ReturnType<typeof parseShortcut>> } =>
        Boolean(entry.parsed),
      )

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      const target = event.target
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return
      }

      for (const { item, parsed } of shortcuts) {
        if (!shortcutMatches(event, parsed)) continue
        event.preventDefault()
        if (item.action === 'copy') {
          void writeClipboardText(item.body)
        } else if (item.action === 'insert') {
          onInsert?.(item.body)
        } else if (item.action === 'open-note') {
          onOpenNote?.(item.body.trim())
        }
        return
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled, items, onInsert, onOpenNote])
}
