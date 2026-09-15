import { Compartment } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { oneDark } from '@codemirror/theme-one-dark'

import type { EditorThemeId } from './editor-types.ts'

export type { EditorThemeId }

const themeCompartment = new Compartment()

const lightTheme = EditorView.theme(
  {
    '&': { backgroundColor: 'var(--surface)', color: 'var(--ink)' },
    '.cm-gutters': {
      backgroundColor: 'var(--surface)',
      color: 'var(--muted)',
      borderRight: '1px solid var(--border)',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      color: 'var(--muted)',
    },
    '.cm-lineNumbers .cm-gutterElement.cm-activeLineGutter': {
      color: 'var(--ink-strong)',
      fontWeight: '600',
    },
    '.cm-content': { caretColor: 'var(--primary)' },
  },
  { dark: false },
)

export function editorThemeExtension(theme: EditorThemeId) {
  return theme === 'dark' ? oneDark : lightTheme
}

export function editorThemeCompartment() {
  return themeCompartment
}

export function reconfigureEditorTheme(theme: EditorThemeId) {
  return themeCompartment.reconfigure(editorThemeExtension(theme))
}
