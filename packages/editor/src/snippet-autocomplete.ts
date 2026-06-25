import { autocompletion } from '@codemirror/autocomplete'
import { StateEffect, StateField } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

import type { SnippetCatalogEntry } from './snippet-catalog.ts'
import type { SnippetVariableContext } from './snippet-parser.ts'
import { insertExpandedSnippet } from './snippets.ts'

export const updateSnippetCatalog = StateEffect.define<SnippetCatalogEntry[]>()
const updateSnippetContext = StateEffect.define<SnippetVariableContext>()

interface SnippetCatalogState {
  entries: SnippetCatalogEntry[]
  context: SnippetVariableContext
}

const snippetCatalogField = StateField.define<SnippetCatalogState>({
  create() {
    return { entries: [], context: {} }
  },
  update(value, transaction) {
    let entries = value.entries
    let context = value.context

    for (const effect of transaction.effects) {
      if (effect.is(updateSnippetCatalog)) {
        entries = effect.value
      } else if (effect.is(updateSnippetContext)) {
        context = effect.value
      }
    }

    return { entries, context }
  },
})

function snippetMatch(state: EditorView['state'], pos: number): { from: number; to: number; query: string } | null {
  const line = state.doc.lineAt(pos)
  const linePrefix = state.doc.sliceString(line.from, pos)
  const match = linePrefix.match(/(?:^|\s):([A-Za-z0-9_-]*)$/)
  if (!match) {
    return null
  }

  const colonIndex = linePrefix.lastIndexOf(':')
  return {
    from: line.from + colonIndex,
    to: pos,
    query: (match[1] ?? '').toLowerCase(),
  }
}

function applySnippetCompletion(
  view: EditorView,
  template: string,
  from: number,
  to: number,
  context: SnippetVariableContext,
): void {
  const replaced = insertExpandedSnippet(view, template, from, to, context)
  if (!replaced) {
    view.dispatch({
      changes: { from, to, insert: template },
      selection: { anchor: from + template.length },
    })
  }
}

export function snippetAutocompleteExtension(initialContext: SnippetVariableContext = {}) {
  return [
    snippetCatalogField.init(() => ({ entries: [], context: initialContext })),
    autocompletion({
      activateOnTyping: true,
      override: [
        (context) => {
          const matched = snippetMatch(context.state, context.pos)
          if (!matched) {
            return null
          }

          const { entries, context: snippetContext } = context.state.field(snippetCatalogField)
          const matches = entries.filter((entry) => entry.name.toLowerCase().includes(matched.query))
          if (matches.length === 0) {
            return null
          }

          return {
            from: matched.from,
            to: matched.to,
            options: matches.map((entry) => ({
              label: entry.name,
              detail: entry.description,
              type: 'keyword',
              apply: (view, _completion, from, to) => {
                applySnippetCompletion(view, entry.content, from, to, snippetContext)
              },
            })),
          }
        },
      ],
    }),
  ]
}

export function dispatchSnippetCatalog(view: EditorView, entries: SnippetCatalogEntry[]): void {
  view.dispatch({ effects: updateSnippetCatalog.of(entries) })
}

export function dispatchSnippetContext(view: EditorView, context: SnippetVariableContext): void {
  view.dispatch({ effects: updateSnippetContext.of(context) })
}
