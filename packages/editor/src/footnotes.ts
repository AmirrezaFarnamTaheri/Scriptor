import { EditorSelection, type StateCommand } from '@codemirror/state'

import { insertFootnoteIntoMarkdown, nextFootnoteId } from './footnotes-logic.ts'

export { insertFootnoteIntoMarkdown, nextFootnoteId }

/** Insert a footnote reference at the cursor and append a definition stub at EOF when missing. */
export const insertFootnoteRef: StateCommand = ({ state, dispatch }) => {
  const selection = state.selection.main
  const { markdown, cursor } = insertFootnoteIntoMarkdown(
    state.doc.toString(),
    selection.from,
    selection.to,
  )
  dispatch(
    state.update({
      changes: { from: 0, to: state.doc.length, insert: markdown },
      selection: EditorSelection.cursor(cursor),
    }),
  )
  return true
}
