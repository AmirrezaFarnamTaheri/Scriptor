import { autocompletion, type Completion, type CompletionContext } from '@codemirror/autocomplete'
import type { Extension } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

export interface EditorAutocompleteContext {
  notePaths?: string[]
  tags?: string[]
  headings?: string[]
  bibliographyKeys?: string[]
}

let context: EditorAutocompleteContext = {}

export function setEditorAutocompleteContext(next: EditorAutocompleteContext): void {
  context = next
}

export function dispatchEditorAutocompleteContext(_view: EditorView, next: EditorAutocompleteContext): void {
  setEditorAutocompleteContext(next)
}

function citeCompletions(): Completion[] {
  return (context.bibliographyKeys ?? []).map((key) => ({
    label: `@${key}`,
    type: 'citation',
    apply: `[@${key}]`,
  }))
}

function tagCompletions(): Completion[] {
  return (context.tags ?? []).map((tag) => ({
    label: `#${tag}`,
    type: 'tag',
    apply: `#${tag}`,
  }))
}

function fileCompletions(): Completion[] {
  return (context.notePaths ?? []).map((path) => ({
    label: path,
    type: 'file',
    apply: `[[${path.replace(/\.md$/, '')}]]`,
  }))
}

function headingCompletions(): Completion[] {
  return (context.headings ?? []).map((heading) => ({
    label: heading,
    type: 'heading',
    apply: `[[#${heading}]]`,
  }))
}

function buildCompletions(source: Completion[], prefix: string): Completion[] {
  const lower = prefix.toLowerCase()
  return source.filter((item) => item.label.toLowerCase().includes(lower))
}

export function editorAutocompleteExtension(): Extension {
  return autocompletion({
    override: [
      (completionContext: CompletionContext) => {
        const line = completionContext.state.doc.lineAt(completionContext.pos)
        const before = line.text.slice(0, completionContext.pos - line.from)

        const citeMatch = before.match(/\[@[\w:-]*$/)
        if (citeMatch) {
          const prefix = citeMatch[0].slice(2)
          return { from: completionContext.pos - prefix.length - 1, options: buildCompletions(citeCompletions(), prefix) }
        }

        const tagMatch = before.match(/#[\w/-]*$/)
        if (tagMatch) {
          const prefix = tagMatch[0].slice(1)
          return { from: completionContext.pos - prefix.length - 1, options: buildCompletions(tagCompletions(), prefix) }
        }

        const wikiMatch = before.match(/\[\[[^\]|]*$/)
        if (wikiMatch) {
          const inner = wikiMatch[0].slice(2)
          if (inner.startsWith('#')) {
            const prefix = inner.slice(1)
            return {
              from: completionContext.pos - prefix.length - 3,
              options: buildCompletions(headingCompletions(), prefix),
            }
          }
          return {
            from: completionContext.pos - inner.length - 2,
            options: buildCompletions(fileCompletions(), inner),
          }
        }

        return null
      },
    ],
  })
}
