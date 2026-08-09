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

export function countWords(markdown: string): number {
  return markdown.trim().length === 0 ? 0 : markdown.trim().split(/\s+/).length
}

export function countCharacters(markdown: string): number {
  return markdown.length
}
