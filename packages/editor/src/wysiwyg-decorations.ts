import { syntaxTree } from '@codemirror/language'
import { StateEffect, StateField, type Range } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import type { Extension } from '@codemirror/state'

import { TASK_CHECKBOX_CLASS_SOURCE } from '@scriptor/core/task'

const headingMarks = new Map<number, Decoration>([
  [1, Decoration.mark({ class: 'cm-wysiwyg-heading cm-wysiwyg-heading-1' })],
  [2, Decoration.mark({ class: 'cm-wysiwyg-heading cm-wysiwyg-heading-2' })],
  [3, Decoration.mark({ class: 'cm-wysiwyg-heading cm-wysiwyg-heading-3' })],
  [4, Decoration.mark({ class: 'cm-wysiwyg-heading cm-wysiwyg-heading-4' })],
  [5, Decoration.mark({ class: 'cm-wysiwyg-heading cm-wysiwyg-heading-5' })],
  [6, Decoration.mark({ class: 'cm-wysiwyg-heading cm-wysiwyg-heading-6' })],
])
const hiddenSyntax = Decoration.replace({})
const strongMark = Decoration.mark({ class: 'cm-wysiwyg-strong' })
const emphasisMark = Decoration.mark({ class: 'cm-wysiwyg-emphasis' })
const linkMark = Decoration.mark({ class: 'cm-wysiwyg-link' })
const inlineCodeMark = Decoration.mark({ class: 'cm-wysiwyg-inline-code' })
const blockquoteMark = Decoration.mark({ class: 'cm-wysiwyg-blockquote' })
const taskListMark = Decoration.mark({ class: 'cm-wysiwyg-task' })

// GFM's `[ ]`/`[x]` plus Scriptor's `[/]`, `[-]`, `[>]` task markers, from the
// status registry. All of them are authored source that stays visible in the
// WYSIWYG surface.
const taskLinePattern = new RegExp(`^(\\s*[-*+] +\\[[${TASK_CHECKBOX_CLASS_SOURCE}]\\] )`)

class TaskCheckboxWidget extends WidgetType {
  readonly checked: boolean
  readonly markerFrom: number
  constructor(checked: boolean, markerFrom: number) {
    super()
    this.checked = checked
    this.markerFrom = markerFrom
  }
  eq(other: TaskCheckboxWidget) { return other.checked === this.checked && other.markerFrom === this.markerFrom }

  private syncDom(button: HTMLButtonElement) {
    button.dataset.markerFrom = String(this.markerFrom)
    button.setAttribute('aria-checked', String(this.checked))
    button.setAttribute('aria-label', this.checked ? 'Mark task incomplete' : 'Mark task complete')
    button.textContent = this.checked ? '✓' : ''
  }

  // Keep the same native button focused after changing the Markdown marker.
  // Its data offset must be updated when preceding edits move a task.
  updateDOM(dom: HTMLElement) {
    if (!(dom instanceof HTMLButtonElement)) return false
    this.syncDom(dom)
    return true
  }

  ignoreEvent() { return true }

  toDOM(view: EditorView) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'cm-wysiwyg-task-toggle'
    button.setAttribute('role', 'checkbox')
    this.syncDom(button)
    button.addEventListener('mousedown', event => event.preventDefault())
    button.addEventListener('click', event => {
      event.preventDefault()
      event.stopPropagation()
      const markerFrom = Number(button.dataset.markerFrom)
      if (!Number.isInteger(markerFrom) || markerFrom < 0) return
      const marker = view.state.doc.sliceString(markerFrom, markerFrom + 3)
      if (marker !== '[ ]' && marker.toLowerCase() !== '[x]') return
      view.dispatch({ changes: { from: markerFrom + 1, to: markerFrom + 2, insert: marker === '[ ]' ? 'x' : ' ' } })
    })
    return button
  }
}

class FrontmatterWidget extends WidgetType {
  readonly from: number
  constructor(from: number) {
    super()
    this.from = from
  }
  eq(other: FrontmatterWidget) { return other.from === this.from }
  ignoreEvent() { return true }
  toDOM(view: EditorView) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'cm-wysiwyg-frontmatter-toggle'
    button.textContent = 'Properties'
    button.setAttribute('aria-label', 'Show note properties')
    button.addEventListener('mousedown', event => event.preventDefault())
    button.addEventListener('click', event => {
      event.preventDefault()
      view.dispatch({effects: showFrontmatter.of(true),selection:{anchor:this.from},scrollIntoView:true})
      view.focus()
    })
    return button
  }
}

const showFrontmatter = StateEffect.define<boolean>()

// Block replacements must be supplied by a state field: view plugins cannot
// change the document's vertical layout.
function frontmatterDecorations(doc: { lines: number; line: (number: number) => { from: number; to: number; text: string } }): DecorationSet {
  if (doc.lines < 3 || doc.line(1).text.replace(/^\uFEFF/, '').trim() !== '---') return Decoration.none
  for (let number = 2; number <= Math.min(doc.lines, 256); number++) {
    if (/^(---|\.\.\.)\s*$/.test(doc.line(number).text)) {
      const first = doc.line(1)
      const last = doc.line(number)
      return Decoration.set([
        Decoration.replace({ block: true, widget: new FrontmatterWidget(first.from) }).range(first.from, last.to),
      ])
    }
  }
  return Decoration.none
}

const frontmatterField = StateField.define<{ revealed: boolean; decorations: DecorationSet }>({
  create(state) { return { revealed: false, decorations: frontmatterDecorations(state.doc) } },
  update(value, transaction) {
    const reveal = transaction.effects.some(effect => effect.is(showFrontmatter) && effect.value)
    if (reveal) return { revealed: true, decorations: Decoration.none }
    if (transaction.docChanged && !value.revealed) {
      return { revealed: false, decorations: frontmatterDecorations(transaction.state.doc) }
    }
    return value
  },
  provide: field => EditorView.decorations.from(field, value => value.decorations),
})

function buildDecorations(view: EditorView): DecorationSet {
  const ranges: Range<Decoration>[] = []
  const activeLine = view.state.doc.lineAt(view.state.selection.main.head).number
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        const lineNumber = view.state.doc.lineAt(node.from).number
        const revealSyntax = lineNumber === activeLine
        const headingMatch = /^ATXHeading([1-6])$/.exec(node.name)

        if (!revealSyntax) {
          const parentName = node.node.parent?.name
          const hide =
            node.name === 'HeaderMark' ||
            node.name === 'EmphasisMark' ||
            node.name === 'CodeMark' ||
            node.name === 'QuoteMark' ||
            node.name === 'LinkMark' ||
            (node.name === 'URL' && parentName === 'Link')
          if (hide) {
            ranges.push(hiddenSyntax.range(node.from, node.to))
            return
          }
        }

        if (headingMatch) {
          ranges.push((headingMarks.get(Number(headingMatch[1])) ?? headingMarks.get(6)!).range(node.from, node.to))
        } else if (node.name === 'StrongEmphasis') {
          ranges.push(strongMark.range(node.from, node.to))
        } else if (node.name === 'Emphasis') {
          ranges.push(emphasisMark.range(node.from, node.to))
        } else if (node.name === 'Link' || node.name === 'URL') {
          ranges.push(linkMark.range(node.from, node.to))
        } else if (node.name === 'InlineCode') {
          ranges.push(inlineCodeMark.range(node.from, node.to))
        } else if (node.name === 'Blockquote') {
          ranges.push(blockquoteMark.range(node.from, node.to))
        } else if (node.name === 'ListItem') {
          const line = view.state.doc.lineAt(node.from)
          const standardTask = /^(\s*[-*+] +)(\[[ xX]\])(?=\s|$)/.exec(line.text)
          if (!revealSyntax && standardTask) {
            const markerFrom = line.from + standardTask[1].length
            // Hide the literal Markdown bullet beside the rendered checkbox.
            // Keep source bytes intact and reveal their syntax on the active line.
            const bulletFrom = line.from + (standardTask[1].length - standardTask[1].trimStart().length)
            ranges.push(hiddenSyntax.range(bulletFrom, markerFrom))
            ranges.push(Decoration.replace({
              widget: new TaskCheckboxWidget(standardTask[2].toLowerCase() === '[x]', markerFrom),
            }).range(markerFrom, markerFrom + 3))
          }
          if (taskLinePattern.test(line.text)) {
            ranges.push(taskListMark.range(node.from, node.to))
          }
        }
      },
    })
  }
  return Decoration.set(ranges, true)
}

const wysiwygPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildDecorations(update.view)
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
)

export function wysiwygDecorationExtension(): Extension {
  return [
    frontmatterField,
    wysiwygPlugin,
    EditorView.baseTheme({
      '.cm-wysiwyg-heading': {
        fontWeight: '700',
        lineHeight: '1.25',
      },
      '.cm-wysiwyg-heading-1': { fontSize: '1.9em' },
      '.cm-wysiwyg-heading-2': { fontSize: '1.55em' },
      '.cm-wysiwyg-heading-3': { fontSize: '1.3em' },
      '.cm-wysiwyg-heading-4': { fontSize: '1.15em' },
      '.cm-wysiwyg-heading-5': { fontSize: '1.05em' },
      '.cm-wysiwyg-heading-6': { fontSize: '1em' },
      '.cm-wysiwyg-strong': { fontWeight: '700' },
      '.cm-wysiwyg-emphasis': { fontStyle: 'italic' },
      '.cm-wysiwyg-link': { color: 'var(--primary)', textDecoration: 'underline' },
      '.cm-wysiwyg-inline-code': {
        fontFamily: 'var(--mono, monospace)',
        backgroundColor: 'var(--primary-soft, #eef2ff)',
        borderRadius: '3px',
        padding: '0 2px',
      },
      '.cm-wysiwyg-blockquote': {
        borderLeft: '3px solid var(--border, #ccc)',
        paddingLeft: '8px',
        color: 'var(--muted, #666)',
      },
      '.cm-wysiwyg-task': { listStyle: 'none' },
      '.cm-wysiwyg-task-toggle': {
        display: 'inline-grid', placeItems: 'center', width: '18px', height: '18px',
        padding: '0', marginRight: '6px', verticalAlign: 'middle',
        border: '1px solid var(--border-strong)', borderRadius: '4px',
        color: 'var(--ink-strong)', backgroundColor: 'var(--surface-raised)', cursor: 'pointer',
      },
      '.cm-wysiwyg-task-toggle[aria-checked="true"]': { backgroundColor: 'var(--primary-soft)', borderColor: 'var(--primary)' },
      '.cm-wysiwyg-frontmatter-toggle': {
        display: 'inline-block', border: '1px solid var(--border)', borderRadius: '6px',
        padding: '3px 9px', backgroundColor: 'var(--surface-muted)', color: 'var(--muted)',
        fontFamily: 'var(--font-body)', fontSize: '12px', cursor: 'pointer',
      },
    }),
  ]
}
