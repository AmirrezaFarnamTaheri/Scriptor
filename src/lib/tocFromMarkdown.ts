import { headingToId, type TocEntry } from '@scriptor/editor'

/** Lightweight heading TOC from raw markdown (no editor state required). */
export function generateTocFromMarkdown(markdown: string): TocEntry[] {
  const lines = markdown.split('\n')
  const counters = [0, 0, 0, 0, 0, 0]
  const entries: TocEntry[] = []
  let inFence = false

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (/^```/.test(line.trim())) {
      inFence = !inFence
      continue
    }
    if (inFence) continue

    const atx = /^(#{1,6})\s+(.+)$/.exec(line)
    if (!atx) continue

    const level = atx[1].length
    const text = atx[2].trim()
    counters[level - 1] += 1
    for (let reset = level; reset < counters.length; reset += 1) {
      counters[reset] = 0
    }
    const renderedLevel = counters
      .slice(0, level)
      .filter((value) => value > 0)
      .join('.')

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
