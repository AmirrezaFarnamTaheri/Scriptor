import type { EditorView } from '@codemirror/view'

import {
  toggleBlockquote,
  toggleBold,
  toggleHeading,
  toggleItalic,
  toggleStrikethrough,
} from './gfm-commands.ts'
import {
  addTableColumn,
  addTableRow,
  applyTableMutation,
} from './transform-logic.ts'
import { moveSectionDown, moveSectionUp } from './move-section.ts'

export type EditorTransformAction =
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'blockquote'
  | 'code'
  | 'link'
  | 'table'
  | 'table-add-row'
  | 'table-add-col'
  | 'move-section-up'
  | 'move-section-down'

export function wrapText(editor: EditorView, prefix: string, suffix = prefix): void {
  const selection =
    editor.state.selection.ranges.find((range) => !range.empty) ??
    editor.state.wordAt(editor.state.selection.main.head) ??
    editor.state.selection.main

  const { from, to } = selection
  const text = editor.state.sliceDoc(from, to)

  const shouldUnwrap =
    editor.state.sliceDoc(from - prefix.length, from) === prefix &&
    editor.state.sliceDoc(to, to + suffix.length) === suffix

  if (shouldUnwrap) {
    editor.dispatch({
      changes: {
        from: from - prefix.length,
        to: to + suffix.length,
        insert: text,
      },
      selection: {
        anchor: from - prefix.length,
        head: to - prefix.length,
      },
    })
  } else {
    editor.dispatch({
      changes: { from, to, insert: prefix + text + suffix },
      selection: {
        anchor: from + prefix.length,
        head: to + prefix.length,
      },
    })
  }
  editor.focus()
}

export function replaceLines(
  editor: EditorView,
  replace: (line: string, index: number) => string,
): void {
  const [selection] = editor.state.selection.ranges
  const { from } = editor.state.doc.lineAt(selection.from)
  const { to } = editor.state.doc.lineAt(selection.to)
  const lines = editor.state.sliceDoc(from, to).split('\n')

  editor.dispatch({
    changes: {
      from,
      to,
      insert: lines.map((line, index) => replace(line, index)).join('\n'),
    },
  })
  editor.focus()
}

export function appendBlock(editor: EditorView, content: string): void {
  const prefix = '\n\n'
  const suffix = '\n'
  const end = editor.state.doc.lineAt(editor.state.selection.main.head).to
  editor.dispatch({
    changes: { from: end, insert: prefix + content + suffix },
    selection: {
      anchor: end + prefix.length,
      head: end + prefix.length + content.length,
    },
  })
  editor.focus()
}

export function applyEditorTransform(editor: EditorView, action: EditorTransformAction): void {
  switch (action) {
    case 'bold':
      toggleBold(editor)
      return
    case 'italic':
      toggleItalic(editor)
      return
    case 'strikethrough':
      toggleStrikethrough(editor)
      return
    case 'code':
      wrapText(editor, '`')
      return
    case 'link':
      wrapText(editor, '[', '](https://example.com)')
      return
    case 'h1':
      toggleHeading(editor, 1)
      return
    case 'h2':
      toggleHeading(editor, 2)
      return
    case 'h3':
      toggleHeading(editor, 3)
      return
    case 'blockquote':
      toggleBlockquote(editor)
      return
    case 'table':
      appendBlock(editor, '| Column | Column |\n| --- | --- |\n|  |  |')
      return
    case 'table-add-row':
    case 'table-add-col': {
      const lineIndex = editor.state.doc.lineAt(editor.state.selection.main.head).number - 1
      const lines = editor.state.doc.toString().split('\n')
      const next = applyTableMutation(
        lines,
        lineIndex,
        action === 'table-add-row' ? addTableRow : addTableColumn,
      )
      if (!next) return
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: next.join('\n') },
      })
      editor.focus()
      return
    }
    case 'move-section-up':
      moveSectionUp({ state: editor.state, dispatch: (tr) => editor.dispatch(tr) })
      editor.focus()
      return
    case 'move-section-down':
      moveSectionDown({ state: editor.state, dispatch: (tr) => editor.dispatch(tr) })
      editor.focus()
      return
    default:
      return
  }
}
