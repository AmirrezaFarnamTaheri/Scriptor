import { RangeSetBuilder, type Extension } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin } from '@codemirror/view'

const wikilinkMark = Decoration.mark({ class: 'cm-wikilink' })
const wikilinkEmbedMark = Decoration.mark({ class: 'cm-wikilink-embed' })

// Emit both link types in a single document-order pass. RangeSetBuilder
// requires monotonically increasing offsets; two separate regex scans pushed
// all embeds before ordinary wikilinks and crashed on mixed documents.
const WIKILINK_TOKEN = /!?\[\[[^\]|]+\]\]/g

/** Highlight `[[wikilinks]]` and `![[embeds]]` in the editor surface. */
export function wikilinkDecorationExtension(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations = Decoration.none

      constructor(view: EditorView) {
        this.decorations = buildWikilinkDecorations(view)
      }

      update(update: { docChanged: boolean; viewportChanged: boolean; view: EditorView }) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildWikilinkDecorations(update.view)
        }
      }
    },
    { decorations: (plugin) => plugin.decorations },
  )
}

function buildWikilinkDecorations(view: EditorView) {
  const builder = new RangeSetBuilder<Decoration>()
  const doc = view.state.doc.toString()

  for (const match of doc.matchAll(WIKILINK_TOKEN)) {
    const from = match.index ?? 0
    const to = from + match[0].length
    builder.add(from, to, match[0].startsWith('!') ? wikilinkEmbedMark : wikilinkMark)
  }

  return builder.finish()
}
