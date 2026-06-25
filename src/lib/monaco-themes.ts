import type { Monaco } from '@monaco-editor/react'

export type MonacoThemeId = 'scriptor-light' | 'scriptor-dark'

export function registerScriptorMonacoThemes(monaco: Monaco): void {
  monaco.editor.defineTheme('scriptor-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'string.link', foreground: '2563eb' },
      { token: 'markup.heading', foreground: '0f172a', fontStyle: 'bold' },
      { token: 'markup.bold', fontStyle: 'bold' },
      { token: 'markup.italic', fontStyle: 'italic' },
    ],
    colors: {
      'editor.background': '#f8fafc',
      'editor.foreground': '#0f172a',
      'editorLineNumber.foreground': '#94a3b8',
      'editor.selectionBackground': '#dbeafe',
      'editor.lineHighlightBackground': '#f1f5f9',
    },
  })

  monaco.editor.defineTheme('scriptor-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'string.link', foreground: '93c5fd' },
      { token: 'markup.heading', foreground: 'f8fafc', fontStyle: 'bold' },
      { token: 'markup.bold', fontStyle: 'bold' },
      { token: 'markup.italic', fontStyle: 'italic' },
    ],
    colors: {
      'editor.background': '#0f172a',
      'editor.foreground': '#e2e8f0',
      'editorLineNumber.foreground': '#64748b',
      'editor.selectionBackground': '#1e3a5f',
      'editor.lineHighlightBackground': '#1e293b',
    },
  })
}

export function monacoThemeForEditor(editorTheme: 'light' | 'dark'): MonacoThemeId {
  return editorTheme === 'dark' ? 'scriptor-dark' : 'scriptor-light'
}
