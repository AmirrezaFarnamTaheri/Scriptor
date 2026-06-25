import { EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'

/** Hide chrome via document class when distraction-free mode is enabled. */
export function distractionFreeExtension(enabled: boolean): Extension {
  if (!enabled) return []
  return EditorView.theme({
    '&': { maxWidth: '72ch', margin: '0 auto' },
    '.cm-content': { paddingTop: '48px', paddingBottom: '48px' },
  })
}

export function setDistractionFreeClass(enabled: boolean): void {
  document.documentElement.classList.toggle('scriptor-distraction-free', enabled)
}
