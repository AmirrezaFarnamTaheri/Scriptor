import { RangeSet, StateField, type Text } from '@codemirror/state'
import { EditorView, GutterMarker, gutter } from '@codemirror/view'

import { analyzeFrontmatter } from './frontmatter.ts'

class FrontmatterWarningMarker extends GutterMarker {
  private message: string

  constructor(message: string) {
    super()
    this.message = message
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'cm-frontmatter-warning'
    span.textContent = '!'
    span.title = this.message
    span.setAttribute('aria-label', this.message)
    return span
  }
}

function buildFrontmatterMarkers(doc: Text): RangeSet<GutterMarker> {
  const analysis = analyzeFrontmatter(doc.toString())
  if (analysis.valid) {
    return RangeSet.empty
  }

  const message = analysis.error ?? 'Invalid frontmatter'
  const markers = analysis.warningLines
    .filter((line) => line >= 1 && line <= doc.lines)
    .map((line) => new FrontmatterWarningMarker(message).range(doc.line(line).from))

  return markers.length > 0 ? RangeSet.of(markers, true) : RangeSet.empty
}

const frontmatterWarningField = StateField.define<RangeSet<GutterMarker>>({
  create(state) {
    return buildFrontmatterMarkers(state.doc)
  },
  update(value, transaction) {
    if (transaction.docChanged) {
      return buildFrontmatterMarkers(transaction.state.doc)
    }
    return value
  },
})

export const frontmatterGutterExtension = [
  frontmatterWarningField,
  gutter({
    class: 'cm-frontmatter-gutter',
    markers: (view) => view.state.field(frontmatterWarningField),
  }),
  EditorView.baseTheme({
    '.cm-frontmatter-warning': {
      color: '#c47a00',
      fontWeight: '700',
      cursor: 'help',
    },
  }),
]
