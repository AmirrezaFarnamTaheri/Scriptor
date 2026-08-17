import type { Extension } from '@codemirror/state'
import { StateField, StateEffect, RangeSetBuilder } from '@codemirror/state'
import { EditorView, ViewPlugin, Decoration, type DecorationSet } from '@codemirror/view'

// ---------------------------------------------------------------------------
// Typewriter (vertical centering) extension
// ---------------------------------------------------------------------------

/** Centers the active line vertically (typewriter mode). */
export function typewriterExtension(enabled: boolean): Extension {
  if (!enabled) return []
  return ViewPlugin.fromClass(
    class {
      private padding = '0px'
      private view: EditorView

      constructor(view: EditorView) {
        this.view = view
        this.applyPadding()
        this.centerSelection()
      }

      update(update: { docChanged: boolean; selectionSet: boolean; view: EditorView }) {
        if (update.docChanged || update.selectionSet) {
          this.applyPadding()
          if (update.selectionSet) {
            this.centerSelection()
          }
        }
      }

      destroy() {
        this.view.scrollDOM.style.paddingTop = ''
        this.view.scrollDOM.style.paddingBottom = ''
      }

      private applyPadding() {
        const half = Math.max(0, this.view.dom.clientHeight / 2 - 24)
        const margin = `${half}px`
        if (this.padding !== margin) {
          this.padding = margin
          this.view.scrollDOM.style.paddingTop = margin
          this.view.scrollDOM.style.paddingBottom = margin
        }
      }

      private centerSelection() {
        const head = this.view.state.selection.main.head
        this.view.dispatch({
          effects: EditorView.scrollIntoView(head, { y: 'center' }),
        })
      }
    },
  )
}

// ---------------------------------------------------------------------------
// Focus / Sentence dim extension
// ---------------------------------------------------------------------------

/** Mark that dim decorations should be invalidated. */
const dimUpdateEffect = StateEffect.define<null>()

const dimmedMark = Decoration.mark({ class: 'cm-focus-dimmed' })
const activeMark = Decoration.mark({ class: 'cm-focus-active' })

/**
 * Finds the sentence or paragraph boundary around a cursor position.
 * Returns [start, end] character offsets.
 */
function sentenceBounds(doc: { sliceString: (from: number, to?: number) => string; length: number }, pos: number): [number, number] {
  const text = doc.sliceString(0)

  // Sentence end characters — period, exclamation, question mark followed by space/newline
  const sentenceEndRe = /[.!?][\s\n"')\]]*[\s\n]/g

  let start = 0
  let end = text.length
  let m: RegExpExecArray | null

  // Find the sentence that contains `pos`
  sentenceEndRe.lastIndex = 0
  let prevEnd = 0
  while ((m = sentenceEndRe.exec(text)) !== null) {
    const matchEnd = m.index + m[0].length
    if (matchEnd > pos) {
      // The current sentence goes from prevEnd to matchEnd
      start = prevEnd
      end = matchEnd
      break
    }
    prevEnd = matchEnd
  }

  // Trim leading whitespace from start
  while (start < end && /\s/.test(text[start] ?? '')) start++

  return [start, end]
}

/**
 * StateField that computes dim decorations for all text outside the active sentence.
 */
const focusDimField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },

  update(decos, tr) {
    if (!tr.docChanged && !tr.selection && !tr.effects.some((e) => e.is(dimUpdateEffect))) {
      return decos
    }

    const pos = tr.state.selection.main.head
    const doc = tr.state.doc
    const [sentStart, sentEnd] = sentenceBounds(
      {
        sliceString: (from, to) => doc.sliceString(from, to),
        length: doc.length,
      },
      pos,
    )

    const builder = new RangeSetBuilder<Decoration>()
    if (sentStart > 0) {
      builder.add(0, sentStart, dimmedMark)
    }
    if (sentStart < sentEnd) {
      builder.add(sentStart, sentEnd, activeMark)
    }
    if (sentEnd < doc.length) {
      builder.add(sentEnd, doc.length, dimmedMark)
    }

    return builder.finish()
  },

  provide: (f) => EditorView.decorations.from(f),
})

const focusDimTheme = EditorView.baseTheme({
  '.cm-focus-dimmed': {
    opacity: '0.35',
    transition: 'opacity 120ms ease',
  },
  '.cm-focus-active': {
    opacity: '1',
  },
})

/**
 * Focus mode extension: dims all text except the sentence containing the cursor.
 * Combine with `typewriterExtension` for the full focus experience.
 */
export function focusDimExtension(enabled: boolean): Extension {
  if (!enabled) return []
  return [focusDimField, focusDimTheme]
}
