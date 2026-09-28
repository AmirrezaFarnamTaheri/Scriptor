import { TASK_CHECKBOX_CLASS_SOURCE } from '@scriptor/core/task'
import { syntaxTree } from '@codemirror/language'
import { EditorView } from '@codemirror/view'

import { toggleTaskList } from './gfm-commands.ts'

// Must accept every marker the status registry can produce, not just GFM's
// `[ ]`/`[x]`: the click handler below gates on a `TaskMarker` node, which the
// parser also emits for `[/]`, `[-]` and `[>]`.
const TASK_LINE = new RegExp(`^(\\s*[-*+] +\\[[${TASK_CHECKBOX_CLASS_SOURCE}]\\] )`)

function taskLineAt(view: EditorView, pos: number): { lineFrom: number; lineTo: number; checked: boolean } | null {
  const line = view.state.doc.lineAt(pos)
  const match = TASK_LINE.exec(line.text)
  if (!match) return null
  const checked = /\[x\]/i.test(match[0])
  return { lineFrom: line.from, lineTo: line.to, checked }
}

/** Cmd/Ctrl-click toggles GFM task checkbox on the current line (MarkEdit pattern). */
export function taskToggleClickExtension(): import('@codemirror/state').Extension {
  return EditorView.domEventHandlers({
    mousedown(event, view) {
      if (!(event.metaKey || event.ctrlKey)) return false
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
      if (pos == null) return false
      const task = taskLineAt(view, pos)
      if (!task) return false
      event.preventDefault()
      view.dispatch({ selection: { anchor: task.lineFrom } })
      toggleTaskList(view)
      return true
    },
    click(event, view) {
      if (!(event.metaKey || event.ctrlKey)) return false
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
      if (pos == null) return false
      const node = syntaxTree(view.state).resolve(pos)
      if (node.name !== 'TaskMarker' && node.name !== 'ListItem') return false
      const task = taskLineAt(view, pos)
      if (!task) return false
      event.preventDefault()
      view.dispatch({ selection: { anchor: task.lineFrom } })
      toggleTaskList(view)
      return true
    },
  })
}
