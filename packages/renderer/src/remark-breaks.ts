import remarkBreaks from 'remark-breaks'

export { remarkBreaks }

/** Optional soft-break rendering (Obsidian-style single newlines as `<br>`). */
export function remarkBreaksPlugin() {
  return remarkBreaks
}
