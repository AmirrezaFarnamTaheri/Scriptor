import type { SnippetCatalogEntry } from './snippet-catalog.ts'
import type { SnippetVariableContext } from './snippet-parser.ts'
import type { EditorAutocompleteContext } from './editor-autocomplete.ts'
import type { EditorThemeId } from './editor-themes.ts'

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
  distractionFree?: boolean
  showLineNumbers?: boolean
  editorTheme?: EditorThemeId
  onVimSave?: () => void | Promise<void>
  onVimQuit?: () => void | Promise<void>
  saveImageFromClipboard?: (file: File) => Promise<string | null>
}

export function countWords(markdown: string): number {
  return markdown.trim().length === 0 ? 0 : markdown.trim().split(/\s+/).length
}

export function countCharacters(markdown: string): number {
  return markdown.length
}
