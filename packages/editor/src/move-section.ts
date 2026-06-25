import type { StateCommand } from '@codemirror/state'

import { generateToc, type TocEntry } from './toc-field.ts'

function sectionRange(
  state: { doc: { length: number }; sliceDoc: (from: number, to: number) => string },
  entry: TocEntry,
  entries: TocEntry[],
): { from: number; to: number } {
  const index = entries.indexOf(entry)
  const next = entries.slice(index + 1).find((candidate) => candidate.level <= entry.level)
  const from = entry.pos
  const to = next ? next.pos : state.doc.length
  return { from, to }
}

function moveSection(direction: -1 | 1): StateCommand {
  return (target) => {
    const entries = generateToc(target.state)
    const cursor = target.state.selection.main.head
    const currentIndex = entries.findIndex((entry) => {
      const range = sectionRange(target.state, entry, entries)
      return cursor >= range.from && cursor < range.to
    })
    if (currentIndex < 0) return false
    const swapIndex = currentIndex + direction
    if (swapIndex < 0 || swapIndex >= entries.length) return false
    if (entries[swapIndex].level !== entries[currentIndex].level) return false

    const currentRange = sectionRange(target.state, entries[currentIndex], entries)
    const swapRange = sectionRange(target.state, entries[swapIndex], entries)
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
