import type { Monaco } from '@monaco-editor/react'
import type * as MonacoEditor from 'monaco-editor'

export interface MonacoCompletionContext {
  notePaths?: string[]
  tags?: string[]
  headings?: string[]
}

/** Upper bound on wikilink suggestions handed to Monaco for one keystroke. */
const MAX_WIKILINK_SUGGESTIONS = 200

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

      // Only an *open* wikilink triggers link completion: `[[` with no `]]`
      // between it and the caret. Matching anywhere on the line fired for the
      // rest of any line containing `[[` and produced `Alpha]]]]`.
      const openWikilink = /\[\[([^\]]*)$/.exec(linePrefix)
      if (openWikilink) {
        const typed = openWikilink[1].toLowerCase()
        const lineSuffix = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: position.column,
          endLineNumber: position.lineNumber,
          endColumn: model.getLineMaxColumn(position.lineNumber),
        })
        const alreadyClosed = lineSuffix.startsWith(']]')
        const close = alreadyClosed ? '' : ']]'
        const linkRange = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          // Replace everything typed after `[[` so the inserted label does not
          // get concatenated onto the partial word.
          startColumn: position.column - openWikilink[1].length,
          endColumn: position.column,
        }

        for (const path of completionContext.notePaths ?? []) {
          if (suggestions.length >= MAX_WIKILINK_SUGGESTIONS) break
          const label = path.replace(/\.md$/i, '')
          if (typed && !label.toLowerCase().includes(typed)) continue
          suggestions.push({
            label,
            kind: monaco.languages.CompletionItemKind.File,
            insertText: `${label}${close}`,
            range: linkRange,
          })
        }
        for (const heading of completionContext.headings ?? []) {
          if (suggestions.length >= MAX_WIKILINK_SUGGESTIONS) break
          const label = `#${heading}`
          if (typed && !label.toLowerCase().includes(typed)) continue
          suggestions.push({
            label,
            kind: monaco.languages.CompletionItemKind.Reference,
            insertText: `${label}${close}`,
            range: linkRange,
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
