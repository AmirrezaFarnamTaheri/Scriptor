import { syntaxTree } from '@codemirror/language'
import type { Range } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import type { Extension } from '@codemirror/state'

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

const taskLinePattern = /^(\s*[-*+] +\[[ xX]\] )/

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
    }),
  ]
}
