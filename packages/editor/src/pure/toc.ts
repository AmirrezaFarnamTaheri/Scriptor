import { headingToId } from '../heading-id.ts'
import type { TocEntry } from '../toc-field.ts'

export type { TocEntry }

/** Lightweight heading TOC parser from raw markdown (zero CodeMirror runtime dependency). */
export function generateTocFromMarkdown(markdown: string): TocEntry[] {
  const lines = markdown.split('\n')
  const counters = [0, 0, 0, 0, 0, 0]
  const entries: TocEntry[] = []
  let fenceChar: '`' | '~' | null = null

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const fence = /^(`{3,}|~{3,})/.exec(line.trim())
    if (fence) {
      const char = fence[1][0] as '`' | '~'
      if (fenceChar === null) {
        fenceChar = char
        continue
      }
      if (fenceChar === char) {
        fenceChar = null
        continue
      }
      // A ~~~ line inside a ``` fence (or vice versa) is fenced content.
    }
    if (fenceChar !== null) continue

    const atx = /^(#{1,6})\s+(.+)$/.exec(line)
    if (!atx) continue

    const level = atx[1].length
    const text = atx[2].trim()
    counters[level - 1] += 1
    for (let reset = level; reset < counters.length; reset += 1) {
      counters[reset] = 0
    }
    // Keep skipped levels as an explicit 0 segment. Dropping empty levels made
    // `# A` + `### B` render as "1.1", indistinguishable from a real `##`
    // sibling; it now renders "1.0.1".
    const renderedLevel = counters.slice(0, level).join('.')

    entries.push({
      line: index + 1,
      pos: 0,
      text,
      level,
      renderedLevel,
      id: headingToId(text),
    })
  }

  return entries
}

export function findTocEntryById(entries: TocEntry[], anchor: string): TocEntry | undefined {
  const normalized = anchor.replace(/^#/, '').toLowerCase()
  return entries.find((entry) => entry.id.toLowerCase() === normalized)
}
