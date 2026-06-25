import {
  findNext,
  findPrevious,
  openSearchPanel,
  replaceAll,
  replaceNext,
  search,
  searchKeymap,
} from '@codemirror/search'
import type { Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'

export function openFindPanel(view: EditorView): void {
  openSearchPanel(view)
}

function openReplacePanel(view: EditorView): boolean {
  openSearchPanel(view)
  requestAnimationFrame(() => {
    const replaceField = view.dom.querySelector(
      '.cm-search input[name="replace"]',
    ) as HTMLInputElement | null
    replaceField?.focus()
    replaceField?.select()
  })
  return true
}

export function findReplaceExtension(): Extension {
  return [
    search({ top: true }),
    keymap.of([
      ...searchKeymap,
      { key: 'Mod-h', run: openReplacePanel, scope: 'editor search-panel' },
    ]),
    EditorView.baseTheme({
      '.cm-search': {
        padding: '6px 8px',
        backgroundColor: 'var(--surface, #f8f8f8)',
        borderBottom: '1px solid var(--border, #ddd)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '6px',
      },
      '.cm-search .cm-textfield': {
        font: 'inherit',
        padding: '2px 6px',
        border: '1px solid var(--border, #ccc)',
        borderRadius: '4px',
        backgroundColor: 'var(--background, #fff)',
      },
      '.cm-search .cm-button': {
        font: 'inherit',
        padding: '2px 8px',
        border: '1px solid var(--border, #ccc)',
        borderRadius: '4px',
        backgroundColor: 'var(--background, #fff)',
        cursor: 'pointer',
      },
      '.cm-searchMatch': {
        backgroundColor: 'var(--primary-soft, #ffe06666)',
      },
      '.cm-searchMatch.cm-searchMatch-selected': {
        backgroundColor: 'var(--primary, #ffcc00)',
      },
    }),
  ]
}

export { findNext, findPrevious, replaceNext, replaceAll }
