import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, placeholder } from '@codemirror/view'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

import { autoPairExtension } from './auto-pair.ts'
import { scriptorMarkdownExtension } from './markdown/markdown-language.ts'
import { editorA11yExtension } from './a11y.ts'
import { distractionFreeExtension, setDistractionFreeClass } from './distraction-free.ts'
import { findReplaceExtension } from './find-replace.ts'
import { markdownLintExtension } from './markdown-lint.ts'
import { pasteHandlerExtension, setPasteImageHandler } from './paste-handler.ts'
import { typewriterExtension } from './typewriter.ts'
import {
  dispatchEditorAutocompleteContext,
  editorAutocompleteExtension,
  type EditorAutocompleteContext,
} from './editor-autocomplete.ts'
import { frontmatterGutterExtension } from './frontmatter-gutter.ts'
import {
  dispatchSnippetCatalog,
  dispatchSnippetContext,
  snippetAutocompleteExtension,
} from './snippet-autocomplete.ts'
import type { SnippetCatalogEntry } from './snippet-catalog.ts'
import { insertExpandedSnippet, looksLikeSnippetTemplate, snippetExtension } from './snippets.ts'
import { loadHunspellDictionary, spellcheckExtension } from './spellcheck.ts'
import { configureLanguageTool, languageToolLintExtension } from './language-tool-lint.ts'
import { tableContextMenuExtension } from './table-context-menu.ts'
import { tableEditorExtension } from './table-editor.ts'
import { generateToc, tocField, type TocEntry } from './toc-field.ts'
import { applyEditorTransform, type EditorTransformAction } from './transforms'
import { applyTypographyAction, type TypographyAction } from './typography-transforms.ts'
import {
  setVimModeCallbacks,
  setVimModeEnabled,
  vimModeCompartment,
  vimModeExtension,
} from './vim-mode.ts'
import { taskToggleClickExtension } from './task-toggle.ts'
import { wysiwygDecorationExtension } from './wysiwyg-decorations.ts'
import {
  editorThemeCompartment,
  editorThemeExtension,
  type EditorThemeId,
} from './editor-themes.ts'
import {
  countCharacters,
  countWords,
  type EditorAdapter,
  type EditorAdapterOptions,
  type EditorStats,
} from './adapter'
import type { SnippetVariableContext } from './snippet-parser.ts'

const spellcheckCompartment = new Compartment()
const languageToolCompartment = new Compartment()
const wysiwygCompartment = new Compartment()
const typewriterCompartment = new Compartment()
const lineNumbersCompartment = new Compartment()
const themeCompartment = editorThemeCompartment()

class CodeMirrorAdapter implements EditorAdapter {
  private view: EditorView
  private onVisibleLineChange?: (line: number) => void
  private scrollListener?: () => void
  private snippetContext: SnippetVariableContext

  constructor(host: HTMLElement, options: EditorAdapterOptions) {
    this.onVisibleLineChange = options.onVisibleLineChange
    this.snippetContext = options.snippetContext ?? {}
    setPasteImageHandler(options.saveImageFromClipboard ?? null)
    const extensions = [
      lineNumbersCompartment.of(options.showLineNumbers === false ? [] : lineNumbers()),
      tocField,
      editorA11yExtension(),
      ...frontmatterGutterExtension,
      ...tableEditorExtension(!options.readOnly),
      tableContextMenuExtension(),
      ...snippetExtension(),
      ...snippetAutocompleteExtension(options.snippetContext),
      editorAutocompleteExtension(),
      findReplaceExtension(),
      autoPairExtension(),
      pasteHandlerExtension(),
      markdownLintExtension(),
      taskToggleClickExtension(),
      history(),
      scriptorMarkdownExtension(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      vimModeCompartment.of(options.vimMode ? vimModeExtension() : []),
      themeCompartment.of(editorThemeExtension(options.editorTheme ?? 'light')),
      spellcheckCompartment.of(options.spellcheck ? spellcheckExtension() : []),
      wysiwygCompartment.of(options.wysiwyg ? wysiwygDecorationExtension() : []),
      typewriterCompartment.of(typewriterExtension(options.typewriter ?? false)),
      distractionFreeExtension(options.distractionFree ?? false),
      languageToolCompartment.of(options.languageTool ? languageToolLintExtension() : []),
      EditorView.lineWrapping,
      EditorView.theme({
        '&': {
          height: '100%',
          backgroundColor: 'transparent',
        },
        '.cm-scroller': {
          fontFamily: 'var(--editor-font-family, var(--mono))',
          fontSize: 'var(--editor-font-size, 14.5px)',
          lineHeight: 'var(--editor-line-height, 1.72)',
        },
        '.cm-content': {
          padding: 'var(--editor-padding, 14px 18px 64px)',
          caretColor: 'var(--primary)',
        },
        '.cm-gutters': {
          backgroundColor: 'transparent',
          borderRight: '1px solid var(--border)',
          color: 'var(--faint)',
        },
        '&.cm-focused .cm-cursor': {
          borderLeftColor: 'var(--primary)',
        },
        '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
          backgroundColor: 'var(--primary-soft) !important',
        },
      }),
      EditorState.readOnly.of(Boolean(options.readOnly)),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          options.onChange?.(update.state.doc.toString())
        }
      }),
    ]

    if (!options.initialValue) {
      extensions.push(placeholder('Start writing Markdown...'))
    }

    setVimModeCallbacks({
      onSave: options.onVimSave,
      onQuit: options.onVimQuit,
    })

    this.view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: options.initialValue ?? '',
        extensions,
      }),
    })

    if (options.autocompleteContext) {
      dispatchEditorAutocompleteContext(this.view, options.autocompleteContext)
    }

    if (this.onVisibleLineChange) {
      this.scrollListener = () => {
        const block = this.view.lineBlockAtHeight(this.view.scrollDOM.scrollTop)
        const line = this.view.state.doc.lineAt(block.from).number
        this.onVisibleLineChange?.(line)
      }
      this.view.scrollDOM.addEventListener('scroll', this.scrollListener, { passive: true })
    }

    if (options.snippetCatalog?.length) {
      dispatchSnippetCatalog(this.view, options.snippetCatalog)
    }
    dispatchSnippetContext(this.view, this.snippetContext)
  }

  setSnippetCatalog(entries: SnippetCatalogEntry[]): void {
    dispatchSnippetCatalog(this.view, entries)
  }

  setSnippetContext(context: SnippetVariableContext): void {
    this.snippetContext = context
    dispatchSnippetContext(this.view, context)
  }

  setAutocompleteContext(context: EditorAutocompleteContext): void {
    dispatchEditorAutocompleteContext(this.view, context)
  }

  setVimMode(enabled: boolean): void {
    setVimModeEnabled(this.view, enabled)
  }

  setSpellcheck(enabled: boolean): void {
    this.view.dispatch({
      effects: spellcheckCompartment.reconfigure(enabled ? spellcheckExtension() : []),
    })
  }

  setLanguageTool(enabled: boolean): void {
    configureLanguageTool({ enabled })
    this.view.dispatch({
      effects: languageToolCompartment.reconfigure(enabled ? languageToolLintExtension() : []),
    })
  }

  setWysiwyg(enabled: boolean): void {
    this.view.dispatch({
      effects: wysiwygCompartment.reconfigure(enabled ? wysiwygDecorationExtension() : []),
    })
  }

  setTypewriter(enabled: boolean): void {
    this.view.dispatch({
      effects: typewriterCompartment.reconfigure(typewriterExtension(enabled)),
    })
  }

  setShowLineNumbers(enabled: boolean): void {
    this.view.dispatch({
      effects: lineNumbersCompartment.reconfigure(enabled ? lineNumbers() : []),
    })
  }

  setEditorTheme(theme: EditorThemeId): void {
    this.view.dispatch({
      effects: themeCompartment.reconfigure(editorThemeExtension(theme)),
    })
  }

  getValue(): string {
    return this.view.state.doc.toString()
  }

  setValue(markdown: string): void {
    const current = this.getValue()
    if (current === markdown) return

    this.view.dispatch({
      changes: { from: 0, to: current.length, insert: markdown },
    })
  }

  focus(): void {
    this.view.focus()
  }

  scrollToLine(lineNumber: number, focus = true): void {
    const lineIndex = Math.max(1, Math.min(lineNumber, this.view.state.doc.lines))
    const line = this.view.state.doc.line(lineIndex)
    this.view.dispatch({
      selection: focus ? { anchor: line.from } : undefined,
      effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
    })
    if (focus) {
      this.view.focus()
    }
  }

  getTopVisibleLine(): number {
    const block = this.view.lineBlockAtHeight(this.view.scrollDOM.scrollTop)
    return this.view.state.doc.lineAt(block.from).number
  }

  getScrollElement(): HTMLElement {
    return this.view.scrollDOM
  }

  getToc(): TocEntry[] {
    return generateToc(this.view.state)
  }

  insertSnippet(text: string): void {
    const range = this.view.state.selection.main
    if (looksLikeSnippetTemplate(text)) {
      insertExpandedSnippet(this.view, text, range.from, range.to, this.snippetContext)
      this.view.focus()
      return
    }

    this.view.dispatch({
      changes: { from: range.from, to: range.to, insert: text },
      selection: { anchor: range.from + text.length },
    })
    this.view.focus()
  }

  applyTransform(action: EditorTransformAction): void {
    applyEditorTransform(this.view, action)
  }

  applyTypography(action: TypographyAction): void {
    applyTypographyAction(this.view, action)
  }

  getStats(): EditorStats {
    const value = this.getValue()
    return {
      words: countWords(value),
      characters: countCharacters(value),
    }
  }

  destroy(): void {
    if (this.scrollListener) {
      this.view.scrollDOM.removeEventListener('scroll', this.scrollListener)
    }
    this.view.destroy()
  }
}

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
  setEditorTheme(theme: EditorThemeId): void
}

export interface MarkdownEditorProps {
  value: string
  onChange: (markdown: string) => void
  className?: string
  readOnly?: boolean
  scrollToLine?: number | null
  insertRequest?: { seq: number; text: string } | null
  transformRequest?: { seq: number; action: EditorTransformAction } | null
  typographyRequest?: { seq: number; action: TypographyAction } | null
  onVisibleLineChange?: (line: number) => void
  scrollSyncEnabled?: boolean
  snippetContext?: SnippetVariableContext
  snippetCatalog?: SnippetCatalogEntry[]
  autocompleteContext?: EditorAutocompleteContext
  saveImageFromClipboard?: (file: File) => Promise<string | null>
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
}

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(function MarkdownEditor(
  {
    value,
    onChange,
    className,
    readOnly,
    scrollToLine,
    insertRequest,
    transformRequest,
    typographyRequest,
    onVisibleLineChange,
    scrollSyncEnabled = false,
    snippetContext,
    snippetCatalog,
    autocompleteContext,
    vimMode = false,
    spellcheck = false,
    languageTool = false,
    wysiwyg = false,
    typewriter = false,
    distractionFree = false,
    showLineNumbers = true,
    editorTheme = 'light',
    onVimSave,
    onVimQuit,
    saveImageFromClipboard,
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null)
  const adapterRef = useRef<CodeMirrorAdapter | null>(null)

  const onChangeRef = useRef(onChange)
  const onVisibleLineChangeRef = useRef(onVisibleLineChange)
  const onVimSaveRef = useRef(onVimSave)
  const onVimQuitRef = useRef(onVimQuit)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    onVisibleLineChangeRef.current = onVisibleLineChange
  }, [onVisibleLineChange])

  useEffect(() => {
    onVimSaveRef.current = onVimSave
    onVimQuitRef.current = onVimQuit
    setVimModeCallbacks({
      onSave: () => onVimSaveRef.current?.(),
      onQuit: () => onVimQuitRef.current?.(),
    })
  }, [onVimSave, onVimQuit])

  useImperativeHandle(ref, () => ({
    scrollToLine: (line, focus) => adapterRef.current?.scrollToLine(line, focus),
    getTopVisibleLine: () => adapterRef.current?.getTopVisibleLine() ?? 1,
    getScrollElement: () => adapterRef.current?.getScrollElement() ?? null,
    getToc: () => adapterRef.current?.getToc() ?? [],
    setVimMode: (enabled) => adapterRef.current?.setVimMode(enabled),
    setSpellcheck: (enabled) => adapterRef.current?.setSpellcheck(enabled),
    setLanguageTool: (enabled) => adapterRef.current?.setLanguageTool(enabled),
    setWysiwyg: (enabled) => adapterRef.current?.setWysiwyg(enabled),
    setTypewriter: (enabled) => adapterRef.current?.setTypewriter(enabled),
    setEditorTheme: (theme) => adapterRef.current?.setEditorTheme(theme),
  }))

  useEffect(() => {
    if (!hostRef.current) return

    const adapter = new CodeMirrorAdapter(hostRef.current, {
      initialValue: value,
      onChange: (markdown) => onChangeRef.current(markdown),
      readOnly,
      onVisibleLineChange: scrollSyncEnabled
        ? (line) => onVisibleLineChangeRef.current?.(line)
        : undefined,
      snippetContext,
      snippetCatalog,
      autocompleteContext,
      vimMode,
      spellcheck,
      languageTool,
      wysiwyg,
      typewriter,
      distractionFree,
      showLineNumbers,
      editorTheme,
      onVimSave: () => onVimSaveRef.current?.(),
      onVimQuit: () => onVimQuitRef.current?.(),
      saveImageFromClipboard,
    })
    adapterRef.current = adapter

    return () => {
      adapter.destroy()
      adapterRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, scrollSyncEnabled])

  useEffect(() => {
    setPasteImageHandler(saveImageFromClipboard ?? null)
  }, [saveImageFromClipboard])

  useEffect(() => {
    adapterRef.current?.setValue(value)
  }, [value])

  useEffect(() => {
    if (scrollToLine && scrollToLine > 0) {
      adapterRef.current?.scrollToLine(scrollToLine)
    }
  }, [scrollToLine])

  useEffect(() => {
    if (insertRequest?.text) {
      adapterRef.current?.insertSnippet(insertRequest.text)
    }
  }, [insertRequest])

  useEffect(() => {
    adapterRef.current?.setSnippetCatalog(snippetCatalog ?? [])
  }, [snippetCatalog])

  useEffect(() => {
    if (snippetContext) {
      adapterRef.current?.setSnippetContext(snippetContext)
    }
  }, [snippetContext])

  useEffect(() => {
    if (autocompleteContext) {
      adapterRef.current?.setAutocompleteContext(autocompleteContext)
    }
  }, [autocompleteContext])

  useEffect(() => {
    adapterRef.current?.setVimMode(vimMode)
  }, [vimMode])

  useEffect(() => {
    adapterRef.current?.setSpellcheck(spellcheck)
  }, [spellcheck])

  useEffect(() => {
    adapterRef.current?.setLanguageTool(languageTool)
  }, [languageTool])

  useEffect(() => {
    adapterRef.current?.setWysiwyg(wysiwyg)
  }, [wysiwyg])

  useEffect(() => {
    adapterRef.current?.setTypewriter(typewriter)
  }, [typewriter])

  useEffect(() => {
    adapterRef.current?.setShowLineNumbers(showLineNumbers)
  }, [showLineNumbers])

  useEffect(() => {
    setDistractionFreeClass(distractionFree)
    return () => setDistractionFreeClass(false)
  }, [distractionFree])

  useEffect(() => {
    adapterRef.current?.setEditorTheme(editorTheme)
  }, [editorTheme])

  useEffect(() => {
    if (spellcheck) {
      void loadHunspellDictionary()
    }
  }, [spellcheck])

  useEffect(() => {
    if (transformRequest?.action) {
      adapterRef.current?.applyTransform(transformRequest.action)
    }
  }, [transformRequest])

  useEffect(() => {
    if (typographyRequest?.action) {
      adapterRef.current?.applyTypography(typographyRequest.action)
    }
  }, [typographyRequest])

  return <div className={className} ref={hostRef} />
})

export type { TocEntry } from './toc-field.ts'
