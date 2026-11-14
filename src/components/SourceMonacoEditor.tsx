import Editor, { type BeforeMount, type OnMount } from '@monaco-editor/react'
import { useEffect, useRef, useState } from 'react'
import { registerScriptorMonacoThemes } from '../lib/monaco-themes'
import '../lib/monaco-environment'

interface SourceMonacoEditorProps {
  value: string
  language: string | null
  readOnly: boolean
  onChange: (value: string) => void
  onSave: () => void
}

const LANGUAGE_IDS: Record<string, string> = {
  latex: 'latex', bibtex: 'plaintext', python: 'python', rust: 'rust', javascript: 'javascript',
  typescript: 'typescript', json: 'json', yaml: 'yaml', toml: 'ini', text: 'plaintext',
  css: 'css', html: 'html', xml: 'xml', shell: 'shell', sql: 'sql',
  c: 'cpp', cpp: 'cpp', java: 'java',
}

function activeTheme(): 'scriptor-light' | 'scriptor-dark' {
  return document.documentElement.dataset.appearance === 'dark' ? 'scriptor-dark' : 'scriptor-light'
}

/**
 * Uses Scriptor's local Monaco bundle: highlighting, find, line numbers, undo
 * and keyboard save work offline. The plain textarea remains a user-selected
 * fallback for assistive technologies or low-memory machines.
 */
export default function SourceMonacoEditor({ value, language, readOnly, onChange, onSave }: SourceMonacoEditorProps) {
  const onSaveRef = useRef(onSave)
  useEffect(() => { onSaveRef.current = onSave }, [onSave])
  const [theme, setTheme] = useState(activeTheme)
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(activeTheme()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-appearance'] })
    return () => observer.disconnect()
  }, [])
  const beforeMount: BeforeMount = monaco => registerScriptorMonacoThemes(monaco)
  const onMount: OnMount = (editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => { onSaveRef.current() })
  }
  return <div className="source-file-monaco">
    <Editor
      height="100%"
      width="100%"
      value={value}
      language={LANGUAGE_IDS[language ?? ''] ?? 'plaintext'}
      theme={theme}
      beforeMount={beforeMount}
      onMount={onMount}
      onChange={next => onChange(next ?? '')}
      options={{
        automaticLayout: true,
        ariaLabel: 'Source file content',
        minimap: { enabled: false },
        lineNumbers: 'on',
        glyphMargin: false,
        folding: true,
        renderWhitespace: 'selection',
        scrollBeyondLastLine: false,
        wordWrap: 'off',
        fontSize: 14,
        tabSize: 4,
        readOnly,
      }}
    />
  </div>
}
