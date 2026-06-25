import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import type { Extension } from '@codemirror/state'

const headingMark = Decoration.mark({ class: 'cm-wysiwyg-heading' })
const strongMark = Decoration.mark({ class: 'cm-wysiwyg-strong' })
const emphasisMark = Decoration.mark({ class: 'cm-wysiwyg-emphasis' })
const linkMark = Decoration.mark({ class: 'cm-wysiwyg-link' })
const inlineCodeMark = Decoration.mark({ class: 'cm-wysiwyg-inline-code' })
const blockquoteMark = Decoration.mark({ class: 'cm-wysiwyg-blockquote' })
const taskListMark = Decoration.mark({ class: 'cm-wysiwyg-task' })

const taskLinePattern = /^(\s*[-*+] +\[[ xX]\] )/

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        if (node.name.startsWith('ATXHeading')) {
          builder.add(node.from, node.to, headingMark)
        } else if (node.name === 'StrongEmphasis') {
          builder.add(node.from, node.to, strongMark)
        } else if (node.name === 'Emphasis') {
          builder.add(node.from, node.to, emphasisMark)
        } else if (node.name === 'Link' || node.name === 'URL') {
          builder.add(node.from, node.to, linkMark)
        } else if (node.name === 'InlineCode') {
          builder.add(node.from, node.to, inlineCodeMark)
        } else if (node.name === 'Blockquote') {
          builder.add(node.from, node.to, blockquoteMark)
        } else if (node.name === 'ListItem') {
          const line = view.state.doc.lineAt(node.from)
          if (taskLinePattern.test(line.text)) {
            builder.add(node.from, node.to, taskListMark)
          }
        }
      },
    })
  }
  return builder.finish()
}

const wysiwygPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
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
      '.cm-wysiwyg-heading': { fontWeight: '700', fontSize: '1.15em' },
      '.cm-wysiwyg-strong': { fontWeight: '700' },
      '.cm-wysiwyg-emphasis': { fontStyle: 'italic' },
      '.cm-wysiwyg-link': { color: 'var(--primary, #2563eb)', textDecoration: 'underline' },
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
