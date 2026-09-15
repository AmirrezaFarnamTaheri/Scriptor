import type { StateCommand } from '@codemirror/state'

import { findSiblingIndex, sectionRange } from './section-move-logic.ts'
import { generateToc } from './toc-field.ts'

export { findSiblingIndex, sectionRange }

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
