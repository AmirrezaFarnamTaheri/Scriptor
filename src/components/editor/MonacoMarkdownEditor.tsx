import Editor, { type BeforeMount, type OnMount } from '@monaco-editor/react'
import type { editor as MonacoEditor, IRange } from 'monaco-editor'
import {
  addTableColumn,
  addTableRow,
  applyTableMutation,
  applyTypographyToText,
  generateTocFromMarkdown,
  insertFootnoteIntoMarkdown,
  moveSectionLines,
  setDistractionFreeClass,
  type EditorTransformAction,
  type MarkdownEditorHandle,
  type TypographyAction,
} from '@scriptor/editor/pure'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react'

import {
  registerMarkdownCompletions,
  setMonacoCompletionContext,
  type MonacoCompletionContext,
} from '../../lib/monaco-completions'
import { monacoThemeForEditor, registerScriptorMonacoThemes } from '../../lib/monaco-themes'

export interface MonacoMarkdownEditorProps {
  notePath: string
  value: string
  onChange: (value: string) => void
  className?: string
  readOnly?: boolean
  editorTheme?: 'light' | 'dark'
  typewriter?: boolean
  distractionFree?: boolean
  showLineNumbers?: boolean
  insertRequest?: { seq: number; text: string } | null
  transformRequest?: { seq: number; action: string } | null
  typographyRequest?: { seq: number; action: TypographyAction } | null
  scrollToLine?: number | null
  completionContext?: MonacoCompletionContext
}

export const MonacoMarkdownEditor = forwardRef<MarkdownEditorHandle, MonacoMarkdownEditorProps>(
  function MonacoMarkdownEditor(
    {
      notePath,
      value,
      onChange,
      className,
      readOnly,
      editorTheme = 'dark',
      typewriter = false,
      distractionFree = false,
      showLineNumbers = true,
      insertRequest,
      transformRequest,
      typographyRequest,
      scrollToLine,
      completionContext,
    },
    ref,
  ) {
    const hostRef = useRef<HTMLDivElement | null>(null)
    const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null)
    const modelRef = useRef<MonacoEditor.ITextModel | null>(null)
    const monacoRef = useRef<typeof import('monaco-editor') | null>(null)
    const completionDisposableRef = useRef<{ dispose: () => void } | null>(null)
    const latest = useRef(value)
    const onChangeRef = useRef(onChange)
    const lastSyncedValueRef = useRef(value)
    const lastInsertSeqRef = useRef<number | null>(null)
    const lastTransformSeqRef = useRef<number | null>(null)
    const lastTypographySeqRef = useRef<number | null>(null)
    const insertRequestRef = useRef(insertRequest)
    const transformRequestRef = useRef(transformRequest)
    const typographyRequestRef = useRef(typographyRequest)

    useEffect(() => {
      insertRequestRef.current = insertRequest
      transformRequestRef.current = transformRequest
      typographyRequestRef.current = typographyRequest
    }, [insertRequest, transformRequest, typographyRequest])

    useEffect(() => {
      onChangeRef.current = onChange
    }, [onChange])

    useEffect(() => {
      setMonacoCompletionContext(completionContext ?? {})
    }, [completionContext])

    useEffect(() => {
      setDistractionFreeClass(distractionFree)
      return () => setDistractionFreeClass(false)
    }, [distractionFree])

    useEffect(() => {
      return () => {
        completionDisposableRef.current?.dispose()
        modelRef.current?.dispose()
        modelRef.current = null
        editorRef.current = null
      }
    }, [])

    useEffect(() => {
      latest.current = value
      const model = modelRef.current
      if (!model) return
      const current = model.getValue()
      if (current === value) {
        lastSyncedValueRef.current = value
        return
      }
      if (value === lastSyncedValueRef.current) return
      model.setValue(value)
      lastSyncedValueRef.current = value
    }, [value])

    useEffect(() => {
      const editor = editorRef.current
      const monaco = monacoRef.current
      if (!editor || !monaco || !notePath) return

      const uri = monaco.Uri.file(notePath)
      const existing = monaco.editor.getModel(uri)
      if (existing && existing === modelRef.current) {
        editor.setModel(existing)
        return
      }
      existing?.dispose()

      const model = monaco.editor.createModel(latest.current, 'markdown', uri)
      lastSyncedValueRef.current = model.getValue()
      modelRef.current?.dispose()
      modelRef.current = model
      editor.setModel(model)
    }, [notePath])

    const handleInsertText = useCallback((text: string) => {
      const editor = editorRef.current
      if (!editor) return false
      const model = editor.getModel()
      if (!model) return false

      const selection = editor.getSelection()
      const range = selection ?? model.getFullModelRange()
      editor.executeEdits('scriptor-insert', [{ range, text, forceMoveMarkers: true }])
      const nextValue = model.getValue()
      lastSyncedValueRef.current = nextValue
      onChangeRef.current(nextValue)
      editor.focus()
      return true
    }, [])

    const handleTransformAction = useCallback((action: EditorTransformAction) => {
      const editor = editorRef.current
      if (!editor) return false
      const model = editor.getModel()
      if (!model) return false

      const selection = editor.getSelection()
      if (!selection) return false

      const beforeValue = model.getValue()

      const wrapSelection = (prefix: string, suffix = prefix) => {
        let range: IRange = selection
        let selectedText = model.getValueInRange(range)

        if (range.startLineNumber === range.endLineNumber && range.startColumn === range.endColumn) {
          const pos = selection.getPosition()
          const word = model.getWordAtPosition(pos)
          if (word) {
            range = {
              startLineNumber: pos.lineNumber,
              startColumn: word.startColumn,
              endLineNumber: pos.lineNumber,
              endColumn: word.endColumn,
            }
            selectedText = model.getValueInRange(range)
          }
        }

        if (
          selectedText.startsWith(prefix) &&
          selectedText.endsWith(suffix) &&
          selectedText.length >= prefix.length + suffix.length
        ) {
          const unwrapped = selectedText.slice(prefix.length, selectedText.length - suffix.length)
          editor.executeEdits('scriptor-transform', [{ range, text: unwrapped, forceMoveMarkers: true }])
          return
        }

        const startPos = { lineNumber: range.startLineNumber, column: range.startColumn }
        const endPos = { lineNumber: range.endLineNumber, column: range.endColumn }
        const startOffset = model.getOffsetAt(startPos)
        const endOffset = model.getOffsetAt(endPos)

        if (startOffset >= prefix.length && endOffset + suffix.length <= model.getValueLength()) {
          const beforeRange = {
            startLineNumber: model.getPositionAt(startOffset - prefix.length).lineNumber,
            startColumn: model.getPositionAt(startOffset - prefix.length).column,
            endLineNumber: startPos.lineNumber,
            endColumn: startPos.column,
          }
          const afterRange = {
            startLineNumber: endPos.lineNumber,
            startColumn: endPos.column,
            endLineNumber: model.getPositionAt(endOffset + suffix.length).lineNumber,
            endColumn: model.getPositionAt(endOffset + suffix.length).column,
          }
          const beforeText = model.getValueInRange(beforeRange)
          const afterText = model.getValueInRange(afterRange)

          if (beforeText === prefix && afterText === suffix) {
            const fullRange = {
              startLineNumber: beforeRange.startLineNumber,
              startColumn: beforeRange.startColumn,
              endLineNumber: afterRange.endLineNumber,
              endColumn: afterRange.endColumn,
            }
            editor.executeEdits('scriptor-transform', [{ range: fullRange, text: selectedText, forceMoveMarkers: true }])
            return
          }
        }

        const wrapped = `${prefix}${selectedText}${suffix}`
        editor.executeEdits('scriptor-transform', [{ range, text: wrapped, forceMoveMarkers: true }])
      }

      const toggleHeading = (level: 1 | 2 | 3) => {
        const startLine = selection.startLineNumber
        const endLine =
          selection.endLineNumber > selection.startLineNumber && selection.endColumn === 1
            ? selection.endLineNumber - 1
            : selection.endLineNumber
        const prefix = `${'#'.repeat(level)} `
        const edits: MonacoEditor.IIdentifiedSingleEditOperation[] = []

        for (let line = startLine; line <= endLine; line += 1) {
          const lineContent = model.getLineContent(line)
          const lineRange = {
            startLineNumber: line,
            startColumn: 1,
            endLineNumber: line,
            endColumn: lineContent.length + 1,
          }
          let newLine: string
          if (lineContent.startsWith(prefix)) {
            newLine = lineContent.slice(prefix.length)
          } else {
            const stripped = lineContent.replace(/^#{1,6}\s*/, '')
            newLine = `${prefix}${stripped}`
          }
          edits.push({ range: lineRange, text: newLine, forceMoveMarkers: true })
        }
        editor.executeEdits('scriptor-transform', edits)
      }

      const toggleBlockquote = () => {
        const startLine = selection.startLineNumber
        const endLine =
          selection.endLineNumber > selection.startLineNumber && selection.endColumn === 1
            ? selection.endLineNumber - 1
            : selection.endLineNumber
        const edits: MonacoEditor.IIdentifiedSingleEditOperation[] = []

        for (let line = startLine; line <= endLine; line += 1) {
          const lineContent = model.getLineContent(line)
          const lineRange = {
            startLineNumber: line,
            startColumn: 1,
            endLineNumber: line,
            endColumn: lineContent.length + 1,
          }
          const newLine = lineContent.startsWith('> ') ? lineContent.slice(2) : `> ${lineContent}`
          edits.push({ range: lineRange, text: newLine, forceMoveMarkers: true })
        }
        editor.executeEdits('scriptor-transform', edits)
      }

      switch (action) {
        case 'bold':
          wrapSelection('**')
          break
        case 'italic':
          wrapSelection('*')
          break
        case 'strikethrough':
          wrapSelection('~~')
          break
        case 'code':
          wrapSelection('`')
          break
        case 'link': {
          const text = model.getValueInRange(selection) || 'link'
          editor.executeEdits('scriptor-transform', [{
            range: selection,
            text: `[${text}](https://example.com)`,
            forceMoveMarkers: true,
          }])
          break
        }
        case 'h1':
          toggleHeading(1)
          break
        case 'h2':
          toggleHeading(2)
          break
        case 'h3':
          toggleHeading(3)
          break
        case 'blockquote':
          toggleBlockquote()
          break
        case 'table': {
          const tableTemplate = '\n| Column | Column |\n| --- | --- |\n|  |  |\n'
          editor.executeEdits('scriptor-transform', [{ range: selection, text: tableTemplate, forceMoveMarkers: true }])
          break
        }
        case 'table-add-row':
        case 'table-add-col': {
          const lineIndex = selection.positionLineNumber - 1
          const fullText = model.getValue()
          const lines = fullText.split('\n')
          const mutation = action === 'table-add-row' ? addTableRow : addTableColumn
          const nextLines = applyTableMutation(lines, lineIndex, mutation)
          if (nextLines) {
            editor.executeEdits('scriptor-transform', [{
              range: model.getFullModelRange(),
              text: nextLines.join('\n'),
              forceMoveMarkers: true,
            }])
          }
          break
        }
        case 'move-section-up':
        case 'move-section-down': {
          const cursorLine = selection.positionLineNumber
          const fullText = model.getValue()
          const lines = fullText.split('\n')
          const entries = generateTocFromMarkdown(fullText)
          const direction: -1 | 1 = action === 'move-section-up' ? -1 : 1
          const result = moveSectionLines(entries, lines, cursorLine, direction)
          if (result) {
            editor.executeEdits('scriptor-transform', [{
              range: model.getFullModelRange(),
              text: result.lines.join('\n'),
              forceMoveMarkers: true,
            }])
            editor.setPosition({ lineNumber: result.newCursorLine, column: 1 })
            editor.revealLineInCenter(result.newCursorLine)
          }
          break
        }
        case 'footnote': {
          const start = model.getOffsetAt(selection.getStartPosition())
          const end = model.getOffsetAt(selection.getEndPosition())
          const { markdown, cursor } = insertFootnoteIntoMarkdown(model.getValue(), start, end)
          editor.executeEdits('scriptor-transform', [{
            range: model.getFullModelRange(),
            text: markdown,
            forceMoveMarkers: true,
          }])
          const position = model.getPositionAt(cursor)
          editor.setPosition(position)
          editor.revealPositionInCenter(position)
          break
        }
      }

      const nextValue = model.getValue()
      if (nextValue !== beforeValue) {
        lastSyncedValueRef.current = nextValue
        onChangeRef.current(nextValue)
      }
      editor.focus()
      return true
    }, [])

    const handleTypographyAction = useCallback((action: TypographyAction) => {
      const editor = editorRef.current
      if (!editor) return false
      const model = editor.getModel()
      if (!model) return false

      const selection = editor.getSelection()
      const range = selection && !selection.isEmpty() ? selection : model.getFullModelRange()
      const text = model.getValueInRange(range)
      const transformed = applyTypographyToText(text, action)
      if (transformed !== text) {
        editor.executeEdits('scriptor-typography', [{ range, text: transformed, forceMoveMarkers: true }])
        const nextValue = model.getValue()
        lastSyncedValueRef.current = nextValue
        onChangeRef.current(nextValue)
      }
      editor.focus()
      return true
    }, [])

    useImperativeHandle(
      ref,
      () => ({
        scrollToLine: (line: number, focus?: boolean) => {
          const editor = editorRef.current
          if (!editor || line < 1) return
          editor.revealLineInCenter(line)
          editor.setPosition({ lineNumber: line, column: 1 })
          if (focus) editor.focus()
        },
        getTopVisibleLine: () => {
          const editor = editorRef.current
          if (!editor) return 1
          return editor.getVisibleRanges()[0]?.startLineNumber ?? 1
        },
        getScrollElement: () => {
          const editor = editorRef.current
          if (!editor) return null
          return editor.getDomNode()?.querySelector('.monaco-scrollable-element') as HTMLElement | null
        },
        getToc: () => {
          const model = editorRef.current?.getModel()
          if (!model) return []
          return generateTocFromMarkdown(model.getValue())
        },
        setVimMode: (_enabled: boolean) => {},
        setSpellcheck: (_enabled: boolean) => {},
        setLanguageTool: (_enabled: boolean) => {},
        setWysiwyg: (_enabled: boolean) => {},
        setTypewriter: (_enabled: boolean) => {},
        setFocusDim: (_enabled: boolean) => {},
        setEditorTheme: (theme: 'light' | 'dark') => {
          if (monacoRef.current) {
            monacoRef.current.editor.setTheme(monacoThemeForEditor(theme))
          }
        },
        applyTransform: (action: EditorTransformAction) => {
          handleTransformAction(action)
        },
        applyTypography: (action: TypographyAction) => {
          handleTypographyAction(action)
        },
        insertSnippet: (text: string) => {
          handleInsertText(text)
        },
      }),
      [handleInsertText, handleTransformAction, handleTypographyAction],
    )

    useEffect(() => {
      if (!insertRequest?.text) return
      if (lastInsertSeqRef.current === insertRequest.seq) return
      if (handleInsertText(insertRequest.text)) {
        lastInsertSeqRef.current = insertRequest.seq
      }
    }, [insertRequest, handleInsertText])

    useEffect(() => {
      if (!transformRequest?.action) return
      if (lastTransformSeqRef.current === transformRequest.seq) return
      if (handleTransformAction(transformRequest.action as EditorTransformAction)) {
        lastTransformSeqRef.current = transformRequest.seq
      }
    }, [transformRequest, handleTransformAction])

    useEffect(() => {
      if (!typographyRequest?.action) return
      if (lastTypographySeqRef.current === typographyRequest.seq) return
      if (handleTypographyAction(typographyRequest.action)) {
        lastTypographySeqRef.current = typographyRequest.seq
      }
    }, [typographyRequest, handleTypographyAction])

    useEffect(() => {
      const editor = editorRef.current
      if (!editor || !scrollToLine || scrollToLine < 1) return
      editor.revealLineInCenter(scrollToLine)
      editor.setPosition({ lineNumber: scrollToLine, column: 1 })
    }, [scrollToLine])

    useEffect(() => {
      const editor = editorRef.current
      const host = hostRef.current
      if (!editor || !host) return

      const applyPadding = () => {
        const scrollable = editor.getDomNode()?.querySelector('.monaco-scrollable-element') as HTMLElement | null
        if (!scrollable) return
        if (!typewriter) {
          scrollable.style.paddingTop = ''
          scrollable.style.paddingBottom = ''
          return
        }
        const half = Math.max(0, host.clientHeight / 2 - 24)
        const margin = `${half}px`
        scrollable.style.paddingTop = margin
        scrollable.style.paddingBottom = margin
      }

      const centerCursor = () => {
        if (!typewriter) return
        const line = editor.getPosition()?.lineNumber
        if (line) editor.revealLineInCenter(line)
      }

      applyPadding()
      centerCursor()

      const resizeObserver = new ResizeObserver(() => {
        applyPadding()
      })
      resizeObserver.observe(host)

      const cursorDisposable = editor.onDidChangeCursorPosition(() => {
        centerCursor()
      })

      return () => {
        resizeObserver.disconnect()
        cursorDisposable.dispose()
        const scrollable = editor.getDomNode()?.querySelector('.monaco-scrollable-element') as HTMLElement | null
        if (scrollable) {
          scrollable.style.paddingTop = ''
          scrollable.style.paddingBottom = ''
        }
      }
    }, [typewriter])

    const beforeMount: BeforeMount = (monaco) => {
      monacoRef.current = monaco
      registerScriptorMonacoThemes(monaco)
      completionDisposableRef.current?.dispose()
      completionDisposableRef.current = registerMarkdownCompletions(monaco)
    }

    const onMount: OnMount = (editor, monaco) => {
      editorRef.current = editor
      monacoRef.current = monaco
      const uri = monaco.Uri.file(notePath)
      let model = monaco.editor.getModel(uri)
      if (!model) {
        model = monaco.editor.createModel(latest.current, 'markdown', uri)
      } else if (model.getValue() !== latest.current) {
        model.setValue(latest.current)
      }
      lastSyncedValueRef.current = model.getValue()
      modelRef.current = model
      editor.setModel(model)
      if (import.meta.env.VITE_E2E_MODE === 'true') {
        ;(window as Window & { __scriptorE2eEditor?: MonacoEditor.IStandaloneCodeEditor }).__scriptorE2eEditor =
          editor
      }

      if (insertRequestRef.current?.text && lastInsertSeqRef.current !== insertRequestRef.current.seq) {
        if (handleInsertText(insertRequestRef.current.text)) {
          lastInsertSeqRef.current = insertRequestRef.current.seq
        }
      }
      if (transformRequestRef.current?.action && lastTransformSeqRef.current !== transformRequestRef.current.seq) {
        if (handleTransformAction(transformRequestRef.current.action as EditorTransformAction)) {
          lastTransformSeqRef.current = transformRequestRef.current.seq
        }
      }
      if (typographyRequestRef.current?.action && lastTypographySeqRef.current !== typographyRequestRef.current.seq) {
        if (handleTypographyAction(typographyRequestRef.current.action)) {
          lastTypographySeqRef.current = typographyRequestRef.current.seq
        }
      }
    }

    const editorFontSize = useMemo(
      () =>
        Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--editor-font-size')) || 14,
      [],
    )

    const hostClassName = [
      className,
      distractionFree ? 'scriptor-focus-editor' : '',
      typewriter ? 'scriptor-typewriter-editor' : '',
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <div className={hostClassName} ref={hostRef}>
        <Editor
          height="100%"
          language="markdown"
          theme={monacoThemeForEditor(editorTheme)}
          beforeMount={beforeMount}
          onMount={onMount}
          options={{
            readOnly,
            wordWrap: 'on',
            minimap: { enabled: false },
            fontFamily: 'var(--editor-font-family, var(--mono))',
            lineNumbers: showLineNumbers ? 'on' : 'off',
            fontSize: editorFontSize,
            scrollBeyondLastLine: false,
            quickSuggestions: { strings: true },
          }}
          onChange={(next) => {
            const nextValue = next ?? ''
            lastSyncedValueRef.current = nextValue
            onChange(nextValue)
          }}
        />
      </div>
    )
  },
)
