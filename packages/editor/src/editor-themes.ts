import { Compartment } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { oneDark } from '@codemirror/theme-one-dark'

export type EditorThemeId = 'light' | 'dark'

const themeCompartment = new Compartment()

const lightTheme = EditorView.theme(
  {
    '&': { backgroundColor: 'var(--surface)', color: 'var(--ink)' },
    '.cm-gutters': { backgroundColor: 'var(--surface)', color: 'var(--faint)', borderRight: '1px solid var(--border)' },
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
