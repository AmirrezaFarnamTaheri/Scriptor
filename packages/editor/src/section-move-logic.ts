import type { TocEntry } from './toc-field.ts'

export function sectionRange(
  entries: TocEntry[],
  index: number,
  docLength: number,
): { from: number; to: number } {
  const entry = entries[index]
  let to = docLength
  for (let candidate = index + 1; candidate < entries.length; candidate += 1) {
    if (entries[candidate].level <= entry.level) {
      to = entries[candidate].pos
      break
    }
  }
  return { from: entry.pos, to }
}

/**
 * Index of the adjacent sibling heading (same level, same parent) in the given
 * direction, skipping over child headings. Returns -1 when there is none.
 */
export function findSiblingIndex(entries: TocEntry[], currentIndex: number, direction: -1 | 1): number {
  const level = entries[currentIndex].level
  for (let index = currentIndex + direction; index >= 0 && index < entries.length; index += direction) {
    if (entries[index].level < level) return -1
    if (entries[index].level === level) return index
  }
  return -1
}

export interface SectionLineRange {
  startLine: number // 1-indexed, inclusive
  endLine: number // 1-indexed, inclusive
}

export function sectionLineRange(
  entries: TocEntry[],
  index: number,
  totalLines: number,
): SectionLineRange {
  const entry = entries[index]
  let endLine = totalLines
  for (let candidate = index + 1; candidate < entries.length; candidate += 1) {
    if (entries[candidate].level <= entry.level) {
      endLine = entries[candidate].line - 1
      break
    }
  }
  return { startLine: entry.line, endLine }
}

/**
 * Move the section containing `cursorLine` up or down relative to its sibling headings.
 * Returns the reordered lines and the adjusted cursor line, or `null` if the section cannot move.
 */
export function moveSectionLines(
  entries: TocEntry[],
  lines: string[],
  cursorLine: number,
  direction: -1 | 1,
): { lines: string[]; newCursorLine: number } | null {
  if (entries.length === 0) return null

  const currentIndex = entries.findLastIndex((entry) => entry.line <= cursorLine)
  if (currentIndex < 0) return null

  const currentRange = sectionLineRange(entries, currentIndex, lines.length)
  if (cursorLine > currentRange.endLine) return null

  const swapIndex = findSiblingIndex(entries, currentIndex, direction)
  if (swapIndex < 0) return null

  const swapRange = sectionLineRange(entries, swapIndex, lines.length)

  const [firstRange, secondRange] =
    direction < 0 ? [swapRange, currentRange] : [currentRange, swapRange]

  const before = lines.slice(0, firstRange.startLine - 1)
  const firstSlice = lines.slice(firstRange.startLine - 1, firstRange.endLine)
  const between = lines.slice(firstRange.endLine, secondRange.startLine - 1)
  const secondSlice = lines.slice(secondRange.startLine - 1, secondRange.endLine)
  const after = lines.slice(secondRange.endLine)

  const reordered = [...before, ...secondSlice, ...between, ...firstSlice, ...after]

  const newCursorLine =
    direction < 0
      ? cursorLine - (firstSlice.length + between.length)
      : cursorLine + (secondSlice.length + between.length)

  return { lines: reordered, newCursorLine }
}
