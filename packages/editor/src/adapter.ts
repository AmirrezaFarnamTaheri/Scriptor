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

const NON_ASCII_WORD_PATTERN = /[\p{L}\p{N}]/u

function isCjkCode(code: number): boolean {
  return (
    (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified Ideographs
    (code >= 0x3400 && code <= 0x4dbf) || // CJK Extension A
    (code >= 0x3040 && code <= 0x309f) || // Hiragana
    (code >= 0x30a0 && code <= 0x30ff) || // Katakana
    (code >= 0xac00 && code <= 0xd7af)    // Hangul Syllables
  )
}

function isWordChar(code: number, char: string): boolean {
  if (
    (code >= 0x41 && code <= 0x5a) || // A-Z
    (code >= 0x61 && code <= 0x7a) || // a-z
    (code >= 0x30 && code <= 0x39)    // 0-9
  ) {
    return true
  }
  if (code < 0x80) {
    return false
  }
  return NON_ASCII_WORD_PATTERN.test(char)
}

export function countWords(markdown: string): number {
  // Single-pass semantic prose word counter: strips Markdown structural tokens
  // (headings, blockquotes, list markers, task checkboxes, hr, table fences, code blocks)
  // and accurately counts Unicode words and CJK ideographs without intermediate token arrays.
  let count = 0
  const len = markdown.length
  let lineStart = true
  let inWord = false

  for (let i = 0; i < len; i++) {
    const code = markdown.charCodeAt(i)

    if (code === 0x0a || code === 0x0d) {
      lineStart = true
      inWord = false
      continue
    }

    if (lineStart) {
      if (code === 0x20 || code === 0x09) continue

      let nextNl = i
      while (nextNl < len && markdown.charCodeAt(nextNl) !== 0x0a && markdown.charCodeAt(nextNl) !== 0x0d) {
        nextNl++
      }
      const line = markdown.slice(i, nextNl)

      // Delimiter fences, horizontal rules, table separator rows
      if (
        /^`{3,}/.test(line) ||
        /^~{3,}/.test(line) ||
        /^[-*_]{3,}\s*$/.test(line) ||
        /^\|?[\s\-:|]+\|?$/.test(line)
      ) {
        i = nextNl - 1
        lineStart = true
        inWord = false
        continue
      }

      // Skip heading markers: #{1,6} followed by space
      const headingMatch = line.match(/^#{1,6}\s+/)
      if (headingMatch) {
        i += headingMatch[0].length - 1
        lineStart = false
        continue
      }

      // Skip blockquote markers: > followed by optional space
      const quoteMatch = line.match(/^(?:>\s*)+/)
      if (quoteMatch) {
        i += quoteMatch[0].length - 1
        lineStart = false
        continue
      }

      // Skip list & task markers: - [ ] or 1. [x] etc.
      const listMatch = line.match(/^(?:[-*+]|\d+[.)])\s+(?:\[[ xX/\\-]\]\s+)?/)
      if (listMatch) {
        i += listMatch[0].length - 1
        lineStart = false
        continue
      }

      lineStart = false
    }

    if (isCjkCode(code)) {
      count++
      inWord = false
    } else if (isWordChar(code, markdown[i]!)) {
      if (!inWord) {
        inWord = true
        count++
      }
    } else if ((code === 0x27 || code === 0x2d || code === 0x2019) && inWord) {
      const nextCode = i + 1 < len ? markdown.charCodeAt(i + 1) : 0
      const nextChar = i + 1 < len ? markdown[i + 1]! : ''
      if (!isWordChar(nextCode, nextChar)) {
        inWord = false
      }
    } else {
      inWord = false
    }
  }

  return count
}

export function countCharacters(markdown: string): number {
  return markdown.length
}
