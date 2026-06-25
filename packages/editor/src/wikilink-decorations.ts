import { RangeSetBuilder, type Extension } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin } from '@codemirror/view'

const wikilinkMark = Decoration.mark({ class: 'cm-wikilink' })
const wikilinkEmbedMark = Decoration.mark({ class: 'cm-wikilink-embed' })

const WIKILINK = /\[\[[^\]|]+\]\]/g
const WIKILINK_EMBED = /!\[\[[^\]|]+\]\]/g

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

  for (const match of doc.matchAll(WIKILINK_EMBED)) {
    const from = match.index ?? 0
    const to = from + match[0].length
    builder.add(from, to, wikilinkEmbedMark)
  }

  for (const match of doc.matchAll(WIKILINK)) {
    const from = match.index ?? 0
    const to = from + match[0].length
    if (doc.slice(Math.max(0, from - 1), from) === '!') continue
    builder.add(from, to, wikilinkMark)
  }

  return builder.finish()
}
