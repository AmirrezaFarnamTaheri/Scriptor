import type { StateCommand } from '@codemirror/state'

import { generateToc, type TocEntry } from './toc-field.ts'

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

function moveSection(direction: -1 | 1): StateCommand {
  return (target) => {
    const entries = generateToc(target.state)
    const docLength = target.state.doc.length
    const cursor = target.state.selection.main.head
    const currentIndex = entries.findIndex((_entry, index) => {
      const range = sectionRange(entries, index, docLength)
      return cursor >= range.from && cursor < range.to
    })
    if (currentIndex < 0) return false
    const swapIndex = findSiblingIndex(entries, currentIndex, direction)
    if (swapIndex < 0) return false

    const currentRange = sectionRange(entries, currentIndex, docLength)
    const swapRange = sectionRange(entries, swapIndex, docLength)
    const currentText = target.state.sliceDoc(currentRange.from, currentRange.to)
    const swapText = target.state.sliceDoc(swapRange.from, swapRange.to)

    const [first, second] =
      direction < 0
        ? [
            { from: swapRange.from, to: swapRange.to, text: currentText },
            { from: currentRange.from, to: currentRange.to, text: swapText },
          ]
        : [
            { from: currentRange.from, to: currentRange.to, text: swapText },
            { from: swapRange.from, to: swapRange.to, text: currentText },
          ]

    target.dispatch(
      target.state.update({
        changes: [
          { from: first.from, to: first.to, insert: first.text },
          { from: second.from, to: second.to, insert: second.text },
        ],
        scrollIntoView: true,
      }),
    )
    return true
  }
}

export const moveSectionUp: StateCommand = moveSection(-1)
export const moveSectionDown: StateCommand = moveSection(1)
