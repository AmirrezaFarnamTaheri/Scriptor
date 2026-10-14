import { syntaxTree } from '@codemirror/language'
import type { Range } from '@codemirror/state'
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
  constructor(readonly checked: boolean, readonly markerFrom: number) { super() }
  eq(other: TaskCheckboxWidget) { return other.checked === this.checked && other.markerFrom === this.markerFrom }
  toDOM(view: EditorView) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'cm-wysiwyg-task-toggle'
    button.setAttribute('role', 'checkbox')
    button.setAttribute('aria-checked', String(this.checked))
    button.setAttribute('aria-label', this.checked ? 'Mark task incomplete' : 'Mark task complete')
    button.textContent = this.checked ? '✓' : ''
    button.addEventListener('mousedown', event => event.preventDefault())
    button.addEventListener('click', event => {
      event.preventDefault()
      event.stopPropagation()
      const marker = view.state.doc.sliceString(this.markerFrom, this.markerFrom + 3)
      if (marker !== '[ ]' && marker.toLowerCase() !== '[x]') return
      view.dispatch({ changes: { from: this.markerFrom + 1, to: this.markerFrom + 2, insert: marker === '[ ]' ? 'x' : ' ' } })
    })
    return button
  }
}

class FrontmatterWidget extends WidgetType {
  constructor(readonly from: number) { super() }
  eq(other: FrontmatterWidget) { return other.from === this.from }
  toDOM(view: EditorView) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'cm-wysiwyg-frontmatter-toggle'
    button.textContent = 'Properties'
    button.setAttribute('aria-label', 'Show note properties')
    button.addEventListener('mousedown', event => event.preventDefault())
    button.addEventListener('click', event => {
      event.preventDefault()
      view.dispatch({selection:{anchor:this.from},scrollIntoView:true})
      view.focus()
    })
    return button
  }
}

function buildDecorations(view: EditorView): DecorationSet {
  const ranges: Range<Decoration>[] = []
  const activeLine = view.state.doc.lineAt(view.state.selection.main.head).number
  // Metadata is not prose. Collapse a complete YAML frontmatter block except
  // while the author is editing it. The source document remains unchanged.
  let collapsedFrontmatterEnd = -1
  if (view.state.doc.lines >= 3 && view.state.doc.line(1).text.replace(/^\uFEFF/, '').trim() === '---') {
    let close = 0
    for (let number = 2; number <= Math.min(view.state.doc.lines, 256); number++) {
      if (/^(---|\.\.\.)\s*$/.test(view.state.doc.line(number).text)) { close = number; break }
    }
    if (close > 0 && !(view.hasFocus && activeLine <= close)) {
      const first = view.state.doc.line(1)
      const last = view.state.doc.line(close)
      collapsedFrontmatterEnd = last.to
      ranges.push(Decoration.replace({block:true,widget:new FrontmatterWidget(first.from)}).range(first.from,last.to))
    }
  }
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        if (node.from < collapsedFrontmatterEnd) return false
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
