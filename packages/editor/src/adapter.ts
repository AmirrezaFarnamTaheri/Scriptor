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
    (code >= 0x20000 && code <= 0x2a6df) || // CJK Extension B
    (code >= 0x2a700 && code <= 0x2b73f) || // CJK Extension C
    (code >= 0x2b740 && code <= 0x2b81f) || // CJK Extension D
    (code >= 0x2b820 && code <= 0x2ceaf) || // CJK Extension E
    (code >= 0x2ceb0 && code <= 0x2ebef) || // CJK Extension F/G/H/I
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

function frontmatterEndOffset(markdown: string): number {
  const len = markdown.length
  const start = markdown.charCodeAt(0) === 0xfeff ? 1 : 0
  let firstEnd = start
  while (firstEnd < len && markdown.charCodeAt(firstEnd) !== 0x0a && markdown.charCodeAt(firstEnd) !== 0x0d) {
    firstEnd++
  }
  if (markdown.slice(start, firstEnd).trim() !== '---') return 0

  let cursor = firstEnd
  while (cursor < len && (markdown.charCodeAt(cursor) === 0x0a || markdown.charCodeAt(cursor) === 0x0d)) cursor++
  while (cursor < len) {
    let lineEnd = cursor
    while (lineEnd < len && markdown.charCodeAt(lineEnd) !== 0x0a && markdown.charCodeAt(lineEnd) !== 0x0d) {
      lineEnd++
    }
    const marker = markdown.slice(cursor, lineEnd).trim()
    if (marker === '---' || marker === '...') {
      let after = lineEnd
      while (after < len && (markdown.charCodeAt(after) === 0x0a || markdown.charCodeAt(after) === 0x0d)) after++
      return after
    }
    cursor = lineEnd
    while (cursor < len && (markdown.charCodeAt(cursor) === 0x0a || markdown.charCodeAt(cursor) === 0x0d)) cursor++
  }

  // An unmatched opening `---` is just Markdown content/horizontal-rule syntax,
  // not frontmatter. Do not silently discard the remainder of the document.
  return 0
}

export function countWords(markdown: string): number {
  // Single-pass semantic prose word counter: strips Markdown structural tokens
  // (frontmatter, headings, blockquotes, list markers, task checkboxes, hr,
  // table fences, fenced code blocks) and counts Unicode words/CJK code points
  // without allocating intermediate token arrays.
  let count = 0
  const len = markdown.length
  let lineStart = true
  let inWord = false
  let inFence = false
  let fenceChar = ''
  let fenceLen = 0

  let i = frontmatterEndOffset(markdown)
  while (i < len) {
    const code = markdown.charCodeAt(i)

    if (code === 0x0a || code === 0x0d) {
      lineStart = true
      inWord = false
      i++
      continue
    }

    if (lineStart) {
      if (code === 0x20 || code === 0x09) {
        i++
        continue
      }

      let nextNl = i
      while (nextNl < len && markdown.charCodeAt(nextNl) !== 0x0a && markdown.charCodeAt(nextNl) !== 0x0d) {
        nextNl++
      }
      const line = markdown.slice(i, nextNl)

      if (inFence) {
        const closeMatch = line.match(/^(\s*)(`{3,}|~{3,})\s*$/)
        if (closeMatch && closeMatch[2]!.charAt(0) === fenceChar && closeMatch[2]!.length >= fenceLen) {
          inFence = false
          fenceChar = ''
          fenceLen = 0
        }
        i = nextNl
        lineStart = true
        inWord = false
        continue
      }

      const openFenceMatch = line.match(/^(\s*)(`{3,}|~{3,})/)
      if (openFenceMatch) {
        inFence = true
        fenceChar = openFenceMatch[2]!.charAt(0)
        fenceLen = openFenceMatch[2]!.length
        i = nextNl
        lineStart = true
        inWord = false
        continue
      }

      // Delimiter fences, horizontal rules, table separator rows
      if (
        /^[-*_]{3,}\s*$/.test(line) ||
        /^\|?[\s\-:|]+\|?$/.test(line)
      ) {
        i = nextNl
        lineStart = true
        inWord = false
        continue
      }

      // Skip blockquote markers: > followed by optional space. Keep lineStart
      // true so a nested list/task marker is handled on the same logical line.
      const quoteMatch = line.match(/^(?:>\s*)+/)
      if (quoteMatch) {
        i += quoteMatch[0].length
        lineStart = true
        continue
      }

      // Skip heading markers: #{1,6} followed by space
      const headingMatch = line.match(/^#{1,6}\s+/)
      if (headingMatch) {
        i += headingMatch[0].length
        lineStart = false
        continue
      }

      // Skip list & task markers: - [ ] or 1. [x] etc.
      const listMatch = line.match(/^(?:[-*+]|\d+[.)])\s+(?:\[[ xX/\\-]\]\s+)?/)
      if (listMatch) {
        i += listMatch[0].length
        lineStart = false
        continue
      }

      lineStart = false
    }

    if (inFence) {
      i++
      continue
    }

    const codePoint = markdown.codePointAt(i)!
    const charLen = codePoint > 0xffff ? 2 : 1
    const char = markdown.slice(i, i + charLen)

    if (isCjkCode(codePoint)) {
      count++
      inWord = false
    } else if (isWordChar(codePoint, char)) {
      if (!inWord) {
        inWord = true
        count++
      }
    } else if ((codePoint === 0x27 || codePoint === 0x2d || codePoint === 0x2019) && inWord) {
      const nextIdx = i + charLen
      if (nextIdx < len) {
        const nextCodePoint = markdown.codePointAt(nextIdx)!
        const nextCharLen = nextCodePoint > 0xffff ? 2 : 1
        const nextChar = markdown.slice(nextIdx, nextIdx + nextCharLen)
        if (!isWordChar(nextCodePoint, nextChar)) {
          inWord = false
        }
      } else {
        inWord = false
      }
    } else {
      inWord = false
    }

    i += charLen
  }

  return count
}

export function countCharacters(markdown: string): number {
  return markdown.length
}
