import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { EditorSelection } from '@codemirror/state'
import type { Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'

function wrapSelectionWithPair(view: EditorView, pair: string): boolean {
  const { state } = view
  const hasSelection = state.selection.ranges.some((range) => !range.empty)
  if (!hasSelection) {
    return false
  }

  view.dispatch(
    state.changeByRange(({ from, to }) => {
      const selected = state.sliceDoc(from, to)
      const newPos = from + pair.length
      return {
        range: EditorSelection.range(newPos, newPos + selected.length),
        changes: { from, to, insert: `${pair}${selected}${pair}` },
      }
    }),
  )
  return true
}

function insertInlineCodePair(view: EditorView): boolean {
  const { state } = view
  const range = state.selection.main
  if (!range.empty) {
    return wrapSelectionWithPair(view, '`')
  }

  view.dispatch({
    changes: { from: range.from, to: range.to, insert: '``' },
    selection: EditorSelection.cursor(range.from + 1),
  })
  return true
}

export function autoPairExtension(): Extension {
  return [
    closeBrackets(),
    keymap.of(closeBracketsKeymap),
    EditorView.inputHandler.of((view, _from, _to, insert) => {
      if (insert === '`') {
        return insertInlineCodePair(view)
      }
      if (insert === '*' || insert === '$') {
        return wrapSelectionWithPair(view, insert === '*' ? '**' : '$')
      }
      return false
    }),
  ]
}
