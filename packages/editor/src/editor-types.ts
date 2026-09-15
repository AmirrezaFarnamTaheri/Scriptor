import type { TocEntry } from './pure/toc.ts'
import type { TypographyAction } from './typography-actions.ts'

export type EditorTransformAction =
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'blockquote'
  | 'code'
  | 'link'
  | 'table'
  | 'table-add-row'
  | 'table-add-col'
  | 'move-section-up'
  | 'move-section-down'
  | 'footnote'

export type EditorThemeId = 'light' | 'dark'

export interface MarkdownEditorHandle {
  scrollToLine(line: number, focus?: boolean): void
  getTopVisibleLine(): number
  getScrollElement(): HTMLElement | null
  getToc(): TocEntry[]
  setVimMode(enabled: boolean): void
  setSpellcheck(enabled: boolean): void
  setLanguageTool(enabled: boolean): void
  setWysiwyg(enabled: boolean): void
  setTypewriter(enabled: boolean): void
  setFocusDim(enabled: boolean): void
  setEditorTheme(theme: EditorThemeId): void
  applyTransform(action: EditorTransformAction): void
  applyTypography(action: TypographyAction): void
  insertSnippet(text: string): void
}
