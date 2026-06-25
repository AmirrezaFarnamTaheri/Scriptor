import { EditorSelection, Prec, StateEffect, StateField, type SelectionRange } from '@codemirror/state'
import { Decoration, EditorView, WidgetType, keymap } from '@codemirror/view'

import {
  expandSnippetTemplate,
  looksLikeSnippetTemplate,
  type ExpandedSnippet,
  type SnippetVariableContext,
} from './snippet-parser.ts'

const snippetTabsEffect = StateEffect.define<EditorSelection[]>()
const shiftNextTabEffect = StateEffect.define()

const tabstopDeco = Decoration.mark({ class: 'cm-snippet-tabstop' })

class SnippetWidget extends WidgetType {
  label: string
  range: SelectionRange

  constructor(label: string, range: SelectionRange) {
    super()
    this.label = label
    this.range = range
  }

  eq(other: SnippetWidget): boolean {
    return other.label === this.label && other.range.eq(this.range)
  }

  toDOM(): HTMLElement {
    const element = document.createElement('span')
    element.className = 'cm-snippet-tabstop-widget'
    element.textContent = this.label
    return element
  }

  ignoreEvent(): boolean {
    return true
  }
}

interface SnippetFieldState {
  activeSelections: EditorSelection[]
}

const snippetField = StateField.define<SnippetFieldState>({
  create() {
    return { activeSelections: [] }
  },
  update(value, transaction) {
    let activeSelections = value.activeSelections

    for (const effect of transaction.effects) {
      if (effect.is(snippetTabsEffect)) {
        activeSelections = effect.value
      } else if (effect.is(shiftNextTabEffect)) {
        activeSelections = activeSelections.slice(1)
      }
    }

    if (transaction.docChanged && activeSelections.length > 0) {
      activeSelections = activeSelections.map((selection) => selection.map(transaction.changes))
    }

    return { activeSelections }
  },
  provide: (field) =>
    EditorView.decorations.from(field, (state) => {
      if (state.activeSelections.length === 0) {
        return Decoration.none
      }

      const decorations = []
      let position = 0
      for (const selection of state.activeSelections) {
        position += 1
        for (const range of selection.ranges) {
          if (range.empty) {
            decorations.push(
              Decoration.widget({
                widget: new SnippetWidget(`$${position}`, range),
              }).range(range.from),
            )
          } else {
            decorations.push(tabstopDeco.range(range.from, range.to))
          }
        }
      }

      return Decoration.set(decorations, true)
    }),
})

function tabStopsToSelections(tabStops: ExpandedSnippet['tabStops']): EditorSelection[] {
  const grouped = new Map<number, SelectionRange[]>()
  for (const stop of tabStops) {
    const ranges = grouped.get(stop.index) ?? []
    ranges.push(EditorSelection.range(stop.from, stop.to))
    grouped.set(stop.index, ranges)
  }

  const ordered = [...grouped.entries()].sort(([left], [right]) => {
    if (left === 0) return 1
    if (right === 0) return -1
    return left - right
  })

  return ordered.map(([, ranges]) => EditorSelection.create(ranges))
}

export function insertExpandedSnippet(
  view: EditorView,
  template: string,
  from: number,
  to: number,
  context: SnippetVariableContext = {},
): boolean {
  if (!looksLikeSnippetTemplate(template)) {
    return false
  }

  const expanded = expandSnippetTemplate(template, from, context)
  const selections = tabStopsToSelections(expanded.tabStops)
  const firstSelection = selections.shift()

  view.dispatch({
    changes: { from, to, insert: expanded.text },
    selection: firstSelection,
    effects: selections.length > 0 ? snippetTabsEffect.of(selections) : snippetTabsEffect.of([]),
    scrollIntoView: true,
  })

  return true
}

export function nextSnippetTab(view: EditorView): boolean {
  const { activeSelections } = view.state.field(snippetField)
  if (activeSelections.length === 0) {
    return false
  }

  view.dispatch({
    selection: activeSelections[0],
    effects: [shiftNextTabEffect.of(null), EditorView.scrollIntoView(activeSelections[0].main.from, { y: 'center' })],
  })
  return true
}

export function abortSnippet(view: EditorView): boolean {
  const { activeSelections } = view.state.field(snippetField)
  if (activeSelections.length === 0) {
    return false
  }

  view.dispatch({ effects: snippetTabsEffect.of([]) })
  return true
}

export function snippetExtension() {
  return [
    snippetField,
    EditorView.baseTheme({
      '.cm-snippet-tabstop': {
        backgroundColor: 'var(--primary-soft, rgba(59, 130, 246, 0.18))',
        borderRadius: '2px',
        outline: '1px solid var(--primary, #3b82f6)',
      },
      '.cm-snippet-tabstop-widget': {
        color: 'var(--primary, #3b82f6)',
        fontSize: '0.75em',
        opacity: 0.8,
        userSelect: 'none',
      },
    }),
    Prec.high(
      keymap.of([
        {
          key: 'Tab',
          run: (view) => nextSnippetTab(view),
        },
        {
          key: 'Escape',
          run: (view) => abortSnippet(view),
        },
      ]),
    ),
  ]
}

export { looksLikeSnippetTemplate, type SnippetVariableContext }
