import type { Extension } from '@codemirror/state'
import { EditorView, ViewPlugin } from '@codemirror/view'

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
