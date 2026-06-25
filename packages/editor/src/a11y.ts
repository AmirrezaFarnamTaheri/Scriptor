import { EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'

/** MarkEdit-style accessibility attributes on the CodeMirror content root. */
export function editorA11yExtension(): Extension {
  return EditorView.contentAttributes.of({
    role: 'textbox',
    'aria-multiline': 'true',
    'aria-label': 'Markdown editor',
    spellcheck: 'true',
    autocorrect: 'on',
    autocapitalize: 'sentences',
  })
}
