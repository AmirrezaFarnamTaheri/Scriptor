import Editor, { type BeforeMount, type OnMount } from '@monaco-editor/react'
import type { editor as MonacoEditor } from 'monaco-editor'
import { insertFootnoteIntoMarkdown, setDistractionFreeClass } from '@scriptor/editor'
import { useEffect, useMemo, useRef } from 'react'

import {
  registerMarkdownCompletions,
  setMonacoCompletionContext,
  type MonacoCompletionContext,
} from '../../lib/monaco-completions'
import { monacoThemeForEditor, registerScriptorMonacoThemes } from '../../lib/monaco-themes'

interface MonacoMarkdownEditorProps {
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
  scrollToLine?: number | null
  completionContext?: MonacoCompletionContext
}

export function MonacoMarkdownEditor({
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
  scrollToLine,
  completionContext,
}: MonacoMarkdownEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null)
  const modelRef = useRef<MonacoEditor.ITextModel | null>(null)
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null)
  const completionDisposableRef = useRef<{ dispose: () => void } | null>(null)
  const latest = useRef(value)
  const onChangeRef = useRef(onChange)
  // Last value the editor itself reported (or accepted from outside). The
  // `value` prop can echo back out of order while parent state settles; an
  // echo must never `setValue` over newer model content, or real keystrokes
  // get reverted mid-typing (dropped-character bug).
  const lastSyncedValueRef = useRef(value)
  const lastInsertSeqRef = useRef<number | null>(null)
  const lastTransformSeqRef = useRef<number | null>(null)

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
    // Prop is an echo of content this editor already produced (parent state
    // settled after the model) — do not revert newer keystrokes.
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

  useEffect(() => {
    const editor = editorRef.current
    if (!editor || !insertRequest?.text) return
    if (lastInsertSeqRef.current === insertRequest.seq) return
    const model = editor.getModel()
    if (!model) return
    lastInsertSeqRef.current = insertRequest.seq
    const selection = editor.getSelection()
    const range = selection ?? model.getFullModelRange()
    editor.executeEdits('scriptor-insert', [{ range, text: insertRequest.text, forceMoveMarkers: true }])
    lastSyncedValueRef.current = model.getValue()
    onChangeRef.current(model.getValue())
  }, [insertRequest])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor || !transformRequest?.action) return
    if (lastTransformSeqRef.current === transformRequest.seq) return
    const model = editor.getModel()
    if (!model) return
    if (transformRequest.action !== 'footnote') return
    lastTransformSeqRef.current = transformRequest.seq
    const selection = editor.getSelection()
    const start = model.getOffsetAt(selection?.getStartPosition() ?? { lineNumber: 1, column: 1 })
    const end = model.getOffsetAt(selection?.getEndPosition() ?? { lineNumber: 1, column: 1 })
    const { markdown, cursor } = insertFootnoteIntoMarkdown(model.getValue(), start, end)
    model.setValue(markdown)
    const position = model.getPositionAt(cursor)
    editor.setPosition(position)
    editor.revealPositionInCenter(position)
    lastSyncedValueRef.current = markdown
    onChangeRef.current(markdown)
  }, [transformRequest])

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
}
