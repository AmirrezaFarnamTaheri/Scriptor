import type { Monaco } from '@monaco-editor/react'
import type * as MonacoEditor from 'monaco-editor'

export interface MonacoCompletionContext {
  notePaths?: string[]
  tags?: string[]
  headings?: string[]
}

let completionContext: MonacoCompletionContext = {}

export function setMonacoCompletionContext(next: MonacoCompletionContext): void {
  completionContext = next
}

export function registerMarkdownCompletions(monaco: Monaco): { dispose: () => void } {
  return monaco.languages.registerCompletionItemProvider('markdown', {
    triggerCharacters: ['[', '#', '@'],
    provideCompletionItems(
      model: MonacoEditor.editor.ITextModel,
      position: MonacoEditor.Position,
    ) {
      const word = model.getWordUntilPosition(position)
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      }
      const linePrefix = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      })

      const suggestions = []

      if (linePrefix.endsWith('[[') || linePrefix.includes('[[')) {
        for (const path of completionContext.notePaths ?? []) {
          const label = path.replace(/\.md$/i, '')
          suggestions.push({
            label,
            kind: monaco.languages.CompletionItemKind.File,
            insertText: `${label}]]`,
            range,
          })
        }
        for (const heading of completionContext.headings ?? []) {
          suggestions.push({
            label: `#${heading}`,
            kind: monaco.languages.CompletionItemKind.Reference,
            insertText: `#${heading}]]`,
            range,
          })
        }
      }

      if (linePrefix.endsWith('#') || /\s#\w*$/.test(linePrefix)) {
        for (const tag of completionContext.tags ?? []) {
          suggestions.push({
            label: tag,
            kind: monaco.languages.CompletionItemKind.Enum,
            insertText: tag,
            range,
          })
        }
      }

      return { suggestions }
    },
  })
}
