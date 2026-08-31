import type { SnippetCatalogEntry } from './snippet-catalog.ts'
import type { SnippetVariableContext } from './snippet-parser.ts'
import type { EditorAutocompleteContext } from './editor-autocomplete.ts'
import type { EditorThemeId } from './editor-themes.ts'
import type { ProseCorpus } from './prose-autosuggest.ts'
import type { WikilinkPreviewResolver } from './wikilink-hover-tooltip.ts'

export interface EditorStats {
  words: number
  characters: number
}

export interface EditorAdapter {
  getValue(): string
  setValue(markdown: string): void
  focus(): void
  insertSnippet(text: string): void
  getStats(): EditorStats
  destroy(): void
  setProseCorpus?(corpus: ProseCorpus): void
  setFocusDim?(enabled: boolean): void
  /** Re-exports type so consumers can import from `@scriptor/editor`. */
  setWikilinkPreviewResolver?(resolver: WikilinkPreviewResolver | null): void
}

export interface EditorAdapterOptions {
  initialValue?: string
  onChange?: (markdown: string) => void
  readOnly?: boolean
  onVisibleLineChange?: (line: number) => void
  snippetContext?: SnippetVariableContext
  snippetCatalog?: SnippetCatalogEntry[]
  autocompleteContext?: EditorAutocompleteContext
  vimMode?: boolean
  spellcheck?: boolean
  languageTool?: boolean
  wysiwyg?: boolean
  typewriter?: boolean
  focusDim?: boolean
  distractionFree?: boolean
  showLineNumbers?: boolean
  editorTheme?: EditorThemeId
  onVimSave?: () => void | Promise<void>
  onVimQuit?: () => void | Promise<void>
  saveImageFromClipboard?: (file: File) => Promise<string | null>
  /** Async resolver for [[wikilink]] hover tooltips. */
  wikilinkPreviewResolver?: WikilinkPreviewResolver
}

/**
 * The exact JS `\s` character set (WhiteSpace ∪ LineTerminator). Keeping
 * this in sync with the regex class lets word counting run as a single
 * allocation-free pass instead of materializing a word array per keystroke.
 */
function isWhitespaceCode(code: number): boolean {
  return (
    code === 0x20 ||
    code === 0x09 ||
    code === 0x0a ||
    code === 0x0b ||
    code === 0x0c ||
    code === 0x0d ||
    code === 0xa0 ||
    code === 0x1680 ||
    (code >= 0x2000 && code <= 0x200a) ||
    code === 0x2028 ||
    code === 0x2029 ||
    code === 0x202f ||
    code === 0x205f ||
    code === 0x3000 ||
    code === 0xfeff
  )
}

export function countWords(markdown: string): number {
  // Runs once per keystroke on the typing path (live draft stats): no trim
  // copy, no word array — a single pass counting maximal non-whitespace
  // runs, exactly matching a `split(/\s+/)` reference.
  let count = 0
  let inWord = false
  for (let index = 0; index < markdown.length; index++) {
    if (isWhitespaceCode(markdown.charCodeAt(index))) {
      inWord = false
    } else if (!inWord) {
      inWord = true
      count++
    }
  }
  return count
}

export function countCharacters(markdown: string): number {
  return markdown.length
}
